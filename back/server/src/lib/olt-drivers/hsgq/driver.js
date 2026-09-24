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
 *   3. parses each command's output,
 *   4. returns a DriverResult { success, command, rawResponse, parsed }.
 *
 * Success is judged from the STATE the OLT reports afterwards (the blacklist
 * table, the save confirmation, the list footer), not from scanning replies for
 * error words. A false failure is not harmless: the queue retries it, which
 * means sending the command to the device again (v2 §18).
 *
 * This driver stays behind DRY_RUN until confirmed on the real XE04I.
 * resolveDriver() only hands it out for OLTs whose vendor = 'hsgq'.
 */

import { OltDriver } from "../driver.interface.js";
import APIError from "../../../utils/APIError.js";
import { HsgqTelnetTransport } from "./telnet.js";
import {
  SAVE_COMMAND,
  SHOW_BLACKLIST,
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
} from "./parsers.js";

/** Output of the first command in the session that matches `command`. */
const outputOf = (outputs, command) => outputs.find((o) => o.command === command)?.output ?? "";

/**
 * Every CLI error line in the session, labelled with the command that caused it.
 * @param {Array<{command: string, output: string}>} outputs
 * @param {(o: {command: string, output: string}) => boolean} [ignore] - replies not to trust.
 * @returns {string[]}
 */
const sessionErrors = (outputs, ignore = () => false) =>
  outputs
    .filter((o) => !ignore(o))
    .flatMap((o) => findCliErrors(o.output).map((line) => `${o.command} → ${line}`));

/** The save printed its confirmation (v2 §14, leading space trimmed away by the match). */
const savedOk = (outputs) => /Configuration saved successfully/i.test(outputOf(outputs, SAVE_COMMAND));

/** "; the OLT said: ..." suffix for an error message, or "". */
const saying = (errors) => (errors.length ? `; the OLT said: ${errors.join(" | ")}` : "");

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
   * @returns {Promise<{ command: string, rawResponse: string, outputs: Array<{command: string, output: string}> }>}
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
   * would defeat the purpose of having a kill switch at all. (Login, `enable`,
   * `terminal length 0` and `configure` are navigation and are left out.)
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
    if (plan.save) lines.push("end", SAVE_COMMAND);
    return lines.join("\n");
  }

  /**
   * Suspend: blacklist the MAC, confirm it is in the blacklist table, save.
   * @param {import('../driver.interface.js').OltContext} ctx
   */
  async deactivateOnu(ctx) {
    const mac = normalizeMac(ctx.mac);
    const plan = buildDeactivate(ctx);
    const [addCommand] = plan.commands;
    const { command, rawResponse, outputs } = await this._runPlan(ctx, plan);

    // Re-blacklisting answers "Error, Blacklist ONU add fail, reason: ONU has
    // existed." That's the desired end state (a retry after a failed save lands
    // here), so it's not an error.
    const alreadyBlacklisted = /has existed/i.test(outputOf(outputs, addCommand));
    const errors = sessionErrors(outputs, (o) => o.command === addCommand && alreadyBlacklisted);
    const blacklist = parseBlacklist(outputOf(outputs, SHOW_BLACKLIST));
    const blacklisted = blacklist.entries.some((e) => e.mac === mac);
    const saved = savedOk(outputs);

    let error;
    if (!blacklist.listed) error = `Could not read the blacklist back to confirm the suspend${saying(errors)}`;
    else if (!blacklisted) error = `${mac} is not on the OLT's blacklist after 'blacklist add'${saying(errors)}`;
    else if (!saved) error = `Blacklisted, but the save was not confirmed — a power cycle would undo it${saying(errors)}`;

    return {
      success: !error,
      command,
      rawResponse,
      parsed: { blacklisted, alreadyBlacklisted, saved, warnings: errors },
      error,
    };
  }

  /**
   * Restore: remove the MAC from the blacklist, confirm it is gone, save.
   *
   * The delete's own reply is ignored: across three successful deletes on the
   * bench it printed nothing twice and "Error, No Bind ONU fail, reason: ONU is
   * not exist." once (v2 §7). The blacklist table is the only reliable answer.
   *
   * @param {import('../driver.interface.js').OltContext} ctx
   */
  async activateOnu(ctx) {
    const mac = normalizeMac(ctx.mac);
    const plan = buildActivate(ctx);
    const [deleteCommand] = plan.commands;
    const { command, rawResponse, outputs } = await this._runPlan(ctx, plan);

    const errors = sessionErrors(outputs, (o) => o.command === deleteCommand);
    const blacklist = parseBlacklist(outputOf(outputs, SHOW_BLACKLIST));
    const stillBlacklisted = blacklist.entries.some((e) => e.mac === mac);
    const saved = savedOk(outputs);

    let error;
    if (!blacklist.listed) error = `Could not read the blacklist back to confirm the restore${saying(errors)}`;
    else if (stillBlacklisted) error = `${mac} is still on the OLT's blacklist after 'blacklist delete'${saying(errors)}`;
    else if (!saved) error = `Removed from the blacklist, but the save was not confirmed — a power cycle would re-suspend it${saying(errors)}`;

    return {
      success: !error,
      command,
      rawResponse,
      parsed: { blacklisted: stillBlacklisted, saved, warnings: errors },
      error,
    };
  }

  /**
   * Read one ONU's status and optical levels.
   *
   * The ONU is found by MAC when we have it, not by PON/ONU: a blacklisted ONU
   * loses its binding, and when it comes back the OLT gives it the lowest free
   * ID, which need not be the old one (v2 §7). Matching by the stored index
   * could then read a DIFFERENT customer's ONU that took the slot.
   *
   * @param {import('../driver.interface.js').OltContext} ctx
   */
  async getOnuStatus(ctx) {
    let mac = null;
    try {
      mac = ctx.mac ? normalizeMac(ctx.mac) : null;
    } catch {
      mac = null;
    }
    const plan = buildStatus({ onuIndex: ctx.onuIndex });
    const { command, rawResponse, outputs } = await this._runPlan(ctx, plan);

    const listing = outputOf(outputs, "show onu-info all");
    const rows = parseOnuInfoAll(listing);
    const row = (mac ? rows.find((r) => r.mac === mac) : rows.find((r) => r.onuIndex === ctx.onuIndex)) ?? null;
    const optical = row
      ? parseOpticalInfo(outputOf(outputs, "show optical-info"), row.onuIndex)
      : { rxDbm: null, txDbm: null };

    const errors = sessionErrors(outputs);
    let error;
    if (errors.length) error = `The OLT reported an error${saying(errors)}`;
    else if (!parseOnuInfoTotals(listing)) error = "The ONU list did not print to the end (no 'Total:' footer)";

    return {
      success: !error,
      command,
      rawResponse,
      parsed: {
        // Not in the table = unbound (blacklisted, or never registered): certainly not online.
        found: Boolean(row),
        online: row ? row.online : false,
        auth: row?.auth ?? null,
        config: row?.config ?? null,
        onuIndex: row?.onuIndex ?? null,
        indexChanged: Boolean(row && row.onuIndex !== ctx.onuIndex),
        ...optical,
      },
      error,
    };
  }

  /** @param {import('../driver.interface.js').OltContext} ctx */
  async listOnus(ctx) {
    // Which PON to sweep: explicit ponPortIndex, else derive from onuIndex.
    const pon = ctx.ponPortIndex ?? (ctx.onuIndex ? parseOnuIndex(ctx.onuIndex).pon : undefined);
    const plan = buildListOnus({ ponPortIndex: pon });
    const { command, rawResponse, outputs } = await this._runPlan(ctx, plan);

    const listing = outputOf(outputs, "show onu-info all");
    const rows = parseOnuInfoAll(listing);
    const totals = parseOnuInfoTotals(listing);
    const errors = sessionErrors(outputs);

    // The footer's Total is a free row-count check: a parser that silently drops
    // rows would otherwise look exactly like a PON with fewer ONUs.
    let error;
    if (errors.length) error = `The OLT reported an error on PON ${pon}${saying(errors)}`;
    else if (!totals) error = `The ONU list for PON ${pon} did not print to the end (no 'Total:' footer)`;
    else if (totals.total !== rows.length) {
      error = `Read ${rows.length} ONUs on PON ${pon} but the OLT reported Total: ${totals.total} — the parser needs adjusting`;
    }

    return {
      success: !error,
      command,
      rawResponse,
      parsed: rows,
      error,
    };
  }
}

export default HsgqOltDriver;
