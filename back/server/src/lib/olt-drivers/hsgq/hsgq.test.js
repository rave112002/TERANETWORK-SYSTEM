import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  buildActivate,
  buildDeactivate,
  buildListOnus,
  buildStatus,
  parseOnuIndex,
} from "./commands.js";
import { parseOnuInfoAll, parseOpticalRssi } from "./parsers.js";
import { HsgqOltDriver } from "./driver.js";

/**
 * HSGQ XE04I driver.
 *
 * The command syntax below is not a guess: it was verified on the bench in July
 * 2026 against firmware HSGQ-XE04I_I_V3.3.6C_Rel. See
 * `docs/vendor-transcripts/hsgq-xe04i/HSGQ-XE04I-CLI-Validation.md`.
 *
 * These tests exist because getting the suspend sequence wrong is not a bug
 * that shows up in staging — it is a customer who stays connected while the
 * system reports them cut off, or vice versa.
 */

const MAC = "30:c5:0f:d8:7f:2c";
const CTX = { onuIndex: "1/27", mac: MAC };

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

describe("deactivate — the suspend sequence", () => {
  it("blacklists the MAC AND deregisters", () => {
    // Both, and in this order. A bare deregister is not a suspension: the bench
    // showed the ONU re-registering via MPCP within ~33 seconds. The blacklist
    // is what holds it down.
    const plan = buildDeactivate(CTX);
    expect(plan.commands).toEqual([`blacklist add mac ${MAC}`, "onu-deregister 27"]);
  });

  it("enters the right EPON interface", () => {
    expect(buildDeactivate(CTX).interface).toBe("epon 1");
  });

  it("SAVES — the blacklist only survives a reboot if written to flash", () => {
    // Bench-verified: blacklist + `copy running-config startup-config` survived
    // a power cycle. Without the save, a reboot silently reconnects everyone
    // who was suspended for non-payment.
    expect(buildDeactivate(CTX).save).toBe(true);
  });

  it("refuses to build without a MAC, because the blacklist is by MAC", () => {
    expect(() => buildDeactivate({ onuIndex: "1/27" })).toThrow(/MAC/i);
  });
});

describe("activate — the restore sequence", () => {
  it("only removes the MAC from the blacklist", () => {
    // The ONU re-registers on its own once un-blacklisted (bench-confirmed).
    expect(buildActivate(CTX).commands).toEqual([`blacklist delete mac ${MAC}`]);
  });

  it("does NOT use onu-authorize", () => {
    // `onu-authorize` is a GLOBAL auth-mode command, not a per-ONU action — the
    // bench report is explicit. Using it here would silently fail to reconnect
    // anyone while appearing to succeed.
    const text = JSON.stringify(buildActivate(CTX));
    expect(text).not.toMatch(/onu-authorize/);
  });

  it("saves, so the un-blacklisting also survives a reboot", () => {
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

describe("parseOpticalRssi", () => {
  it("reads the bench's real optical output", () => {
    const raw = [
      "PON/ONU      1/27",
      "MAC          30:c5:0f:d8:7f:2c",
      "Temperature 53 C",
      "Voltage     3.30 V",
      "Bias        9 mA",
      "TX Power    2.1439 dBm",
      "RX Power   -11.8376 dBm",
    ].join("\n");

    expect(parseOpticalRssi(raw)).toEqual({ rxDbm: -11.8376, txDbm: 2.1439 });
  });

  it("returns null rather than a wrong number when a level is absent", () => {
    // A blacklisted ONU prints nothing at all — that must read as "unknown",
    // never as 0 dBm, which would look like a perfect signal.
    expect(parseOpticalRssi("")).toEqual({ rxDbm: null, txDbm: null });
    expect(parseOpticalRssi("(no output)")).toEqual({ rxDbm: null, txDbm: null });
  });

  it("copes with different spacing and casing", () => {
    expect(parseOpticalRssi("Rx power: -16.07dBm")).toMatchObject({ rxDbm: -16.07 });
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
      "onu-deregister 27",
      "copy running-config startup-config",
    ]);
  });

  it("covers activate and status too", () => {
    expect(driver.describe("activate", CTX)).toContain(`blacklist delete mac ${MAC}`);
    expect(driver.describe("status", CTX)).toContain("show onu-info all");
  });

  it("opens no session — it is pure text", () => {
    // No host, port or credentials in the context: if describe() tried to
    // connect, this would throw.
    expect(() => driver.describe("deactivate", { onuIndex: "1/27", mac: MAC })).not.toThrow();
  });
});
