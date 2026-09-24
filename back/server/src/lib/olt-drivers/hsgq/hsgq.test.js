import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  buildActivate,
  buildDeactivate,
  buildListOnus,
  buildStatus,
  normalizeMac,
  parseOnuIndex,
} from "./commands.js";
import {
  findCliErrors,
  parseBlacklist,
  parseOnuInfoAll,
  parseOnuInfoTotals,
  parseOpticalInfo,
  stripEventLines,
} from "./parsers.js";
import { HsgqOltDriver } from "./driver.js";

/**
 * HSGQ XE04I driver.
 *
 * The command syntax and output shapes below are not guesses: they were
 * verified on the bench against firmware HSGQ-XE04I_I_V3.3.6C_Rel, first in
 * July 2026 and again (with corrections) in September 2026. See
 * `docs/vendor-transcripts/hsgq-xe04i/HSGQ-XE04I-CLI-Validation-v2.md`.
 *
 * These tests exist because getting the suspend sequence wrong is not a bug
 * that shows up in staging — it is a customer who stays connected while the
 * system reports them cut off, or vice versa.
 */

const MAC = "30:c5:0f:d8:7f:2c";
const CTX = { onuIndex: "1/27", mac: MAC };

const RULE = "-".repeat(100);

// Real layouts from v2 §7, §10 and §11.
const ONU_TABLE = [
  RULE,
  " PON/ONU     Mac-Address    Status   Auth  Cfg     Reg-time            ONU-Name     ONU-Desc",
  RULE,
  " 1/26    aa:bb:cc:00:00:26 Initial   TRUE  FALSE  1970/01/01 08:00:00      ONU01/26     NAP#3 PORT 2",
  " 1/27    30:c5:0f:d8:7f:2c Online    TRUE  TRUE  2000/01/01 01:00:31      ONU01/27     NO-DESCRIPTI",
  RULE,
  "  Total: 2  Online:1  Offline:1",
  RULE,
].join("\r\n");

const OPTICAL_TABLE = [
  RULE,
  "PON/ONU ONU-Name     Mac-address       Temperature  Voltage      Bias         Tx power     Rx power",
  RULE,
  "    1/3  ONU01/03     aa:bb:cc:00:00:03  50 \xb0C      3.30 V        9 mA       1.9000 dBm   -20.5000 dBm",
  "    1/27 ONU01/27     30:c5:0f:d8:7f:2c  56 \xb0C      3.29 V        10 mA       2.0336 dBm   -11.9860 dBm",
  RULE,
].join("\r\n");

const blacklistTable = (macs) =>
  [
    RULE,
    " PON/ONU     Mac-Address        Blacklist_Reject_Count  Reason                  ONU-Name",
    RULE,
    ...macs.map((m, i) => ` 1/${i + 1}         ${m}  2                       Manual                  B_ONU01/0${i + 1}`),
    RULE,
  ].join("\r\n");

describe("parseOnuIndex", () => {
  it("splits pon/onu-id", () => {
    expect(parseOnuIndex("1/27")).toEqual({ pon: "1", onuId: "27" });
    expect(parseOnuIndex(" 2/5 ")).toEqual({ pon: "2", onuId: "5" });
  });

  it("rejects anything that is not pon/onu-id", () => {
    for (const bad of ["27", "1/", "/27", "a/b", "", null, undefined]) {
      expect(() => parseOnuIndex(bad)).toThrow();
    }
  });
});

describe("normalizeMac", () => {
  it("sends the only form the OLT accepts: lowercase with colons", () => {
    // Dashes and Cisco dots come back as "Unknown command" (v2 §7).
    for (const m of ["30:C5:0F:D8:7F:2C", "30-c5-0f-d8-7f-2c", "30c5.0fd8.7f2c", MAC]) {
      expect(normalizeMac(m)).toBe(MAC);
    }
  });

  it("refuses anything that isn't a MAC", () => {
    for (const bad of [undefined, null, "", "30:c5:0f", "zz:c5:0f:d8:7f:2c"]) {
      expect(() => normalizeMac(bad)).toThrow(/MAC/i);
    }
  });
});

describe("deactivate — the suspend sequence", () => {
  it("blacklists the MAC, then reads the blacklist back", () => {
    // No onu-deregister: `blacklist add` already unbinds and drops the ONU, so a
    // deregister after it answers "ONU is not exist" — a false failure (v2 §7).
    expect(buildDeactivate(CTX).commands).toEqual([`blacklist add mac ${MAC}`, "show blacklist onu-info all"]);
  });

  it("normalises the MAC it sends", () => {
    expect(buildDeactivate({ onuIndex: "1/27", mac: "30-C5-0F-D8-7F-2C" }).commands[0]).toBe(`blacklist add mac ${MAC}`);
  });

  it("enters the right EPON interface", () => {
    expect(buildDeactivate(CTX).interface).toBe("epon 1");
  });

  it("SAVES — the blacklist only survives a power cycle if written to flash", () => {
    // Bench-verified both ways (v2 §15). Without the save, a power cut silently
    // reconnects everyone who was suspended for non-payment.
    expect(buildDeactivate(CTX).save).toBe(true);
  });

  it("refuses to build without a MAC, because the blacklist is by MAC", () => {
    expect(() => buildDeactivate({ onuIndex: "1/27" })).toThrow(/MAC/i);
  });
});

describe("activate — the restore sequence", () => {
  it("removes the MAC from the blacklist, then reads the blacklist back", () => {
    // The ONU re-registers on its own once un-blacklisted (bench-confirmed).
    expect(buildActivate(CTX).commands).toEqual([`blacklist delete mac ${MAC}`, "show blacklist onu-info all"]);
  });

  it("does NOT use onu-authorize", () => {
    // `onu-authorize` is a GLOBAL auth-mode command, not a per-ONU action.
    // Using it here would silently fail to reconnect anyone while appearing to succeed.
    expect(JSON.stringify(buildActivate(CTX))).not.toMatch(/onu-authorize/);
  });

  it("saves, so the un-blacklisting also survives a power cycle", () => {
    expect(buildActivate(CTX).save).toBe(true);
  });

  it("refuses to build without a MAC", () => {
    expect(() => buildActivate({ onuIndex: "1/27" })).toThrow(/MAC/i);
  });
});

describe("status and list", () => {
  it("reads both the ONU table and the optical levels", () => {
    expect(buildStatus(CTX).commands).toEqual(["show onu-info all", "show optical-info"]);
  });

  it("never saves on a read", () => {
    expect(buildStatus(CTX).save).toBe(false);
    expect(buildListOnus({ ponPortIndex: "1" }).save).toBe(false);
  });

  it("lists per EPON port", () => {
    expect(buildListOnus({ ponPortIndex: "2" })).toMatchObject({
      interface: "epon 2",
      commands: ["show onu-info all"],
    });
  });

  it("refuses to list without a PON port", () => {
    expect(() => buildListOnus({})).toThrow(/ponPortIndex/i);
  });
});

describe("parseOnuInfoAll — against the bench-derived transcript", () => {
  const transcript = fs.readFileSync(
    path.resolve("../docs/vendor-transcripts/hsgq-xe04i/show-onu-info-all.sample.txt"),
    "utf8",
  );
  const rows = parseOnuInfoAll(transcript);

  it("reads every data row and no others", () => {
    // The command echo, the header and the trailing prompt must all be skipped.
    expect(rows).toHaveLength(3);
  });

  it("reads the lab ONU correctly", () => {
    const onu = rows.find((r) => r.onuIndex === "1/27");
    expect(onu).toMatchObject({
      onuId: "27",
      mac: "30:c5:0f:d8:7f:2c",
      online: true,
      auth: true,
      config: true,
    });
  });

  it("keeps the previous operator's free-text description intact", () => {
    // Device discovery parses a customer name, NAP and port out of this.
    expect(rows.find((r) => r.onuIndex === "1/27").description).toBe(
      "Jacqueline-Rebancos PON 2 NAP 1 PORT 5",
    );
  });

  it("distinguishes offline from online", () => {
    expect(rows.find((r) => r.onuIndex === "1/5").online).toBe(false);
  });

  it("handles a row with no description", () => {
    const bare = rows.find((r) => r.onuIndex === "1/12");
    expect(bare.description).toBeNull();
    expect(bare.config).toBe(false);
  });

  it("normalises the MAC to lowercase, matching how ONUs are stored", () => {
    for (const row of rows) expect(row.mac).toBe(row.mac.toLowerCase());
  });

  it("returns nothing rather than guessing on unparseable output", () => {
    // A parser that mis-reads a device is more dangerous than one that reads
    // nothing: acting on a wrong row means disconnecting the wrong customer.
    expect(parseOnuInfoAll("Command not recognised\n%Invalid input")).toEqual([]);
    expect(parseOnuInfoAll("")).toEqual([]);
  });
});

describe("parseOnuInfoAll — the real v2 layout", () => {
  const rows = parseOnuInfoAll(ONU_TABLE);

  it("reads the rows, not the header or footer", () => {
    expect(rows.map((r) => r.onuIndex)).toEqual(["1/26", "1/27"]);
  });

  it("keeps a row whose description contains '#'", () => {
    expect(rows[0].description).toBe("NAP#3 PORT 2");
  });

  it("treats 'Initial' as offline and 'Online' as online", () => {
    expect(rows[0]).toMatchObject({ status: "Initial", online: false });
    expect(rows[1]).toMatchObject({ status: "Online", online: true, regTime: "2000/01/01 01:00:31" });
  });

  it("reads the footer totals", () => {
    expect(parseOnuInfoTotals(ONU_TABLE)).toEqual({ total: 2, online: 1, offline: 1 });
    expect(parseOnuInfoTotals("no footer here")).toBeNull();
  });
});

describe("parseOpticalInfo", () => {
  it("reads the real table layout, for the right ONU", () => {
    expect(parseOpticalInfo(OPTICAL_TABLE, "1/27")).toEqual({ txDbm: 2.0336, rxDbm: -11.986 });
    expect(parseOpticalInfo(OPTICAL_TABLE, "1/3")).toEqual({ txDbm: 1.9, rxDbm: -20.5 });
  });

  it("returns null rather than a wrong number when the ONU has no row", () => {
    // An offline or blacklisted ONU is simply absent, and a PON with nothing
    // online prints nothing at all — that must read as "unknown", never as
    // 0 dBm, which would look like a perfect signal.
    expect(parseOpticalInfo(OPTICAL_TABLE, "1/28")).toEqual({ rxDbm: null, txDbm: null });
    expect(parseOpticalInfo("", "1/27")).toEqual({ rxDbm: null, txDbm: null });
  });

  it("is not fooled by an event line about the same ONU", () => {
    const raw = `[2000/01/01 01:14:05]  Info: ONU 1/27 ${MAC} ONU link up\n${OPTICAL_TABLE}`;
    expect(parseOpticalInfo(raw, "1/27")).toEqual({ txDbm: 2.0336, rxDbm: -11.986 });
  });
});

describe("parseBlacklist", () => {
  it("reads the MACs on the blacklist", () => {
    expect(parseBlacklist(blacklistTable([MAC]))).toEqual({
      listed: true,
      entries: [{ entry: "1/1", mac: MAC, rejectCount: 2 }],
    });
  });

  it("tells an empty blacklist apart from one that was never printed", () => {
    expect(parseBlacklist(blacklistTable([]))).toEqual({ listed: true, entries: [] });
    expect(parseBlacklist("vty% [VTY] vty[node:7],Unknown command: show blacklist onu-info all")).toEqual({
      listed: false,
      entries: [],
    });
  });
});

describe("findCliErrors", () => {
  it("catches both error formats", () => {
    expect(findCliErrors("vty% [VTY] vty[node:7],Unknown command: copy running-config")).toHaveLength(1);
    expect(findCliErrors("vty% Command incomplete.")).toHaveLength(1);
    expect(findCliErrors("  Error, Deregister ONU fail, reason: ONU is not exist.")).toEqual([
      "Error, Deregister ONU fail, reason: ONU is not exist.",
    ]);
  });

  it("ignores event lines and free text that merely mention failure", () => {
    const raw = [
      "[2000/01/01 01:08:39]  Critical: PON 1 PON link down and all onu will be offline  maybe fiber signal los",
      " 1/9     aa:bb:cc:00:00:09 Initial   TRUE  FALSE  1970/01/01 08:00:00      ONU01/09     ERROR-FAIL",
      " Configuration saved successfully",
    ].join("\n");
    expect(findCliErrors(raw)).toEqual([]);
  });

  it("stripEventLines keeps everything else", () => {
    expect(stripEventLines("a\n[2000/01/01 00:00:00]  Info: x\nb")).toBe("a\nb");
  });
});

describe("describe() — what dry-run logs", () => {
  const driver = new HsgqOltDriver();

  it("produces the exact command sequence a live run would send", () => {
    // If these ever diverged, rehearsing would tell you nothing about the real
    // thing, which is the entire point of the kill switch.
    expect(driver.describe("deactivate", CTX).split("\n")).toEqual([
      "interface epon 1",
      `blacklist add mac ${MAC}`,
      "show blacklist onu-info all",
      "end",
      "copy running-config startup-config",
    ]);
    expect(driver.describe("activate", CTX).split("\n")).toEqual([
      "interface epon 1",
      `blacklist delete mac ${MAC}`,
      "show blacklist onu-info all",
      "end",
      "copy running-config startup-config",
    ]);
  });

  it("covers status too", () => {
    expect(driver.describe("status", CTX)).toContain("show onu-info all");
  });

  it("opens no session — it is pure text", () => {
    // No host, port or credentials in the context: if describe() tried to
    // connect, this would throw.
    expect(() => driver.describe("deactivate", { onuIndex: "1/27", mac: MAC })).not.toThrow();
  });
});

/**
 * A fake XE04I on localhost, reproducing the behaviour the v2 re-test recorded:
 * telnet negotiation, lowercase prompts, paging until `terminal length 0`,
 * event lines printed AFTER the prompt, commands that only exist in one mode,
 * and a `blacklist delete` that reports an error even when it worked.
 *
 * It exists because the telnet transport has never talked to the real device.
 * Everything it does here is something the real device was seen doing.
 */
const fakeOlt = () => {
  const state = { blacklist: new Set(), sessions: [], saves: 0 };

  const server = net.createServer((socket) => {
    const session = { commands: [] };
    state.sessions.push(session);
    let stage = "user";
    let mode = ">";
    let paging = true;
    let pendingPages = [];
    let input = "";

    const prompt = () => `\r\nTera-Network${mode}`;
    const send = (text) => !socket.writableEnded && socket.write(Buffer.from(text, "latin1"));
    socket.on("error", () => {}); // the client destroys the socket when it is done
    const nodeId = () => ({ "#": 6, "(config)#": 7 })[mode] ?? 32;
    const unknown = (cmd) => `vty% [VTY] vty[node:${nodeId()}],Unknown command: ${cmd}`;

    const page = (text) => {
      const lines = text.split("\r\n");
      if (!paging || lines.length <= 20) return send(`${text}${prompt()}`);
      send(`${lines.slice(0, 20).join("\r\n")}\r\n --More-- `);
      pendingPages = lines.slice(20);
    };

    const onuTable = () => {
      // 60 rows on PON 1, like the bench: enough to page at 20 lines.
      const rows = [];
      for (let id = 1; id <= 60; id += 1) {
        const mac = id === 27 ? MAC : `aa:bb:cc:00:00:${String(id).padStart(2, "0")}`;
        if (state.blacklist.has(mac)) continue;
        const online = id === 27;
        rows.push(
          ` 1/${id}    ${mac} ${online ? "Online " : "Initial"}   TRUE  ${online ? "TRUE " : "FALSE"}  ` +
            `${online ? "2000/01/01 01:00:31" : "1970/01/01 08:00:00"}      ONU01/${id}     NO-DESCRIPTI`,
        );
      }
      const online = rows.filter((r) => r.includes("Online")).length;
      return [RULE, " PON/ONU     Mac-Address ...", RULE, ...rows, RULE,
        `  Total: ${rows.length}  Online:${online}  Offline:${rows.length - online}`, RULE].join("\r\n");
    };

    const run = (cmd) => {
      session.commands.push(cmd);
      const epon = mode.startsWith("(config-epon");
      let m;
      if (cmd === "enable" && mode === ">") mode = "#";
      else if (cmd === "terminal length 0" && mode === "#") paging = false;
      else if (cmd === "configure" && mode === "#") mode = "(config)#";
      else if ((m = cmd.match(/^interface epon ([1-4])$/)) && mode === "(config)#") mode = `(config-epon-${m[1]})#`;
      else if (cmd === "end") mode = "#";
      else if (cmd === "exit") return socket.end();
      else if (cmd === "show onu-info all" && epon) return page(onuTable());
      else if (cmd === "show optical-info" && epon) {
        return send(state.blacklist.has(MAC) ? prompt() : `${OPTICAL_TABLE}${prompt()}`);
      } else if (cmd === "show blacklist onu-info all" && epon) {
        return send(`${blacklistTable([...state.blacklist])}${prompt()}`);
      } else if ((m = cmd.match(/^blacklist add mac (\S+)$/)) && epon) {
        if (!/^[0-9a-f]{2}(:[0-9a-f]{2}){5}$/i.test(m[1])) return send(`${unknown(cmd)}${prompt()}`);
        const mac = m[1].toLowerCase();
        if (state.blacklist.has(mac)) return send(`  Error, Blacklist ONU add fail, reason: ONU has existed.${prompt()}`);
        state.blacklist.add(mac);
        // The event lands AFTER the prompt, as it does on the device.
        return send(`${prompt()}\r\n[2000/01/01 01:08:39]  Critical: PON 1 PON link down and all onu will be offline  maybe fiber signal los\r\n`);
      } else if ((m = cmd.match(/^blacklist delete mac (\S+)$/)) && epon) {
        state.blacklist.delete(m[1].toLowerCase());
        // Worked — and says otherwise, as it did once in three on the bench.
        return send(`  Error, No Bind ONU fail, reason: ONU is not exist.${prompt()}`);
      } else if (cmd === "copy running-config startup-config" && mode === "#") {
        state.saves += 1;
        return send(` Configuration saved successfully${prompt()}`);
      } else return send(`${unknown(cmd)}${prompt()}`);
      return send(prompt());
    };

    socket.on("data", (buf) => {
      // Drop the client's negotiation replies; keep the text.
      const bytes = [];
      for (let i = 0; i < buf.length; i += 1) {
        if (buf[i] === 255) i += 2;
        else bytes.push(buf[i]);
      }
      input += Buffer.from(bytes).toString("latin1");

      if (pendingPages.length && input.startsWith(" ")) {
        input = input.slice(1);
        const rest = pendingPages;
        pendingPages = [];
        page(rest.join("\r\n"));
      }

      let nl;
      while ((nl = input.indexOf("\n")) !== -1) {
        const line = input.slice(0, nl).replace(/\r$/, "");
        input = input.slice(nl + 1);
        if (stage === "user") {
          stage = "pass";
          send(`${line}\r\npassword:`);
        } else if (stage === "pass") {
          if (line !== "secret") return send("\r\nBad username , too many failures!\r\n") && socket.end();
          stage = "cli";
          send(prompt());
        } else {
          send(`${line}\r\n`); // echo, as with WILL ECHO
          run(line.trim());
        }
      }
    });

    // IAC WILL ECHO, IAC WILL SGA, IAC DO NAWS — then the banner.
    socket.write(Buffer.from([255, 251, 1, 255, 251, 3, 255, 253, 31]));
    send("\r\nusername:");
  });

  return { server, state };
};

describe("HsgqOltDriver against a fake XE04I", () => {
  let olt;
  let ctx;
  const driver = new HsgqOltDriver();
  driver.timeoutMs = 2000;

  beforeAll(async () => {
    olt = fakeOlt();
    await new Promise((resolve) => olt.server.listen(0, "127.0.0.1", resolve));
  });

  afterAll(() => new Promise((resolve) => olt.server.close(resolve)));

  beforeEach(() => {
    olt.state.blacklist.clear();
    olt.state.sessions.length = 0;
    olt.state.saves = 0;
    ctx = {
      ...CTX,
      host: "127.0.0.1",
      port: olt.server.address().port,
      protocol: "telnet",
      credentials: { username: "root", password: "secret" },
    };
  });

  it("lists every ONU on the PON, past the pager, and checks the count", async () => {
    const result = await driver.listOnus({ ...ctx, ponPortIndex: "1" });
    expect(result.error).toBeUndefined();
    expect(result.success).toBe(true);
    expect(result.parsed).toHaveLength(60);
    expect(olt.state.sessions[0].commands.slice(0, 3)).toEqual(["enable", "terminal length 0", "configure"]);
  });

  it("suspends: blacklist add, confirmed, saved from '#'", async () => {
    const result = await driver.deactivateOnu(ctx);
    expect(result.error).toBeUndefined();
    expect(result).toMatchObject({ success: true, parsed: { blacklisted: true, saved: true } });
    expect(olt.state.blacklist.has(MAC)).toBe(true);
    expect(olt.state.saves).toBe(1);
    expect(olt.state.sessions[0].commands).not.toContain("onu-deregister 27");
  });

  it("treats suspending an already-suspended ONU as success (a retry)", async () => {
    olt.state.blacklist.add(MAC);
    const result = await driver.deactivateOnu(ctx);
    expect(result).toMatchObject({ success: true, parsed: { alreadyBlacklisted: true } });
  });

  it("restores despite the delete's misleading error, because the table says so", async () => {
    olt.state.blacklist.add(MAC);
    const result = await driver.activateOnu(ctx);
    expect(result.error).toBeUndefined();
    expect(result).toMatchObject({ success: true, parsed: { blacklisted: false, saved: true } });
    expect(olt.state.blacklist.has(MAC)).toBe(false);
  });

  it("reads status and the right optical row", async () => {
    const result = await driver.getOnuStatus(ctx);
    expect(result.error).toBeUndefined();
    expect(result.parsed).toMatchObject({ found: true, online: true, rxDbm: -11.986, txDbm: 2.0336 });
  });

  it("finds the ONU by MAC when the OLT gave it a different ID", async () => {
    const result = await driver.getOnuStatus({ ...ctx, onuIndex: "1/5" });
    expect(result.parsed).toMatchObject({ found: true, onuIndex: "1/27", indexChanged: true });
  });

  it("reports a suspended ONU as not online, with no optical numbers", async () => {
    olt.state.blacklist.add(MAC);
    const result = await driver.getOnuStatus(ctx);
    expect(result.success).toBe(true);
    expect(result.parsed).toMatchObject({ found: false, online: false, rxDbm: null, txDbm: null });
  });

  it("says a wrong password is a wrong password, not a timeout", async () => {
    const bad = { ...ctx, credentials: { username: "root", password: "nope" } };
    await expect(driver.listOnus({ ...bad, ponPortIndex: "1" })).rejects.toThrow(/refused the login/);
  });

  it("fails a PON that doesn't exist instead of reporting it empty", async () => {
    const result = await driver.listOnus({ ...ctx, ponPortIndex: "9" });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Unknown command/);
  });
});
