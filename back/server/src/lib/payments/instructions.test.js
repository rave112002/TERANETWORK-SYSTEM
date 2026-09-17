import { describe, expect, it } from "vitest";

import { getPaymentInstructions, paymentInstructionLines } from "./instructions.js";
import { updateSettingsSchema } from "../../validators/settings.validator.js";

const full = {
  gcashNumber: "0912 3456 789",
  gcashAccountName: "JUAN DELA CRUZ",
  facebookPageUrl: "https://facebook.com/teranetwork",
};

describe("paymentInstructionLines", () => {
  it("names the amount, number, account name, page and account number", () => {
    const text = paymentInstructionLines({
      instructions: full,
      total: "1399",
      accountNo: "ACC-000001",
    }).join("\n");
    expect(text).toContain("Send PHP 1,399.00 by GCash to 0912 3456 789 (JUAN DELA CRUZ)");
    expect(text).toContain("https://facebook.com/teranetwork");
    expect(text).toContain("ACC-000001");
    expect(text).toMatch(/Maya or a bank app/);
  });

  it("numbers the steps, asks for the account number in the GCash message, and puts the link on its own line", () => {
    expect(
      paymentInstructionLines({ instructions: full, total: "699", accountNo: "ACC-000001" })
    ).toEqual([
      "1. Send PHP 699.00 by GCash to 0912 3456 789 (JUAN DELA CRUZ).",
      "   Paying from Maya or a bank app? Send it to the same GCash number.",
      "2. Before sending, write your account number ACC-000001 in the GCash message.",
      "3. Send a screenshot of your payment to our Facebook page:",
      "   https://facebook.com/teranetwork",
    ]);
  });

  it("renumbers when there is no account number to ask for", () => {
    const lines = paymentInstructionLines({ instructions: full, total: "699" });
    expect(lines[2]).toBe("2. Send a screenshot of your payment to our Facebook page:");
  });

  it("still tells the customer what to do when settings are blank", () => {
    expect(paymentInstructionLines({ instructions: {}, total: 1399 })).toEqual([
      "To pay, please contact TERANETWORK.",
    ]);
    expect(
      paymentInstructionLines({
        instructions: { facebookPageUrl: full.facebookPageUrl },
        total: 1,
      })[0]
    ).toContain(full.facebookPageUrl);
  });

  it("leaves out the brackets when there is no account name", () => {
    const [first] = paymentInstructionLines({
      instructions: { gcashNumber: "0912 3456 789" },
      total: 850,
    });
    expect(first).toBe("1. Send PHP 850.00 by GCash to 0912 3456 789.");
  });
});

describe("getPaymentInstructions", () => {
  it("reads the invoice's own branch and treats blank values as unset", async () => {
    const calls = [];
    const db = {
      query: (_sql, params) => {
        calls.push(params);
        return Promise.resolve([
          { settingKey: "gcashNumber", settingValue: "0912 3456 789" },
          { settingKey: "facebookPageUrl", settingValue: "" },
        ]);
      },
    };
    const result = await getPaymentInstructions(db, { companyId: "c1", branchId: "b1" });
    expect(calls[0].slice(0, 2)).toEqual(["c1", "b1"]);
    expect(result).toEqual({
      gcashNumber: "0912 3456 789",
      gcashAccountName: null,
      facebookPageUrl: null,
      invoiceTerms: null,
    });
  });
});

describe("updateSettingsSchema — payment settings", () => {
  it("stores the GCash number in the canonical phone format", () => {
    expect(updateSettingsSchema.parse({ gcashNumber: "+639123456789" }).gcashNumber).toBe(
      "0912 3456 789"
    );
  });

  it("refuses a Facebook link that is not http(s)", () => {
    expect(updateSettingsSchema.safeParse({ facebookPageUrl: "facebook.com/x" }).success).toBe(
      false
    );
    expect(updateSettingsSchema.safeParse({ facebookPageUrl: "ftp://example.com/x" }).success).toBe(
      false
    );
    expect(
      updateSettingsSchema.safeParse({ facebookPageUrl: "https://facebook.com/x" }).success
    ).toBe(true);
  });

  it("lets every payment setting be cleared", () => {
    const out = updateSettingsSchema.parse({
      gcashNumber: "",
      gcashAccountName: "",
      facebookPageUrl: "",
    });
    expect(Object.keys(out)).toEqual(["gcashNumber", "gcashAccountName", "facebookPageUrl"]);
    expect(Object.values(out)).toEqual([undefined, undefined, undefined]);
  });
});
