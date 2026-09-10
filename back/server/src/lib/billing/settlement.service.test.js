import { describe, expect, it, vi } from "vitest";

vi.mock("../jobs/jobs.queue.js", () => ({
  enqueue: vi.fn(async () => ({ jobId: "job-1", deduped: false })),
}));

const { enqueue } = await import("../jobs/jobs.queue.js");
const { queueReconnectionIfSettled } = await import("./settlement.service.js");

/**
 * Who gets their service back when a payment lands.
 *
 * This is one `!==` in the settlement path, and it is the entire enforcement of
 * the client's rule that a revoked account cannot buy its way back. Worth its
 * own tests, because the failure is silent and generous: somebody the business
 * wrote off, and is trying to collect a modem from, quietly back online.
 */

/**
 * A fake transaction connection. `rows` is keyed by what the SQL is asking for,
 * because `queueReconnectionIfSettled` makes two very different queries.
 */
const fakeConn = ({ subscription, outstanding = 0 }) => ({
  execute: async (sql) => {
    if (/FROM subscriptions/.test(sql)) return [subscription ? [subscription] : []];
    if (/COUNT\(\*\) AS n FROM invoices/.test(sql)) return [[{ n: outstanding }]];
    throw new Error(`unexpected query: ${sql}`);
  },
});

const INVOICE = {
  invoiceId: "inv-1",
  subscriptionId: "sub-1",
  companyId: "co-1",
  branchId: "br-1",
};

describe("queueReconnectionIfSettled", () => {
  it("reconnects a suspended customer who has settled everything", async () => {
    const conn = fakeConn({
      subscription: { subscriptionId: "sub-1", status: "suspended", onuId: "onu-1" },
    });

    expect(await queueReconnectionIfSettled(conn, INVOICE)).toBe(true);
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue.mock.calls[0][1]).toMatchObject({
      type: "activate",
      payload: expect.objectContaining({ onuId: "onu-1", reason: "payment" }),
    });
  });

  it("does NOT reconnect an account marked for pull-out", async () => {
    // The client's rule: once revoked, paying settles the debt but does not buy
    // the service back. Coming back is a new subscription with a new
    // installation fee. Without this the payment path would hand the internet
    // back to somebody a technician is on their way to collect a modem from.
    vi.clearAllMocks();
    const conn = fakeConn({
      subscription: { subscriptionId: "sub-1", status: "for_recovery", onuId: "onu-1" },
    });

    expect(await queueReconnectionIfSettled(conn, INVOICE)).toBe(false);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("does not reconnect a terminated account", async () => {
    vi.clearAllMocks();
    const conn = fakeConn({
      subscription: { subscriptionId: "sub-1", status: "terminated", onuId: null },
    });

    expect(await queueReconnectionIfSettled(conn, INVOICE)).toBe(false);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("does not reconnect somebody who was never cut off", async () => {
    vi.clearAllMocks();
    const conn = fakeConn({
      subscription: { subscriptionId: "sub-1", status: "active", onuId: "onu-1" },
    });

    expect(await queueReconnectionIfSettled(conn, INVOICE)).toBe(false);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("holds back while another invoice is still unpaid", async () => {
    // Three overdue bills, one paid, still disconnected — deliberately, because
    // the other two are still owed.
    vi.clearAllMocks();
    const conn = fakeConn({
      subscription: { subscriptionId: "sub-1", status: "suspended", onuId: "onu-1" },
      outstanding: 2,
    });

    expect(await queueReconnectionIfSettled(conn, INVOICE)).toBe(false);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("does nothing when there is no modem to switch back on", async () => {
    vi.clearAllMocks();
    const conn = fakeConn({
      subscription: { subscriptionId: "sub-1", status: "suspended", onuId: null },
    });

    expect(await queueReconnectionIfSettled(conn, INVOICE)).toBe(false);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("dedupes per invoice, not per subscription", async () => {
    // A customer suspended, paying, suspended again next month and paying again
    // needs two reconnections — a subscription-level key would swallow the
    // second one and leave them off.
    vi.clearAllMocks();
    const conn = fakeConn({
      subscription: { subscriptionId: "sub-1", status: "suspended", onuId: "onu-1" },
    });

    await queueReconnectionIfSettled(conn, INVOICE);
    expect(enqueue.mock.calls[0][1].dedupeKey).toBe("activate:payment:inv-1");
  });
});
