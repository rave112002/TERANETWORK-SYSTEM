/**
 * HSGQ XE04I — CLI output parsers (pure, no network).
 * ===================================================
 *
 * Turn the raw text the OLT prints back into structured JS objects. Pure
 * functions: give them a string, get data — easy to unit-test against captured
 * transcripts.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ ✅ LAYOUTS VERIFIED (September 2026 re-test) — see                        │
 * │ docs/vendor-transcripts/hsgq-xe04i/HSGQ-XE04I-CLI-Validation-v2.md.       │
 * │   show onu-info all          §10  (footer "Total: N  Online:N ...")       │
 * │   show optical-info          §11  (a TABLE, not key/value pairs)          │
 * │   show blacklist onu-info all §7                                          │
 * │   error formats              §6   ("  Error, ..." and "vty% ...")         │
 * │   event lines                §13  (interleaved, cannot be switched off)   │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * Design principle: be TOLERANT. Skip prompt echoes, headers, separators and
 * blank lines; only accept lines that clearly look like data. A parser that
 * silently mis-reads a device is dangerous, so when a line doesn't match the
 * expected shape we skip it rather than guess.
 */

// A MAC like 30:c5:0f:d8:7f:2c (six hex pairs, colon-separated).
const MAC_RE = "[0-9a-fA-F]{2}(?::[0-9a-fA-F]{2}){5}";

// An asynchronous event line, e.g.
//   [2000/01/01 01:12:51]  Info: ONU 1/27 30:c5:0f:d8:7f:2c ONU link up
// The OLT prints these into the middle of command output and there is no way
// to turn them off per session (v2 §5), so every check below ignores them.
const EVENT_LINE_RE = /^\s*\[\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}\]/;

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
 * Drop the OLT's asynchronous event lines from a chunk of output.
 * @param {string} raw
 * @returns {string}
 */
export const stripEventLines = (raw) =>
  String(raw)
    .split(/\r?\n/)
    .filter((line) => !EVENT_LINE_RE.test(line))
    .join("\n");

/**
 * Every line of one command's output that the OLT uses to report a failure.
 *
 * Two formats (v2 §6):
 *   "  Error, <action> fail, reason: <reason>."   — an action was refused
 *   "vty% [VTY] vty[node:7],Unknown command: ..." — bad command, wrong mode or
 *   "vty% Command incomplete."                      bad argument (incl. a bad MAC)
 *
 * Deliberately NOT a search for words like "fail": free-text ONU descriptions
 * and event lines contain them, and a false failure makes the queue retry a
 * real command against the device.
 *
 * @param {string} raw - output of ONE command.
 * @returns {string[]} the offending lines, trimmed; empty when clean.
 */
export const findCliErrors = (raw) =>
  stripEventLines(raw)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^Error,/i.test(line) || /vty%/i.test(line));

/**
 * Parse `show onu-info all` output (run inside `interface epon <pon>`, which
 * scopes it to that PON).
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
 *   // [{ onuIndex: "1/27", onuId: "27", mac: "30:c5:0f:d8:7f:2c", status: "Online",
 *   //    online: true, auth: true, config: true, regTime: "2000/01/01 01:00:31",
 *   //    name: "ONU01/27", description: "NO-DESCRIPTI" }]
 */
export const parseOnuInfoAll = (raw) => {
  const records = [];
  for (const line of String(raw).split(/\r?\n/)) {
    // Skip obvious non-data lines fast.
    if (!line.trim()) continue;
    if (/^[\s|+-]+$/.test(line)) continue; // separator row

    // Header, prompt echo, footer and event lines don't start with "<pon>/<onu> <mac>",
    // so they won't match. (No '#' filter: descriptions like "NAP#3" are real rows.)
    const m = line.match(ONU_LEAD_RE);
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
 * Read the summary footer of `show onu-info all`:
 *   "  Total: 60  Online:1  Offline:59"
 *
 * It proves the listing printed to the end, and its Total is a row-count check
 * against what parseOnuInfoAll read.
 *
 * @param {string} raw
 * @returns {{ total: number, online: number, offline: number }|null} null when absent.
 */
export const parseOnuInfoTotals = (raw) => {
  const m = String(raw).match(/Total:\s*(\d+)\s+Online:\s*(\d+)\s+Offline:\s*(\d+)/i);
  return m ? { total: Number(m[1]), online: Number(m[2]), offline: Number(m[3]) } : null;
};

/**
 * Pull one ONU's optical levels out of `show optical-info` (v2 §11):
 *
 *   PON/ONU ONU-Name     Mac-address       Temperature  Voltage  Bias   Tx power     Rx power
 *       1/27 ONU01/27     30:c5:0f:d8:7f:2c  56 °C      3.29 V   10 mA  2.0336 dBm   -11.9860 dBm
 *
 * The table lists every ONLINE ONU on the PON, so the row is picked by PON/ONU.
 * Tx comes before Rx; both carry a "dBm" unit, which is what we key on (the "°"
 * in the temperature column decodes differently per terminal, so the columns
 * before it are not relied on).
 *
 * @param {string} raw
 * @param {string} onuIndex - e.g. "1/27".
 * @returns {{ rxDbm: number|null, txDbm: number|null }} nulls when the ONU has
 *   no row — it is offline, or unbound. Never a guessed number.
 */
export const parseOpticalInfo = (raw, onuIndex) => {
  for (const line of stripEventLines(raw).split("\n")) {
    const m = line.match(/^\s*(\d+\/\d+)\s/);
    if (!m || m[1] !== onuIndex) continue;
    const levels = [...line.matchAll(/(-?\d+(?:\.\d+)?)\s*dBm/gi)].map((x) => Number(x[1]));
    if (levels.length >= 2) return { txDbm: levels[0], rxDbm: levels[1] };
  }
  return { rxDbm: null, txDbm: null };
};

/**
 * Parse `show blacklist onu-info all` (v2 §7):
 *
 *    PON/ONU     Mac-Address        Blacklist_Reject_Count  Reason   ONU-Name
 *    1/1         30:c5:0f:d8:7f:2c  2                       Manual   B_ONU01/01
 *
 * PON/ONU here is the blacklist ENTRY number, not the ONU's ID.
 *
 * @param {string} raw
 * @returns {{ listed: boolean, entries: Array<{ entry: string, mac: string, rejectCount: number }> }}
 *   `listed` is true only if the table header was printed. An empty `entries`
 *   means "nothing blacklisted" ONLY when `listed` is true; otherwise the
 *   command never ran and absence proves nothing.
 */
export const parseBlacklist = (raw) => {
  const text = stripEventLines(raw);
  const listed = /Blacklist_Reject_Count/i.test(text);
  const rowRe = new RegExp(`^\\s*(\\d+\\/\\d+)\\s+(${MAC_RE})\\s+(\\d+)`);
  const entries = [];
  for (const line of text.split("\n")) {
    const m = line.match(rowRe);
    if (m) entries.push({ entry: m[1], mac: m[2].toLowerCase(), rejectCount: Number(m[3]) });
  }
  return { listed, entries };
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

export default {
  stripEventLines,
  findCliErrors,
  parseOnuInfoAll,
  parseOnuInfoTotals,
  parseOpticalInfo,
  parseBlacklist,
  parseOnuInfoOne,
};
