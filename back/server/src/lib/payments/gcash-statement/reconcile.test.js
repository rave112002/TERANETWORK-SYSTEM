import { describe, expect, it } from "vitest";

import { reconcileStatement, referenceDistance } from "./reconcile.js";

const payment = (paymentId, referenceNo, amount = "1399.00") => ({
  paymentId,
  referenceNo,
  amount,
});
const txn = (transactionId, referenceNo, amount = "1399.00", reviewStatus = "open") => ({
  transactionId,
  referenceNo,
  amount,
  reviewStatus,
});

describe("referenceDistance", () => {
  it("counts the typos people make copying a reference", () => {
    expect(referenceDistance("5012345678901", "5012345678901")).toBe(0);
    expect(referenceDistance("5012345678901", "5012345678911")).toBe(1); // wrong digit
    expect(referenceDistance("5012345678901", "5012345687901")).toBe(1); // swapped neighbours
    expect(referenceDistance("5012345678901", "501234567890")).toBe(1); // dropped digit
    expect(referenceDistance("5012345678901", "50123456789011")).toBe(1); // extra digit
  });

  it("gives up early on unrelated references", () => {
    expect(referenceDistance("5012345678901", "9988776655443")).toBeGreaterThan(2);
  });
});

describe("reconcileStatement", () => {
  it("sorts every payment and line into exactly one result", () => {
    const result = reconcileStatement({
      payments: [
        payment("p-match", "5000000000001"),
        payment("p-amount", "5000000000002", "1399.00"),
        payment("p-missing", "7777777777777"),
      ],
      transactions: [
        txn("t-match", "5000000000001"),
        txn("t-amount", "5000000000002", "1379.00"),
        txn("t-unrecorded", "5000000000009", "850.00"),
        txn("t-personal", "5000000000010", "5000.00", "not_customer"),
      ],
    });

    expect(result.matched.map((m) => m.payment.paymentId)).toEqual(["p-match"]);
    expect(result.amountDiffers.map((m) => m.payment.paymentId)).toEqual(["p-amount"]);
    expect(result.recordedNotInFile.map((m) => m.payment.paymentId)).toEqual(["p-missing"]);
    expect(result.inFileNotRecorded.map((m) => m.transaction.transactionId)).toEqual([
      "t-unrecorded",
    ]);
    expect(result.notCustomer.map((m) => m.transaction.transactionId)).toEqual(["t-personal"]);
    expect(result.possibleTypos).toEqual([]);
  });

  it("compares amounts as money, not strings", () => {
    const result = reconcileStatement({
      payments: [payment("p", "5000000000001", 1399)],
      transactions: [txn("t", "5000000000001", "1399.00")],
    });
    expect(result.summary.matched).toBe(1);
  });

  it("pairs a mistyped reference with the line it was meant to be", () => {
    const result = reconcileStatement({
      payments: [payment("p-typo", "5012345687901"), payment("p-fake", "1111111111111")],
      transactions: [txn("t-real", "5012345678901"), txn("t-other", "5099999999999", "850.00")],
    });

    expect(result.summary.possibleTypos).toBe(1);
    expect(result.possibleTypos[0]).toMatchObject({
      payment: { paymentId: "p-typo" },
      transaction: { transactionId: "t-real" },
      distance: 1,
      sameAmount: true,
    });
  });

  it("does not suggest a line staff already marked as not a customer payment", () => {
    const result = reconcileStatement({
      payments: [payment("p", "5012345687901")],
      transactions: [txn("t", "5012345678901", "1399.00", "not_customer")],
    });
    expect(result.possibleTypos).toEqual([]);
  });

  it("lists the closest candidate first", () => {
    const result = reconcileStatement({
      payments: [payment("p", "5012345678901")],
      transactions: [txn("far", "5012345678999", "850.00"), txn("near", "5012345678902", "850.00")],
    });
    expect(result.possibleTypos.map((t) => t.transaction.transactionId)).toEqual(["near", "far"]);
  });

  it("allows less slack on short references", () => {
    const result = reconcileStatement({
      payments: [payment("p", "AB1234")],
      transactions: [txn("t", "AB1299")],
    });
    expect(result.possibleTypos).toEqual([]);
  });
});
