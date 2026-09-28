/**
 * HSGQ XE04I — Telnet transport (the ONLY part that does real network I/O).
 * =========================================================================
 *
 * A tiny telnet client over Node's built-in `net` socket (no extra dependency).
 * Its whole job: connect, log in, walk the CLI prompt state machine, run a
 * command plan (from commands.js), and hand back what the device printed for
 * each command. The driver judges success from that (parsers.js).
 *
 * CLI navigation (v2 §3):
 *   login  ->  Tera-Network>            (user/exec mode)
 *   enable ->  Tera-Network#            (privileged mode, no password)
 *   configure -> Tera-Network(config)#  (global config)
 *   interface epon 1 -> Tera-Network(config-epon-1)#
 *   end    ->  Tera-Network#            (the only mode the save is verified in)
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ ✅ VERIFIED (September 2026 re-test, v2 §2/§5): prompts are lowercase     │
 * │ "username:" / "password:"; `enable` needs no password; output pages at   │
 * │ "--More--" unless `terminal length 0` is sent first (sent every session). │
 * │ See docs/vendor-transcripts/hsgq-xe04i/HSGQ-XE04I-CLI-Validation-v2.md.   │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * SAFETY: every path (success, timeout, socket error) ends by destroying the
 * socket in close(), so we never leak a session on the OLT (which allows only
 * ONE concurrent session — max_concurrent_sessions = 1 on the XE04I).
 */

import net from "node:net";

import { SAVE_COMMAND } from "./commands.js";

// A CLI prompt on its own line: hostname, optional "(mode)", then '>' or '#'.
// Anchored to the start of a line so a '#' inside an ONU description ("NAP#3")
// that happens to end a TCP chunk is never mistaken for the prompt.
const PROMPT_RE = /(?:^|\n)[^\s>#()]+(?:\([^()\s]*\))?[>#][ \t]*$/;
const MORE_RE = /-+\s*More\s*-+[ \t]*$/i;
const LOGIN_RE = /(?:login|username)\s*:\s*$/i;
const PASSWORD_RE = /password\s*:\s*$/i;
// "The length of the user name is invalid!" / "Bad username , too many failures!" (v2 §2)
const LOGIN_FAIL_RE = /invalid|bad (?:user|pass)|failure|incorrect|denied/i;

// Output decoration to drop: ANSI escapes and backspaces (used to erase "--More--").
const ANSI_RE = /\x1b\[[0-9;?]*[A-Za-z]/g;

// Event lines ("[2000/01/01 01:12:51]  Info: ...") printed AFTER a prompt. The
// OLT prints them whenever something happens on a PON (v2 §5), so a prompt can
// be followed by one; patterns are tested with these removed from the end.
const TRAILING_EVENTS_RE = /(?:\r?\n[ \t]*\[\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}\][^\n]*)+\r?\n?$/;

// Telnet protocol bytes (RFC 854). We answer option negotiation instead of
// ignoring it: some devices wait for a reply before printing the login prompt.
const IAC = 255;
const DONT = 254;
const DO = 253;
const WONT = 252;
const WILL = 251;
const SB = 250;
const SE = 240;
const OPT_ECHO = 1;
const OPT_SGA = 3; // suppress go-ahead

// Guard against a device that pages forever.
const MAX_PAGES = 1000;

export class HsgqTelnetTransport {
  /**
   * @param {Object} opts
   * @param {string} opts.host
   * @param {number} [opts.port=23]
   * @param {string} opts.username
   * @param {string} opts.password
   * @param {string} [opts.enablePassword] - sent if `enable` prompts for one.
   * @param {number} [opts.timeoutMs=10000] - per-step read timeout.
   */
  constructor({ host, port = 23, username, password, enablePassword, timeoutMs = 10000 }) {
    this.host = host;
    this.port = port;
    this.username = username;
    this.password = password;
    this.enablePassword = enablePassword;
    this.timeoutMs = timeoutMs;

    this.socket = null;
    this.buffer = ""; // accumulates text until a prompt/pattern is seen
    this._pending = Buffer.alloc(0); // an IAC sequence split across TCP chunks
    this._answered = new Set(); // negotiation already replied to (avoid loops)
    this._closedError = null; // set once the device hangs up
    this._waiter = null; // the single in-flight { patterns, resolve, reject, timer }
  }

  /**
   * Open the TCP connection. Resolves once connected (not yet logged in).
   * @returns {Promise<void>}
   */
  connect() {
    return new Promise((resolve, reject) => {
      this.socket = net.createConnection({ host: this.host, port: this.port });

      // Without this an unreachable host hangs for the OS's own SYN timeout (~21 s on Windows).
      const timer = setTimeout(() => {
        this.socket.destroy();
        reject(new Error(`Could not connect to ${this.host}:${this.port} within ${this.timeoutMs} ms`));
      }, this.timeoutMs);

      const onConnectError = (err) => {
        clearTimeout(timer);
        reject(err);
      };
      this.socket.once("error", onConnectError);

      this.socket.once("connect", () => {
        clearTimeout(timer);
        this.socket.removeListener("error", onConnectError);
        this.socket.on("data", (chunk) => this._onData(chunk));
        // If the socket dies mid-operation, fail the pending waiter (and any later one).
        this.socket.on("error", (err) => this._onClosed(err));
        this.socket.on("close", () => this._onClosed(new Error("Connection closed by device")));
        resolve();
      });
    });
  }

  /**
   * Strip telnet negotiation out of a raw chunk, answer it, and append the
   * remaining text to the buffer.
   *
   * Text is decoded as latin1 (one byte = one char) so a stray non-UTF-8 byte,
   * like the "°" in `show optical-info`, can't corrupt the characters around it.
   *
   * @param {Buffer} chunk
   */
  _onData(chunk) {
    const data = this._pending.length ? Buffer.concat([this._pending, chunk]) : chunk;
    this._pending = Buffer.alloc(0);

    const text = [];
    const replies = [];
    let i = 0;
    while (i < data.length) {
      if (data[i] !== IAC) {
        text.push(data[i]);
        i += 1;
        continue;
      }
      if (i + 1 >= data.length) {
        this._pending = data.subarray(i);
        break;
      }
      const cmd = data[i + 1];
      if (cmd === IAC) {
        // Escaped 0xFF data byte.
        text.push(IAC);
        i += 2;
      } else if (cmd === SB) {
        // Sub-negotiation: skip to IAC SE.
        const end = data.indexOf(Buffer.from([IAC, SE]), i + 2);
        if (end === -1) {
          this._pending = data.subarray(i);
          break;
        }
        i = end + 2;
      } else if (cmd >= WILL && cmd <= DONT) {
        if (i + 2 >= data.length) {
          this._pending = data.subarray(i);
          break;
        }
        const opt = data[i + 2];
        const key = `${cmd}:${opt}`;
        if (!this._answered.has(key)) {
          this._answered.add(key);
          // Let the device echo and suppress go-ahead; refuse everything else.
          if (cmd === WILL) replies.push(IAC, opt === OPT_ECHO || opt === OPT_SGA ? DO : DONT, opt);
          if (cmd === DO) replies.push(IAC, opt === OPT_SGA ? WILL : WONT, opt);
        }
        i += 3;
      } else {
        // Any other two-byte command (NOP, GA, ...).
        i += 2;
      }
    }

    if (replies.length && this.socket && !this.socket.destroyed) {
      this.socket.write(Buffer.from(replies));
    }
    if (text.length) {
      this.buffer += Buffer.from(text)
        .toString("latin1")
        .replace(ANSI_RE, "")
        .replace(/\x08/g, "");
      this._checkWaiter();
    }
  }

  /**
   * Wait until the accumulated buffer matches one of `patterns`.
   * @param {Array<{name: string, re: RegExp}>} patterns
   * @param {number} [timeoutMs]
   * @returns {Promise<{ name: string, text: string }>} the matched name + text so far.
   */
  _expect(patterns, timeoutMs = this.timeoutMs) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._waiter = null;
        reject(new Error(`Timed out waiting for ${patterns.map((p) => p.name).join("/")} (got: ${JSON.stringify(this.buffer.slice(-80))})`));
      }, timeoutMs);

      this._waiter = { patterns, resolve, reject, timer };
      this._checkWaiter(); // maybe it's already in the buffer
      // The device may already have hung up (e.g. after a failed login).
      if (this._waiter && this._closedError) this._failWaiter(this._closedError);
    });
  }

  /** Test the buffer against the current waiter's patterns; resolve on a hit. */
  _checkWaiter() {
    if (!this._waiter) return;
    const settled = this.buffer.replace(TRAILING_EVENTS_RE, "");
    for (const { name, re } of this._waiter.patterns) {
      if (re.test(settled)) {
        const text = this.buffer;
        this.buffer = "";
        clearTimeout(this._waiter.timer);
        const { resolve } = this._waiter;
        this._waiter = null;
        resolve({ name, text });
        return;
      }
    }
  }

  /** Remember that the device is gone, then fail the pending waiter. */
  _onClosed(err) {
    this._closedError ??= err;
    this._failWaiter(err);
  }

  /** Fail the pending waiter (socket error/close). */
  _failWaiter(err) {
    if (!this._waiter) return;
    clearTimeout(this._waiter.timer);
    const { reject } = this._waiter;
    this._waiter = null;
    reject(err);
  }

  /** Write a line to the device (CRLF-terminated, as telnet expects). */
  _writeLine(line) {
    this.socket.write(`${line}\r\n`);
  }

  /**
   * Log in: answer the username/password banner, land on the user prompt.
   *
   * A rejected login is reported as such. Without this it surfaced as a
   * timeout, which reads like a network problem and sends you to the cabling.
   *
   * @returns {Promise<void>}
   */
  async login() {
    if (!this.username || !this.password) {
      throw new Error("This OLT has no username/password saved — re-enter its credentials");
    }
    const refused = (text) =>
      new Error(
        `The OLT refused the login (${JSON.stringify(text.trim().slice(-100))}). ` +
          "Check the username and password saved on this OLT."
      );

    await this._expect([{ name: "login", re: LOGIN_RE }]);
    this._writeLine(this.username);

    let reply = await this._expect([
      { name: "password", re: PASSWORD_RE },
      { name: "rejected", re: LOGIN_FAIL_RE },
    ]);
    if (reply.name !== "password") throw refused(reply.text);
    this._writeLine(this.password);

    reply = await this._expect([
      { name: "prompt", re: PROMPT_RE },
      { name: "rejected", re: LOGIN_FAIL_RE },
      { name: "retry", re: LOGIN_RE },
    ]);
    if (reply.name !== "prompt") throw refused(reply.text);
  }

  /**
   * Send one command and return everything printed up to the next prompt —
   * with the command's echo and the trailing prompt stripped off, and any
   * "--More--" pages continued and joined.
   *
   * WHY strip the prompt: prompts have no trailing newline (e.g.
   * "...(config-epon-1)# "). Keeping it would glue a prompt fragment onto the
   * next command's first line and a line-based parser would mis-read it.
   *
   * @param {string} line
   * @param {number} [timeoutMs]
   * @returns {Promise<string>} device output for this command.
   */
  async exec(line, timeoutMs = this.timeoutMs) {
    this._writeLine(line);
    let out = "";
    for (let page = 0; ; page += 1) {
      const { name, text } = await this._expect(
        [
          { name: "prompt", re: PROMPT_RE },
          { name: "more", re: MORE_RE },
        ],
        timeoutMs
      );
      if (name === "prompt") {
        out += text;
        break;
      }
      // Paging should be off (`terminal length 0`); this is the safety net.
      if (page >= MAX_PAGES) throw new Error(`'${line}' paged more than ${MAX_PAGES} times`);
      out += text.replace(MORE_RE, "");
      this.socket.write(" ");
    }

    return (
      out
        .replace(TRAILING_EVENTS_RE, "")
        // Remove the final prompt line (e.g. "\nTera-Network(config-epon-1)# ").
        .replace(/\r?\n?[^\r\n]*[>#][ \t]*$/, "")
        // Carriage returns used to overwrite a line ("--More--" erasure).
        .replace(/\r(?!\n)/g, "")
        // The device's echo of what we typed.
        .replace(/^[ \t]*(.*)\r?\n?/, (first, echoed) => (echoed.trim() === line.trim() ? "" : first))
    );
  }

  /**
   * Enter privileged mode, handling an optional enable password prompt.
   * @returns {Promise<void>}
   */
  async enable() {
    this._writeLine("enable");
    const { name } = await this._expect([
      { name: "password", re: PASSWORD_RE },
      { name: "prompt", re: PROMPT_RE },
    ]);
    if (name === "password") {
      this._writeLine(this.enablePassword ?? this.password);
      await this._expect([{ name: "prompt", re: PROMPT_RE }]);
    }
  }

  /**
   * Run a command plan from commands.js:
   *   enable -> terminal length 0 -> configure -> interface -> commands ->
   *   end -> (save)
   *
   * @param {{ interface: string, commands: string[], save: boolean }} plan
   * @returns {Promise<{
   *   command: string,
   *   rawResponse: string,
   *   outputs: Array<{ command: string, output: string }>
   * }>} `outputs` is per command, so the driver can judge each reply on its
   *   own; `rawResponse` is the whole session as a readable transcript.
   */
  async execPlan(plan) {
    const outputs = [];
    const run = async (command, timeoutMs) => {
      outputs.push({ command, output: await this.exec(command, timeoutMs) });
    };

    await this.enable();
    // Without this, a 60-ONU `show onu-info all` stops at "--More--" (v2 §5).
    await run("terminal length 0");
    await run("configure");
    await run(`interface ${plan.interface}`);
    for (const cmd of plan.commands) {
      await run(cmd);
    }
    // `end`, not `exit`: the save is only verified at `Tera-Network#` (v2 §14).
    await run("end");
    if (plan.save) {
      // Writing flash can be slower than a `show`.
      await run(SAVE_COMMAND, Math.max(this.timeoutMs, 30000));
    }

    return {
      command: plan.commands.join("\n"),
      rawResponse: outputs.map(({ command, output }) => `> ${command}\n${output}`).join("\n"),
      outputs,
    };
  }

  /**
   * Close the session. Safe to call multiple times. ALWAYS call this (finally).
   */
  async close() {
    if (this.socket && !this.socket.destroyed) {
      try {
        this._writeLine("exit"); // best-effort logout
      } catch {
        // ignore — we're tearing down anyway
      }
      this.socket.destroy();
    }
    this.socket = null;
  }
}

export default HsgqTelnetTransport;
