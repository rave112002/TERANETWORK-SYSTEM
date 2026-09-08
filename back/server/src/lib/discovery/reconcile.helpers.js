/**
 * Pure helpers for reconciliation. No database, no devices, no side effects.
 *
 * Split out from the reconciler so the fiddly parsing can be tested on its own
 * — which matters, because these functions decide whether two records are the
 * same modem, and getting that wrong either duplicates a customer's hardware or
 * silently merges two of them.
 */

/**
 * Canonicalise a MAC address.
 *
 * Devices spell them differently and all of them are "correct": an OLT reports
 * `30:c5:0f:d8:7f:2c`, a MikroTik `30:C5:0F:D8:7F:2C`, some gear uses dashes,
 * and Cisco-style kit writes `30c5.0fd8.7f2c`. The MAC is the join key between
 * a device record and ours, so comparing two spellings of the same address as
 * though they were different modems is the central failure this prevents.
 *
 * Strips to hex, insists on exactly twelve digits, regroups into pairs.
 *
 * @param {unknown} mac
 * @returns {string|null} `"30:c5:0f:d8:7f:2c"`, or null when it is not a MAC.
 *
 * @example
 *   normalizeMac("30:C5:0F:D8:7F:2C") // "30:c5:0f:d8:7f:2c"
 *   normalizeMac("30-c5-0f-d8-7f-2c") // "30:c5:0f:d8:7f:2c"
 *   normalizeMac("30c5.0fd8.7f2c")    // "30:c5:0f:d8:7f:2c"
 *   normalizeMac("not-a-mac")         // null
 */
export const normalizeMac = (mac) => {
  if (typeof mac !== "string") return null;
  const hex = mac.replace(/[^0-9a-fA-F]/g, "").toLowerCase();
  if (hex.length !== 12) return null;
  return hex.match(/.{2}/g).join(":");
};

/**
 * Pull structured hints out of the previous operator's ONU description.
 *
 * Field technicians typed things like:
 *
 *   "Jacqueline-Rebancos PON 2 NAP 1 PORT 5"
 *
 * into a free-text field, and that string is often the only record of who a
 * modem belongs to and where it hangs. Parsing it turns a bare MAC into a
 * pre-filled import form, which is the difference between importing four
 * hundred modems and retyping four hundred modems.
 *
 * Everything returned is a SUGGESTION. A missing piece comes back null rather
 * than a guess, and staff confirm every field before anything is created.
 *
 * @param {unknown} description
 * @returns {{name: string|null, pon: number|null, nap: number|null, port: number|null, raw: string}}
 *
 * @example
 *   parseOnuDescription("Jacqueline-Rebancos PON 2 NAP 1 PORT 5")
 *   // { name: "Jacqueline-Rebancos", pon: 2, nap: 1, port: 5, raw: "…" }
 */
export const parseOnuDescription = (description) => {
  const raw = typeof description === "string" ? description.trim() : "";
  const empty = { name: null, pon: null, nap: null, port: null, raw };
  if (!raw) return empty;

  const num = (pattern) => {
    const match = raw.match(pattern);
    return match ? Number(match[1]) : null;
  };

  const pon = num(/\bPON\s*[:#-]?\s*(\d+)/i);
  const nap = num(/\bNAP\s*[:#-]?\s*(\d+)/i);
  const port = num(/\bPORT\s*[:#-]?\s*(\d+)/i);

  // The name is whatever precedes the first location keyword. The leading \b
  // avoids matching inside a word like "Newport"; there is deliberately no
  // trailing \b, so "pon2" with no space still splits.
  const locationPattern = /\b(?:PON|NAP|PORT|FAT|FDB)\s*[:#-]?\s*\d+/i;
  const firstLocation = raw.search(locationPattern);
  const beforeKeyword = firstLocation >= 0 ? raw.slice(0, firstLocation) : raw;
  const name = beforeKeyword.replace(/[\s,;:-]+$/, "").trim() || null;

  return { name, pon, nap, port, raw };
};

/**
 * Index PPPoE sessions by MAC, so the reconciler can answer "which account is
 * on this modem?".
 *
 * Nothing produces these yet — no RouterOS client exists (blocker M22, and the
 * router's credentials are still open as P4). The reconciler accepts them so
 * the shape is settled and the OLT-only path is not rewritten when they arrive.
 *
 * Sessions whose caller-id is not a usable MAC are skipped: they cannot be
 * joined, and guessing at them would attach an account to the wrong modem.
 *
 * @param {Array<{callerId?: string, username?: string}>} [sessions=[]]
 * @returns {{macToSession: Map<string, Object>, usernameToMac: Map<string, string>}}
 */
export const buildSessionMacIndex = (sessions = []) => {
  const macToSession = new Map();
  const usernameToMac = new Map();

  for (const session of sessions) {
    const mac = normalizeMac(session.callerId);
    if (!mac) continue;

    macToSession.set(mac, { ...session, mac });
    if (session.username) usernameToMac.set(session.username, mac);
  }

  return { macToSession, usernameToMac };
};

export default { normalizeMac, parseOnuDescription, buildSessionMacIndex };
