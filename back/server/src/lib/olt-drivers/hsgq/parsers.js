/**
 * HSGQ XE04I — CLI output parsers (pure, no network).
 * ===================================================
 *
 * Turn the raw text the OLT prints back into structured JS objects. Pure
 * functions: give them a string, get data — easy to unit-test against captured
 * transcripts.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ COLUMN ORDER VERIFIED (July 2026): `show onu-info all` prints            │
 * │   PON/ONU  Mac-Address  Status  Auth  Cfg  Reg-time  ONU-Name  ONU-Desc   │
 * │ See docs/vendor-transcripts/hsgq-xe04i/HSGQ-XE04I-CLI-Validation.md.      │
 * │ REMAINING CAVEAT: the bench report listed the columns but not a raw       │
 * │ multi-row dump, so exact spacing of Reg-time (date + time) and multi-word │
 * │ ONU-Desc is handled best-effort below. If a real capture shows a          │
 * │ different Reg-time/Name shape, tune ONU_LEAD_RE + the reg-time regex.      │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * Design principle: be TOLERANT. Skip prompt echoes, headers, separators and
 * blank lines; only accept lines that clearly look like data. A parser that
 * silently mis-reads a device is dangerous, so when a line doesn't match the
 * expected shape we skip it rather than guess.
 */

// A MAC like 30:c5:0f:d8:7f:2c (six hex pairs, colon-separated).
const MAC_RE = "[0-9a-fA-F]{2}(?::[0-9a-fA-F]{2}){5}";

// The reliable LEADING fields of a row:
//   PON/ONU  Mac-Address  Status  Auth  Cfg   <rest...>
// PON/ONU is like "1/27"; the rest (reg-time + name + desc) is captured whole
// and split afterwards, because reg-time contains a space and desc is free text.
const ONU_LEAD_RE = new RegExp(
  `^\\s*(\\d+\\/\\d+)\\s+(${MAC_RE})\\s+(\\S+)\\s+(\\S+)\\s+(\\S+)\\s*(.*)$`
);

// A reg-time like "2000/03/17 13:46:51" (date + time = two tokens).
const REG_TIME_RE = /^(\d{4}[-/]\d{2}[-/]\d{2}\s+\d{1,2}:\d{2}:\d{2})\s*/;

/**
 * Parse `show onu-info all` output (run inside `interface epon <pon>`).
 *
 * @param {string} raw - the raw device output.
 * @returns {Array<{
 *   onuIndex: string, onuId: string, mac: string, status: string,
 *   online: boolean, auth: boolean, config: boolean,
 *   regTime: string|null, name: string|null, description: string|null
 * }>}
 *
 * @example
 *   parseOnuInfoAll(text)
 *   // [{ onuIndex: "1/27", onuId: "27", mac: "30:c5:0f:d8:7f:2c", status: "online",
 *   //    online: true, auth: true, config: true, regTime: "2000/03/17 13:46:51",
 *   //    name: "ONU01/27", description: "Jacqueline-Rebancos PON 2 NAP 1 PORT 5" }]
 */
export const parseOnuInfoAll = (raw) => {
  const records = [];
  for (const line of String(raw).split(/\r?\n/)) {
    // Skip obvious non-data lines fast.
    if (!line.trim()) continue;
    if (line.includes("#") || line.includes(">")) continue; // prompt/command echo
    if (/^[\s|+-]+$/.test(line)) continue; // separator row

    const m = line.match(ONU_LEAD_RE);
    // Header row starts with "PON/ONU" (not \d+/\d+), so it won't match — skipped.
    if (!m) continue;

    const [, ponOnu, mac, status, auth, cfg, rest0] = m;

    // Pull reg-time (date + time) off the front of the tail, then name + desc.
    let rest = rest0.trim();
    let regTime = null;
    const rt = rest.match(REG_TIME_RE);
    if (rt) {
      regTime = rt[1];
      rest = rest.slice(rt[0].length).trim();
    }
    let name = null;
    let description = null;
    if (rest) {
      const parts = rest.split(/\s+/);
      name = parts.shift() || null;
      description = parts.join(" ").trim() || null;
    }

    records.push({
      onuIndex: ponOnu,
      onuId: ponOnu.split("/")[1],
      mac: mac.toLowerCase(),
      status,
      online: status.toLowerCase() === "online",
      auth: auth.toUpperCase() === "TRUE",
      config: cfg.toUpperCase() === "TRUE",
      regTime,
      name,
      description,
    });
  }
  return records;
};

/**
 * Best-effort parse of `show optical-rssi <id>` into Rx/Tx dBm.
 *
 * The exact layout is unconfirmed, so we scan for "RX ... <number> dBm" and
 * "TX ... <number> dBm" rather than assume fixed columns. Returns nulls for
 * anything we can't find (never a wrong number).
 *
 * @param {string} raw
 * @returns {{ rxDbm: number|null, txDbm: number|null }}
 */
export const parseOpticalRssi = (raw) => {
  const text = String(raw);
  const find = (label) => {
    // e.g. "RX Power : -16.07 dBm"  or  "Rx power -16.07dBm"
    const re = new RegExp(`${label}[^\\-\\d]*(-?\\d+(?:\\.\\d+)?)\\s*dbm`, "i");
    const m = text.match(re);
    return m ? Number(m[1]) : null;
  };
  return { rxDbm: find("RX"), txDbm: find("TX") };
};

/**
 * Parse a single-ONU `show onu-info <id>` into online/auth flags, tolerant of
 * "Key : Value" style lines. Provisional — adjust to real bench output.
 *
 * @param {string} raw
 * @returns {{ online: boolean|null, auth: boolean|null, config: boolean|null }}
 */
export const parseOnuInfoOne = (raw) => {
  const text = String(raw);
  const flag = (label) => {
    const m = text.match(new RegExp(`${label}[^:]*:\\s*(\\S+)`, "i"));
    if (!m) return null;
    const v = m[1].toLowerCase();
    return v === "true" || v === "online" || v === "up";
  };
  return {
    online: flag("online"),
    auth: flag("auth"),
    config: flag("config"),
  };
};

export default { parseOnuInfoAll, parseOpticalRssi, parseOnuInfoOne };
