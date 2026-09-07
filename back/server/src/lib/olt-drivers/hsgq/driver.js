/**
 * HsgqOltDriver — the real HSGQ XE04I driver.
 * ===========================================
 *
 * Stitches the three pure/IO pieces together behind the standard OltDriver
 * contract, so the worker treats it EXACTLY like the mock:
 *
 *   commands.js  (what to type)  ->  telnet.js  (type it, read reply)  ->  parsers.js (read it)
 *
 * Every method:
 *   1. builds a command plan,
 *   2. opens a telnet session, logs in, runs the plan, and ALWAYS closes it,
 *   3. parses the raw output,
 *   4. returns a DriverResult { success, command, rawResponse, parsed }.
 *
 * ⚠ Command syntax, login banner, and output format are all BENCH-VERIFY items
 * (see the notes in commands.js / telnet.js / parsers.js). This driver stays
 * behind DRY_RUN until confirmed on the real XE04I. resolveDriver() only hands
 * it out for OLTs whose vendor = 'hsgq'.
 */

import { OltDriver } from "../driver.interface.js";
import APIError from "../../../utils/APIError.js";
import { HsgqTelnetTransport } from "./telnet.js";
import { buildDeactivate, buildActivate, buildStatus, buildListOnus, parseOnuIndex } from "./commands.js";
import { parseOnuInfoAll, parseOpticalRssi } from "./parsers.js";

/**
 * Heuristic: did the device reply indicate a failure? HSGQ/BDCOM CLIs prefix
 * errors with '%' and use words like "error"/"invalid"/"fail". We treat their
 * presence as failure. (Refine against real transcripts.)
 * @param {string} raw
 * @returns {boolean}
 */
const looksLikeError = (raw) => /(^|\n)\s*%|(?:\b(?:error|invalid|fail(?:ed)?)\b)/i.test(raw);

export class HsgqOltDriver extends OltDriver {
  constructor() {
    super();
    this.vendor = "hsgq";
    this.timeoutMs = Number(process.env.HSGQ_TELNET_TIMEOUT_MS ?? 10000);
  }

  /**
   * Open a session, run a command plan, and always close it.
   * @param {import('../driver.interface.js').OltContext} ctx
   * @param {{ interface: string, commands: string[], save: boolean }} plan
   * @returns {Promise<{ command: string, rawResponse: string }>}
   */
  async _runPlan(ctx, plan) {
    if (ctx.protocol && ctx.protocol !== "telnet") {
      // SSH is on the device's roadmap (doc §16) but not enabled yet.
      throw new APIError(`HSGQ driver currently supports telnet only (got '${ctx.protocol}')`, 501);
    }
    const transport = new HsgqTelnetTransport({
      host: ctx.host,
      port: ctx.port ?? 23,
      username: ctx.credentials?.username,
      password: ctx.credentials?.password,
      enablePassword: ctx.credentials?.enablePassword,
      timeoutMs: this.timeoutMs,
    });
    try {
      await transport.connect();
      await transport.login();
      return await transport.execPlan(plan);
    } finally {
      // ALWAYS release the single OLT session, even on error.
      await transport.close();
    }
  }

  /**
   * Build the command text without opening a session — the dry-run path.
   *
   * Uses the same builders the real methods use, so what a rehearsal logs is
   * exactly what a live run would send. Anything that made these two diverge
   * would defeat the purpose of having a kill switch at all.
   *
   * @param {"activate"|"deactivate"|"status"} action
   * @param {import('../driver.interface.js').OltContext} ctx
   * @returns {string}
   */
  describe(action, ctx) {
    const build = {
      deactivate: buildDeactivate,
      activate: buildActivate,
      status: buildStatus,
    }[action];

    if (!build) return `hsgq: unknown action '${action}'`;

    const plan = build({ onuIndex: ctx.onuIndex, mac: ctx.mac });
    const lines = [`interface ${plan.interface}`, ...plan.commands];
    if (plan.save) lines.push("copy running-config startup-config");
    return lines.join("\n");
  }

  /** @param {import('../driver.interface.js').OltContext} ctx */
  async deactivateOnu(ctx) {
    const plan = buildDeactivate({ onuIndex: ctx.onuIndex, mac: ctx.mac });
    const { command, rawResponse } = await this._runPlan(ctx, plan);
    // Bench-confirmed idempotency: re-blacklisting an already-blacklisted ONU
    // returns "...reason: ONU has existed." That's the desired end state, so
    // treat it as success rather than a failure.
    const alreadyBlacklisted = /has existed/i.test(rawResponse);
    const success = alreadyBlacklisted || !looksLikeError(rawResponse);
    return {
      success,
      command,
      rawResponse,
      parsed: { blacklisted: success, alreadyBlacklisted },
      error: success ? undefined : "Device reported an error during deactivate",
    };
  }

  /** @param {import('../driver.interface.js').OltContext} ctx */
  async activateOnu(ctx) {
    const plan = buildActivate({ onuIndex: ctx.onuIndex, mac: ctx.mac });
    const { command, rawResponse } = await this._runPlan(ctx, plan);
    const success = !looksLikeError(rawResponse);
    return {
      success,
      command,
      rawResponse,
      parsed: { blacklisted: !success },
      error: success ? undefined : "Device reported an error during activate",
    };
  }

  /** @param {import('../driver.interface.js').OltContext} ctx */
  async getOnuStatus(ctx) {
    const plan = buildStatus({ onuIndex: ctx.onuIndex });
    const { command, rawResponse } = await this._runPlan(ctx, plan);
    // Find this ONU's row in `show onu-info all`, plus its optical levels.
    const row = parseOnuInfoAll(rawResponse).find((r) => r.onuIndex === ctx.onuIndex) ?? null;
    const optical = parseOpticalRssi(rawResponse);
    return {
      success: !looksLikeError(rawResponse),
      command,
      rawResponse,
      parsed: {
        online: row?.online ?? null,
        auth: row?.auth ?? null,
        config: row?.config ?? null,
        ...optical,
      },
    };
  }

  /** @param {import('../driver.interface.js').OltContext} ctx */
  async listOnus(ctx) {
    // Which PON to sweep: explicit ponPortIndex, else derive from onuIndex.
    const pon = ctx.ponPortIndex ?? (ctx.onuIndex ? parseOnuIndex(ctx.onuIndex).pon : undefined);
    const plan = buildListOnus({ ponPortIndex: pon });
    const { command, rawResponse } = await this._runPlan(ctx, plan);
    // The PON/ONU index comes straight from the output rows now.
    return {
      success: !looksLikeError(rawResponse),
      command,
      rawResponse,
      parsed: parseOnuInfoAll(rawResponse),
    };
  }
}

export default HsgqOltDriver;
