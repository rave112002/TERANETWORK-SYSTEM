/**
 * HSGQ XE04I — CLI command builders (pure, no network).
 * =====================================================
 *
 * These functions turn "deactivate ONU 1/27" into the exact CLI lines we'll send
 * the OLT. They're pure string-builders: no sockets, no side effects, trivially
 * unit-testable. The telnet/ssh transport (built in a later step) handles the
 * NAVIGATION around them (login -> enable -> configure -> interface epon N).
 *
 * Source of truth for syntax: docs/HSGQ_DOCUMENTATION.md (the lab bench). The
 * device is a BDCOM-derived HSGQ XE04I running EPON.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ ✅ COMMAND SYNTAX VERIFIED on the bench (July 2026) — see                 │
 * │ docs/vendor-transcripts/hsgq-xe04i/HSGQ-XE04I-CLI-Validation.md.          │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * WHY blacklist AND deregister for a suspend (confirmed on bench): a bare
 * `onu-deregister` reconnects on its own if the ONU is authorized and NOT
 * blacklisted. The blacklist is what HOLDS the ONU down. So:
 *   suspend    = blacklist add + onu-deregister   (deregister kicks it off now)
 *   reconnect  = blacklist delete                 (un-blacklisting auto-reregisters)
 * NOTE: `onu-authorize` is a GLOBAL auth-mode command, NOT a per-ONU action, so
 * it is deliberately NOT used for reconnect.
 */

import APIError from "../../../utils/APIError.js";

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
 * A "command plan" the transport executes: enter `interface epon <pon>`, run the
 * `commands` in order, then (if `save`) persist config. Keeping this structured
 * (rather than one big string) lets the transport handle prompts/navigation and
 * lets tests assert on exact lines.
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
 *   //   commands: ["blacklist add mac 30:c5:0f:d8:7f:2c", "onu-deregister 27"],
 *   //   save: true,
 *   // }
 */
export const buildDeactivate = ({ onuIndex, mac }) => {
  const { pon, onuId } = parseOnuIndex(onuIndex);
  if (!mac) {
    throw new APIError("HSGQ deactivate requires the ONU MAC (blacklist is by MAC)", 400);
  }
  return {
    interface: `epon ${pon}`,
    commands: [`blacklist add mac ${mac}`, `onu-deregister ${onuId}`],
    // Bench-confirmed: the blacklist persists a reboot ONLY after a save.
    save: true,
  };
};

/**
 * Build the reconnect (activate) command plan.
 *
 * Just remove the MAC from the blacklist — the ONU auto-reregisters (bench-
 * confirmed). We do NOT call `onu-authorize` (it's a global auth-mode command,
 * not per-ONU).
 * @param {{ onuIndex: string, mac: string }} args
 * @returns {CommandPlan}
 */
export const buildActivate = ({ onuIndex, mac }) => {
  const { pon } = parseOnuIndex(onuIndex);
  if (!mac) {
    throw new APIError("HSGQ activate requires the ONU MAC (to remove from blacklist)", 400);
  }
  return {
    interface: `epon ${pon}`,
    commands: [`blacklist delete mac ${mac}`],
    save: true,
  };
};

/**
 * Build the status-read command plan. Uses the bench-verified commands:
 * `show onu-info all` (we parse the target ONU's row) and `show optical-info`
 * (optical levels for the online ONU). Most `show` commands only work inside
 * config/interface mode on the XE04I.
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

export default { parseOnuIndex, buildDeactivate, buildActivate, buildStatus, buildListOnus };
