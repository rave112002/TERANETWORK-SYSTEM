import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../config/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { logger } = await import("../../../config/logger.js");
const { gatewayStatusForBranch, providerForBranch, resolveGatewayForBranch } = await import(
  "./index.js"
);

/**
 * Choosing a gateway per branch.
 *
 * The client collects through HitPay in Taguig and wants GCash Business in
 * Batangas: one company, two merchant relationships, split by geography.
 *
 * ── The thing these tests are really guarding ───────────────────────────────
 *
 * Credentials still come from the environment, and only the CHOICE is per
 * branch. That split is what keeps webhook verification non-circular: a
 * callback is checked using the secret named by the provider slug in its URL,
 * before anything is known about whose invoice it is. Nothing here should ever
 * need a branch to verify a signature.
 */

/** A fake db returning one branch row. */
const branchRow = (paymentProvider) => ({
  query: async () => [{ paymentProvider }],
});

/** A fake db where the branch does not exist. */
const noBranch = { query: async () => [] };

let previous;

beforeEach(() => {
  previous = process.env.PAYMENT_PROVIDER;
  process.env.PAYMENT_PROVIDER = "mock";
  vi.clearAllMocks();
});

afterEach(() => {
  if (previous === undefined) delete process.env.PAYMENT_PROVIDER;
  else process.env.PAYMENT_PROVIDER = previous;
});

describe("providerForBranch", () => {
  it("uses the branch's own provider when it has one", async () => {
    expect(await providerForBranch(branchRow("hitpay"), "br-taguig")).toBe("hitpay");
  });

  it("follows the company default when the branch has none", async () => {
    // NULL is the normal state for a branch nobody has thought about, and
    // following the default is the right answer for it. A column defaulting to
    // a real slug would pin such a branch to whichever gateway happened to be
    // first, and it would keep working — on the wrong merchant account, until
    // somebody reconciled the statements.
    expect(await providerForBranch(branchRow(null), "br-new")).toBe("mock");
    expect(await providerForBranch(branchRow(""), "br-new")).toBe("mock");
  });

  it("follows the company default for a branch that does not exist", async () => {
    expect(await providerForBranch(noBranch, "br-gone")).toBe("mock");
  });

  it("does not query at all without a branch", async () => {
    let queried = false;
    const db = { query: async () => { queried = true; return []; } };

    expect(await providerForBranch(db, null)).toBe("mock");
    expect(queried).toBe(false);
  });

  it("falls back loudly for a provider with no adapter", async () => {
    // A typo in a settings field must not take down a branch's billing. It
    // collects through the company default and says so in the log, rather than
    // throwing on every Pay button.
    expect(await providerForBranch(branchRow("paymaya"), "br-typo")).toBe("mock");
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error.mock.calls[0][0]).toContain("paymaya");
    expect(logger.error.mock.calls[0][0]).toContain("br-typo");
  });

  it("says nothing when the branch is configured correctly", async () => {
    await providerForBranch(branchRow("hitpay"), "br-taguig");
    expect(logger.error).not.toHaveBeenCalled();
  });
});

describe("resolveGatewayForBranch", () => {
  it("hands back the branch's adapter", async () => {
    const gateway = await resolveGatewayForBranch(branchRow("hitpay"), "br-taguig");
    expect(gateway.name).toBe("hitpay");
  });

  it("hands back the company default for an unset branch", async () => {
    const gateway = await resolveGatewayForBranch(branchRow(null), "br-new");
    expect(gateway.name).toBe("mock");
  });

  it("lets two branches of one company collect through different gateways", async () => {
    // The whole point of the column.
    const taguig = await resolveGatewayForBranch(branchRow("hitpay"), "br-taguig");
    const batangas = await resolveGatewayForBranch(branchRow("mock"), "br-batangas");

    expect(taguig.name).toBe("hitpay");
    expect(batangas.name).toBe("mock");
  });
});

describe("gatewayStatusForBranch", () => {
  it("reports the branch's gateway, not the company's", async () => {
    // The pay page uses this to decide whether to show a Pay button at all.
    // Asking about the company default instead would show no button where
    // checkout would have worked, or a button that leads nowhere.
    const status = await gatewayStatusForBranch(branchRow("hitpay"), "br-taguig");

    expect(status.provider).toBe("hitpay");
    expect(status.label).toBe("HitPay");
  });

  it("lists every adapter, so a branch form can offer them", async () => {
    const status = await gatewayStatusForBranch(branchRow(null), "br-new");
    expect(status.available).toContain("mock");
    expect(status.available).toContain("hitpay");
  });
});
