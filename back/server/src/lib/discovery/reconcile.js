import { buildSessionMacIndex, normalizeMac, parseOnuDescription } from "./reconcile.helpers.js";

/**
 * The reconciliation engine.
 *
 * Given what a device reports and what our records already say, sort every
 * record into three buckets:
 *
 *   matched    on the device and in our records — nothing to do
 *   new        on the device, not in our records — a candidate to import
 *   orphaned   in our records, not seen on the device — flagged for a person
 *
 * ── Pure, deliberately ──────────────────────────────────────────────────────
 *
 * It reads nothing and writes nothing. The caller fetches both sides and passes
 * them in, which makes the whole of this logic testable with no database and no
 * hardware — and this is logic worth testing, because it decides whether a
 * customer's modem is treated as new, already known, or missing.
 *
 * ── The MAC is the join key ─────────────────────────────────────────────────
 *
 * On EPON the MAC is the modem's identity, and it is also the caller-id on that
 * subscriber's PPPoE session. Every MAC on both sides is normalised before
 * comparison — an OLT's lowercase and a MikroTik's uppercase are the same
 * modem, and treating them as two is how a customer ends up with duplicate
 * hardware in the system.
 */

/**
 * @typedef {Object} DiscoveredItem
 * @property {'olt'|'mikrotik'} source
 * @property {string} externalKey the MAC (ONU) or username (account).
 * @property {Object} raw the device record, untouched.
 * @property {Object|null} suggested parsed hints for the import form.
 * @property {'matched'|'new'|'orphaned'} matchStatus
 * @property {'onu'|'subscription'|null} matchedEntity
 * @property {string|null} matchedId
 */

/**
 * @param {Object} input
 * @param {Array} [input.oltOnus=[]] ONUs parsed from the OLT.
 * @param {Array} [input.accounts=[]] PPPoE secrets. Nothing produces these yet.
 * @param {Array} [input.sessions=[]] active PPPoE sessions. Likewise.
 * @param {Object} [input.existing={}] our side.
 * @param {Array} [input.existing.onus=[]] `[{ onuId, mac, serialNo }]`.
 * @param {Array} [input.existing.subscriptions=[]] `[{ subscriptionId, onuId }]`.
 * @returns {{items: DiscoveredItem[], summary: {matched: number, new: number, orphaned: number}}}
 */
export const reconcile = ({
  oltOnus = [],
  accounts = [],
  sessions = [],
  existing = {},
} = {}) => {
  const existingOnus = existing.onus ?? [];
  const existingSubs = existing.subscriptions ?? [];

  const { macToSession, usernameToMac } = buildSessionMacIndex(sessions);
  const accountsByUsername = new Map(accounts.map((a) => [a.username, a]));

  // Our side, indexed by normalised MAC.
  const existingOnuByMac = new Map();
  for (const onu of existingOnus) {
    const mac = normalizeMac(onu.mac);
    if (mac) existingOnuByMac.set(mac, onu);
  }
  const subByOnuId = new Map(existingSubs.map((s) => [s.onuId, s]));

  const items = [];
  const seenOnDevice = new Set();

  // ── What the OLT reports ──────────────────────────────────────────
  for (const onu of oltOnus) {
    const mac = normalizeMac(onu.mac);
    if (mac) seenOnDevice.add(mac);

    const known = mac ? existingOnuByMac.get(mac) : undefined;

    if (known) {
      items.push({
        source: "olt",
        externalKey: mac ?? onu.onuIndex ?? "",
        raw: onu,
        suggested: null,
        matchStatus: "matched",
        matchedEntity: "onu",
        matchedId: known.onuId,
      });
      continue;
    }

    // Unknown modem. Everything useful about it is in the free text the
    // previous operator typed, so parse that into a pre-filled import form.
    const session = mac ? macToSession.get(mac) : undefined;
    const account = session ? accountsByUsername.get(session.username) : undefined;

    items.push({
      source: "olt",
      externalKey: mac ?? onu.onuIndex ?? "",
      raw: onu,
      suggested: {
        ...parseOnuDescription(onu.description),
        onuIndex: onu.onuIndex ?? null,
        serialNo: onu.serialNo ?? null,
        model: onu.model ?? null,
        online: onu.online ?? null,
        account: account
          ? { username: account.username, profile: account.profile ?? null }
          : session
            ? { username: session.username, profile: null }
            : null,
      },
      matchStatus: "new",
      matchedEntity: null,
      matchedId: null,
    });
  }

  // ── What the router reports ───────────────────────────────────────
  //
  // Unreachable today — no RouterOS client exists. Kept so the bucketing rules
  // are settled in one place rather than bolted on later around the OLT path.
  for (const account of accounts) {
    const mac = usernameToMac.get(account.username) ?? null;
    const known = mac ? existingOnuByMac.get(mac) : undefined;

    if (known) {
      const subscription = subByOnuId.get(known.onuId);
      items.push({
        source: "mikrotik",
        externalKey: account.username,
        raw: account,
        suggested: null,
        matchStatus: "matched",
        matchedEntity: subscription ? "subscription" : "onu",
        matchedId: subscription ? subscription.subscriptionId : known.onuId,
      });
      continue;
    }

    items.push({
      source: "mikrotik",
      externalKey: account.username,
      raw: account,
      suggested: {
        username: account.username,
        profile: account.profile ?? null,
        disabled: account.disabled ?? null,
        comment: account.comment ?? null,
        // Null when the account has no active session — there is then no way
        // to know which modem it belongs to.
        mac,
      },
      matchStatus: "new",
      matchedEntity: null,
      matchedId: null,
    });
  }

  // ── What we have that the device does not ─────────────────────────
  //
  // Only when the OLT was actually swept. On a router-only run every ONU would
  // otherwise be flagged as orphaned, which is both wrong and alarming.
  //
  // An orphan is a flag and never a deletion: a modem drops off a sweep because
  // the fibre is cut, because it is unplugged while the family is away, because
  // a PON card is being swapped, or because the sweep read one port and not
  // another. None of those are reasons to destroy a billable subscription's
  // link to its hardware.
  if (oltOnus.length > 0) {
    for (const onu of existingOnus) {
      const mac = normalizeMac(onu.mac);
      if (mac && seenOnDevice.has(mac)) continue;

      items.push({
        source: "olt",
        externalKey: mac ?? onu.onuId,
        raw: { onuId: onu.onuId, mac: onu.mac, serialNo: onu.serialNo },
        suggested: null,
        matchStatus: "orphaned",
        matchedEntity: "onu",
        matchedId: onu.onuId,
      });
    }
  }

  const summary = { matched: 0, new: 0, orphaned: 0 };
  for (const item of items) summary[item.matchStatus] += 1;

  return { items, summary };
};

export default reconcile;
