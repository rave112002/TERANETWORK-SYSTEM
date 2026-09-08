import { describe, expect, it } from "vitest";

import { reconcile } from "./reconcile.js";
import { buildSessionMacIndex, normalizeMac, parseOnuDescription } from "./reconcile.helpers.js";

const onDevice = (overrides = {}) => ({
  mac: "30:c5:0f:d8:7f:2c",
  onuIndex: "1/27",
  serialNo: "45V5",
  model: "Huawei EG8145V5",
  description: "Jacqueline-Rebancos PON 2 NAP 1 PORT 5",
  online: true,
  ...overrides,
});

describe("normalizeMac", () => {
  it("reads every spelling of the same address as the same address", () => {
    // The whole point: an OLT's lowercase and a MikroTik's uppercase are one
    // modem. Treating them as two is how a customer ends up with duplicate
    // hardware in the system.
    const canonical = "30:c5:0f:d8:7f:2c";
    expect(normalizeMac("30:C5:0F:D8:7F:2C")).toBe(canonical);
    expect(normalizeMac("30-c5-0f-d8-7f-2c")).toBe(canonical);
    expect(normalizeMac("30c5.0fd8.7f2c")).toBe(canonical);
    expect(normalizeMac("30c50fd87f2c")).toBe(canonical);
    expect(normalizeMac("  30:c5:0f:d8:7f:2c  ")).toBe(canonical);
  });

  it("returns null rather than a guess for anything that is not a MAC", () => {
    expect(normalizeMac("not-a-mac")).toBeNull();
    expect(normalizeMac("30:c5:0f:d8:7f")).toBeNull();
    expect(normalizeMac("30:c5:0f:d8:7f:2c:99")).toBeNull();
    expect(normalizeMac("")).toBeNull();
    expect(normalizeMac(null)).toBeNull();
    expect(normalizeMac(undefined)).toBeNull();
    expect(normalizeMac(12345)).toBeNull();
  });

  it("rejects twelve non-hex characters", () => {
    expect(normalizeMac("zzzzzzzzzzzz")).toBeNull();
  });
});

describe("parseOnuDescription", () => {
  it("reads the format the previous operator actually used", () => {
    expect(parseOnuDescription("Jacqueline-Rebancos PON 2 NAP 1 PORT 5")).toMatchObject({
      name: "Jacqueline-Rebancos",
      pon: 2,
      nap: 1,
      port: 5,
    });
  });

  it("copes with punctuation and casing variants", () => {
    expect(parseOnuDescription("Dela Cruz, pon:1 nap-3 port#7")).toMatchObject({
      name: "Dela Cruz",
      pon: 1,
      nap: 3,
      port: 7,
    });
  });

  it("returns null for pieces that are not there, rather than guessing", () => {
    expect(parseOnuDescription("Maria Santos")).toMatchObject({
      name: "Maria Santos",
      pon: null,
      nap: null,
      port: null,
    });
  });

  it("handles a description with only a location", () => {
    expect(parseOnuDescription("PON 3 NAP 2")).toMatchObject({ name: null, pon: 3, nap: 2 });
  });

  it("does not mistake a word containing a keyword for a location", () => {
    // "Newport" must not be read as PORT. The leading \b is what stops it.
    expect(parseOnuDescription("Newport Residences").name).toBe("Newport Residences");
    expect(parseOnuDescription("Newport Residences").port).toBeNull();
  });

  it("splits even when the number is glued to the keyword", () => {
    expect(parseOnuDescription("Reyes pon2 nap1")).toMatchObject({
      name: "Reyes",
      pon: 2,
      nap: 1,
    });
  });

  it("survives empty and non-string input", () => {
    expect(parseOnuDescription("")).toMatchObject({ name: null, raw: "" });
    expect(parseOnuDescription(null)).toMatchObject({ name: null, raw: "" });
    expect(parseOnuDescription(undefined)).toMatchObject({ name: null, raw: "" });
  });

  it("keeps the original text alongside the reading of it", () => {
    // The parse is a guess; the raw string is the evidence.
    const raw = "Jacqueline-Rebancos PON 2 NAP 1 PORT 5";
    expect(parseOnuDescription(raw).raw).toBe(raw);
  });
});

describe("reconcile — bucketing", () => {
  it("calls a modem we already know 'matched'", () => {
    const { items, summary } = reconcile({
      oltOnus: [onDevice()],
      existing: { onus: [{ onuId: "onu-1", mac: "30:c5:0f:d8:7f:2c" }] },
    });

    expect(summary).toEqual({ matched: 1, new: 0, orphaned: 0 });
    expect(items[0]).toMatchObject({
      matchStatus: "matched",
      matchedEntity: "onu",
      matchedId: "onu-1",
    });
  });

  it("matches across different MAC spellings", () => {
    // The device shouts, our record whispers. Same modem.
    const { summary } = reconcile({
      oltOnus: [onDevice({ mac: "30:C5:0F:D8:7F:2C" })],
      existing: { onus: [{ onuId: "onu-1", mac: "30-c5-0f-d8-7f-2c" }] },
    });

    expect(summary.matched).toBe(1);
    expect(summary.new).toBe(0);
  });

  it("calls a modem we have never seen 'new'", () => {
    const { items, summary } = reconcile({
      oltOnus: [onDevice()],
      existing: { onus: [] },
    });

    expect(summary).toEqual({ matched: 0, new: 1, orphaned: 0 });
    expect(items[0].matchStatus).toBe("new");
    expect(items[0].matchedId).toBeNull();
  });

  it("attaches parsed hints to a new modem, for the import form", () => {
    const { items } = reconcile({ oltOnus: [onDevice()], existing: { onus: [] } });

    expect(items[0].suggested).toMatchObject({
      name: "Jacqueline-Rebancos",
      pon: 2,
      nap: 1,
      port: 5,
      onuIndex: "1/27",
      serialNo: "45V5",
    });
  });

  it("attaches no hints to a matched modem — there is nothing to fill in", () => {
    const { items } = reconcile({
      oltOnus: [onDevice()],
      existing: { onus: [{ onuId: "onu-1", mac: "30:c5:0f:d8:7f:2c" }] },
    });

    expect(items[0].suggested).toBeNull();
  });

  it("flags a modem we have that the device did not report as 'orphaned'", () => {
    const { items, summary } = reconcile({
      oltOnus: [onDevice()],
      existing: {
        onus: [
          { onuId: "onu-1", mac: "30:c5:0f:d8:7f:2c" },
          { onuId: "onu-2", mac: "48:57:02:11:22:33" },
        ],
      },
    });

    expect(summary).toEqual({ matched: 1, new: 0, orphaned: 1 });
    const orphan = items.find((i) => i.matchStatus === "orphaned");
    expect(orphan.matchedId).toBe("onu-2");
  });

  it("treats a record with no usable MAC as orphaned rather than matched", () => {
    // It cannot be joined to anything the device said, so it has to surface for
    // a person. Silently calling it matched would hide a broken record.
    const { items } = reconcile({
      oltOnus: [onDevice()],
      existing: { onus: [{ onuId: "onu-x", mac: null, serialNo: "ABC" }] },
    });

    expect(items.find((i) => i.matchedId === "onu-x").matchStatus).toBe("orphaned");
  });

  it("flags NOTHING as orphaned when the OLT was not swept", () => {
    // The dangerous case. A run that read no ONUs must not conclude that every
    // modem in the database has vanished.
    const { items, summary } = reconcile({
      oltOnus: [],
      existing: { onus: [{ onuId: "onu-1", mac: "30:c5:0f:d8:7f:2c" }] },
    });

    expect(summary.orphaned).toBe(0);
    expect(items).toHaveLength(0);
  });

  it("handles an empty everything without throwing", () => {
    expect(reconcile()).toEqual({ items: [], summary: { matched: 0, new: 0, orphaned: 0 } });
    expect(reconcile({})).toEqual({ items: [], summary: { matched: 0, new: 0, orphaned: 0 } });
  });

  it("uses the ONU index as a key when the device reports no MAC", () => {
    const { items } = reconcile({
      oltOnus: [onDevice({ mac: null })],
      existing: { onus: [] },
    });

    expect(items[0].externalKey).toBe("1/27");
    expect(items[0].matchStatus).toBe("new");
  });

  it("counts a full mixed sweep correctly", () => {
    const { summary } = reconcile({
      oltOnus: [
        onDevice({ mac: "30:c5:0f:d8:7f:2c" }),
        onDevice({ mac: "48:57:02:11:22:33" }),
        onDevice({ mac: "aa:bb:cc:dd:ee:ff" }),
      ],
      existing: {
        onus: [
          { onuId: "onu-1", mac: "30:c5:0f:d8:7f:2c" },
          { onuId: "onu-2", mac: "48:57:02:11:22:33" },
          { onuId: "onu-3", mac: "11:22:33:44:55:66" },
        ],
      },
    });

    // Two known, one new, one of ours the device did not report.
    expect(summary).toEqual({ matched: 2, new: 1, orphaned: 1 });
  });

  it("writes nothing and mutates nothing it was given", () => {
    const existing = { onus: [{ onuId: "onu-1", mac: "30:c5:0f:d8:7f:2c" }] };
    const oltOnus = [onDevice()];
    const before = JSON.stringify({ existing, oltOnus });

    reconcile({ oltOnus, existing });

    expect(JSON.stringify({ existing, oltOnus })).toBe(before);
  });
});

describe("reconcile — the router half, which nothing produces yet", () => {
  it("links a new account to a modem through its session's caller-id", () => {
    const { items } = reconcile({
      oltOnus: [onDevice()],
      accounts: [{ username: "juan.dc", profile: "50Mbps" }],
      sessions: [{ username: "juan.dc", callerId: "30:C5:0F:D8:7F:2C" }],
      existing: { onus: [] },
    });

    const modem = items.find((i) => i.source === "olt");
    expect(modem.suggested.account).toMatchObject({ username: "juan.dc", profile: "50Mbps" });
  });

  it("matches an account to a subscription when we already know the modem", () => {
    const { items } = reconcile({
      oltOnus: [onDevice()],
      accounts: [{ username: "juan.dc" }],
      sessions: [{ username: "juan.dc", callerId: "30:c5:0f:d8:7f:2c" }],
      existing: {
        onus: [{ onuId: "onu-1", mac: "30:c5:0f:d8:7f:2c" }],
        subscriptions: [{ subscriptionId: "sub-1", onuId: "onu-1" }],
      },
    });

    const account = items.find((i) => i.source === "mikrotik");
    expect(account).toMatchObject({ matchStatus: "matched", matchedEntity: "subscription", matchedId: "sub-1" });
  });

  it("leaves an account's MAC null when it has no active session", () => {
    const { items } = reconcile({
      accounts: [{ username: "offline.user" }],
      sessions: [],
      existing: { onus: [] },
    });

    // No session means no way to know which modem it is on. Null, not a guess.
    expect(items[0].suggested.mac).toBeNull();
  });
});

describe("buildSessionMacIndex", () => {
  it("indexes both ways", () => {
    const { macToSession, usernameToMac } = buildSessionMacIndex([
      { username: "juan.dc", callerId: "30:C5:0F:D8:7F:2C" },
    ]);

    expect(macToSession.get("30:c5:0f:d8:7f:2c").username).toBe("juan.dc");
    expect(usernameToMac.get("juan.dc")).toBe("30:c5:0f:d8:7f:2c");
  });

  it("skips a session whose caller-id is not a MAC", () => {
    // Attaching an account to the wrong modem is worse than not attaching it.
    const { macToSession, usernameToMac } = buildSessionMacIndex([
      { username: "no.mac", callerId: "unknown" },
    ]);

    expect(macToSession.size).toBe(0);
    expect(usernameToMac.size).toBe(0);
  });

  it("survives an empty list", () => {
    expect(buildSessionMacIndex().macToSession.size).toBe(0);
  });
});
