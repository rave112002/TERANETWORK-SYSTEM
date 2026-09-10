import { describe, expect, it } from "vitest";

import { targetStateFor } from "./provisioning.processor.js";

/**
 * Which state a device command is trying to reach.
 *
 * Two of the three answers are obvious. The third is the reason this is a
 * function and not the lookup table it used to be.
 */
describe("targetStateFor", () => {
  it("maps the ordinary commands", () => {
    expect(targetStateFor("deactivate", "dunning")).toBe("suspended");
    expect(targetStateFor("activate", "payment")).toBe("active");
    expect(targetStateFor("activate", "manual")).toBe("active");
  });

  it("has no target for a status read", () => {
    // A read must never write a provisioning state from the action alone.
    expect(targetStateFor("status", "manual")).toBeNull();
  });

  it("puts a recovered modem in stock, not back in service", () => {
    // On this OLT, activating IS `blacklist delete mac`. A modem collected from
    // a closed account needs exactly that command, or it is a brick the next
    // time a technician seats it — but it is going into a box, not to a
    // customer. Recording it as 'active' would put an unused modem into the
    // "modems up" figure on the dashboard and hide a real outage behind it.
    expect(targetStateFor("activate", "recovery")).toBe("unprovisioned");
  });
});
