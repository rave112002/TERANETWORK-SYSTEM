/**
 * HSGQ XE04I — CLI command builders (pure, no network).
 * =====================================================
 *
 * These functions turn "deactivate ONU 1/27" into the exact CLI lines we'll send
 * the OLT. They're pure string-builders: no sockets, no side effects, trivially
 * unit-testable. The telnet transport handles the NAVIGATION around them
 * (login -> enable -> terminal length 0 -> configure -> interface epon N ->
 * ... -> end -> save).
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ ✅ COMMAND SYNTAX RE-VERIFIED on the bench (September 2026) — see         │
 * │ docs/vendor-transcripts/hsgq-xe04i/HSGQ-XE04I-CLI-Validation-v2.md.       │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * WHY suspend is the blacklist ALONE (v2 §7): `blacklist add mac` deletes the
 * ONU's `bind-onu` entry and drops it immediately; it then retries every ~60 s
 * and is rejected each time. A following `onu-deregister <id>` has nothing left
 * to deregister and answers "Error, Deregister ONU fail, reason: ONU is not
 * exist." — a false failure the queue would retry. So:
 *   suspend    = blacklist add     (+ read the blacklist back to prove it)
 *   reconnect  = blacklist delete  (+ read it back; the ONU re-binds itself in
 *                                   MAC/auto auth mode within ~60 s)
 * The read-back is the evidence, not the command's own reply: `blacklist delete`
 * sometimes prints an error even when it worked (v2 §7 "Behavior on Delete").
 * NOTE: `onu-authorize` is a GLOBAL auth-mode command, NOT a per-ONU action, so
 * it is deliberately NOT used for reconnect.
 */

import APIError from "../../../utils/APIError.js";

/** Persists running config to flash. Verified at `Tera-Network#` only (v2 §14). */
export const SAVE_COMMAND = "copy running-config startup-config";

/** Lists this PON's blacklist; must run inside `interface epon <n>` (v2 §4). */
export const SHOW_BLACKLIST = "show blacklist onu-info all";

/**
 * Split a vendor ONU index like "1/27" into its parts.
 * @param {string} onuIndex - "pon/onuId", e.g. "1/27".
 * @returns {{ pon: string, onuId: string }}
 * @throws {APIError} if the format isn't "<pon>/<onuId>".
 *
 * @example parseOnuIndex("1/27") // -> { pon: "1", onuId: "27" }
 */
export const parseOnuIndex = (onuIndex) => {
  if (typeof onuIndex !== "string" || !/^\d+\/\d+$/.test(onuIndex.trim())) {
    throw new APIError(`Invalid HSGQ onuIndex '${onuIndex}' (expected 'pon/onuId', e.g. '1/27')`, 400);
  }
  const [pon, onuId] = onuIndex.trim().split("/");
  return { pon, onuId };
};

/**
 * Normalise a MAC to the only form the XE04I accepts: lowercase, colon-separated.
 * Dashes and Cisco dots are rejected by the OLT as "Unknown command" (v2 §7).
 *
 * @param {string} mac - any of "30:C5:0F:D8:7F:2C", "30-c5-0f-d8-7f-2c", "30c5.0fd8.7f2c".
 * @returns {string} e.g. "30:c5:0f:d8:7f:2c"
 * @throws {APIError} if it is missing or isn't 12 hex digits.
 */
export const normalizeMac = (mac) => {
  const hex = String(mac ?? "").replace(/[^0-9a-fA-F]/g, "").toLowerCase();
  if (!mac || hex.length !== 12) {
    throw new APIError(`HSGQ needs the ONU MAC (blacklisting is by MAC); got '${mac ?? ""}'`, 400);
  }
  return hex.match(/../g).join(":");
};

/**
 * A "command plan" the transport executes: enter `interface epon <pon>`, run the
 * `commands` in order, then (if `save`) return to `#` and persist config.
 * Keeping this structured (rather than one big string) lets the transport handle
 * prompts/navigation and lets tests assert on exact lines.
 *
 * @typedef {Object} CommandPlan
 * @property {string} interface - e.g. "epon 1" (the interface to enter).
 * @property {string[]} commands - CLI lines to run inside that interface.
 * @property {boolean} save - whether to persist config afterwards.
 */

/**
 * Build the suspend (deactivate) command plan.
 * @param {{ onuIndex: string, mac: string }} args
 * @returns {CommandPlan}
 *
 * @example
 *   buildDeactivate({ onuIndex: "1/27", mac: "30:c5:0f:d8:7f:2c" })
 *   // {
 *   //   interface: "epon 1",
 *   //   commands: ["blacklist add mac 30:c5:0f:d8:7f:2c", "show blacklist onu-info all"],
 *   //   save: true,
 *   // }
 */
export const buildDeactivate = ({ onuIndex, mac }) => {
  const { pon } = parseOnuIndex(onuIndex);
  return {
    interface: `epon ${pon}`,
    commands: [`blacklist add mac ${normalizeMac(mac)}`, SHOW_BLACKLIST],
    // Bench-confirmed: the blacklist persists a power cycle ONLY after a save.
    save: true,
  };
};

/**
 * Build the reconnect (activate) command plan.
 *
 * Remove the MAC from the blacklist — the ONU re-registers and re-binds itself
 * (bench-confirmed). We do NOT call `onu-authorize` (a global auth-mode command).
 * @param {{ onuIndex: string, mac: string }} args
 * @returns {CommandPlan}
 */
export const buildActivate = ({ onuIndex, mac }) => {
  const { pon } = parseOnuIndex(onuIndex);
  return {
    interface: `epon ${pon}`,
    commands: [`blacklist delete mac ${normalizeMac(mac)}`, SHOW_BLACKLIST],
    save: true,
  };
};

/**
 * Build the status-read command plan. Uses the bench-verified commands:
 * `show onu-info all` (we parse the target ONU's row) and `show optical-info`
 * (optical levels for the online ONUs). Both are verified in
 * `(config-epon-N)#`, where they are scoped to that PON (v2 §4).
 * @param {{ onuIndex: string }} args
 * @returns {CommandPlan}
 */
export const buildStatus = ({ onuIndex }) => {
  const { pon } = parseOnuIndex(onuIndex);
  return {
    interface: `epon ${pon}`,
    commands: ["show onu-info all", "show optical-info"],
    save: false, // read-only
  };
};

/**
 * Build the "list all ONUs on a PON" command plan (used by Discovery).
 * @param {{ ponPortIndex: string }} args - the PON number, e.g. "1".
 * @returns {CommandPlan}
 */
export const buildListOnus = ({ ponPortIndex }) => {
  if (ponPortIndex === undefined || ponPortIndex === null || `${ponPortIndex}` === "") {
    throw new APIError("HSGQ listOnus requires a ponPortIndex (which EPON port to sweep)", 400);
  }
  return {
    interface: `epon ${ponPortIndex}`,
    commands: ["show onu-info all"],
    save: false,
  };
};

export default {
  SAVE_COMMAND,
  SHOW_BLACKLIST,
  parseOnuIndex,
  normalizeMac,
  buildDeactivate,
  buildActivate,
  buildStatus,
  buildListOnus,
};
