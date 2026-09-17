import { describe, expect, it } from "vitest";

import { parseGcashStatement, parseLeadingDateTime } from "./parser.js";

/**
 * Lines are built the way `readPdfLines()` returns them. Each cell is
 * [text, x]; width is estimated at 5 units per character.
 */
const line = (y, cells, page = 1) => ({
  page,
  y,
  pieces: cells.map(([str, x]) => ({ str, x, width: str.length * 5 })),
});

// Column x positions for a statement with headings.
const COL = { date: 20, desc: 120, ref: 330, debit: 420, credit: 480, balance: 540 };
const header = (y, page = 1) =>
  line(
    y,
    [
      ["Date and Time", COL.date],
      ["Description", COL.desc],
      ["Reference No.", COL.ref],
      ["Debit", COL.debit],
      ["Credit", COL.credit],
      ["Balance", COL.balance],
    ],
    page
  );
const row = (y, { date, desc, ref, debit, credit, balance }, page = 1) =>
  line(
    y,
    [
      [date, COL.date],
      [desc, COL.desc],
      [ref, COL.ref],
      debit ? [debit, COL.debit] : null,
      credit ? [credit, COL.credit] : null,
      [balance, COL.balance],
    ].filter(Boolean),
    page
  );

describe("parseLeadingDateTime", () => {
  it("reads the formats a GCash history might use", () => {
    expect(parseLeadingDateTime("2026-08-01 10:15 PM Received")?.value).toBe("2026-08-01 22:15:00");
    expect(parseLeadingDateTime("08/01/2026 12:05 AM x")?.value).toBe("2026-08-01 00:05:00");
    expect(parseLeadingDateTime("Aug 1, 2026 9:07 AM x")?.value).toBe("2026-08-01 09:07:00");
    expect(parseLeadingDateTime("2026-08-01 14:30:59")?.value).toBe("2026-08-01 14:30:59");
  });

  it("ignores text that does not start with a date and time", () => {
    expect(parseLeadingDateTime("Received GCash 2026-08-01 10:15 AM")).toBeNull();
    expect(parseLeadingDateTime("2026-08-01")).toBeNull();
    expect(parseLeadingDateTime("2026-13-01 10:15 AM")).toBeNull();
  });
});

describe("parseGcashStatement — with column headings", () => {
  const lines = [
    line(40, [["GCash Transaction History", 20]]),
    line(60, [["2026-08-01 to 2026-08-31", 20]]),
    line(80, [
      ["STARTING BALANCE", 20],
      ["100.00", COL.balance],
    ]),
    header(100),
    row(120, {
      date: "2026-08-02 09:15 AM",
      desc: "Received GCash from 09171234567",
      ref: "5012345678901",
      credit: "1,399.00",
      balance: "1,499.00",
    }),
    row(140, {
      date: "2026-08-02 11:00 AM",
      desc: "Payment to MERALCO",
      ref: "5012345678902",
      debit: "500.00",
      balance: "999.00",
    }),
    row(160, {
      date: "2026-08-03 08:00 PM",
      desc: "Received money via InstaPay from",
      ref: "5012345678903",
      credit: "850.00",
      balance: "1,849.00",
    }),
    line(172, [["BPI account ending 1234", COL.desc]]),
    line(200, [
      ["ENDING BALANCE", 20],
      ["1,849.00", COL.balance],
    ]),
    line(215, [
      ["Total Credit", 20],
      ["2,249.00", COL.credit],
    ]),
  ];

  const result = parseGcashStatement(lines);

  it("finds every row and which way the money went", () => {
    expect(result.headerFound).toBe(true);
    expect(result.transactions).toHaveLength(3);
    expect(result.transactions.map((t) => t.direction)).toEqual(["credit", "debit", "credit"]);
    expect(result.transactions.map((t) => t.amount)).toEqual(["1399.00", "500.00", "850.00"]);
  });

  it("keeps a phone number in the description out of the reference", () => {
    expect(result.transactions[0].referenceNo).toBe("5012345678901");
    expect(result.transactions[0].description).toBe("Received GCash from 09171234567");
  });

  it("joins a wrapped description onto its row", () => {
    expect(result.transactions[2].description).toBe(
      "Received money via InstaPay from BPI account ending 1234"
    );
  });

  it("reads the statement period from the heading", () => {
    expect(result.periodStart).toBe("2026-08-01");
    expect(result.periodEnd).toBe("2026-08-31");
  });

  it("checks incoming money against the statement's own total", () => {
    expect(result.totalCredit).toBe("2249.00");
    expect(result.warnings).toEqual([]);
  });

  it("warns when the total does not add up, instead of trusting a partial read", () => {
    const short = parseGcashStatement(lines.filter((l) => l.y !== 160 && l.y !== 172));
    expect(short.warnings.join(" ")).toMatch(/total credit/i);
  });

  it("joins a reference printed in groups", () => {
    const grouped = parseGcashStatement([
      header(100),
      line(120, [
        ["2026-08-02 09:15 AM", COL.date],
        ["Received GCash", COL.desc],
        ["5012", COL.ref],
        ["345", COL.ref + 25],
        ["678901", COL.ref + 45],
        ["1,399.00", COL.credit],
        ["1,499.00", COL.balance],
      ]),
    ]);
    expect(grouped.transactions[0].referenceNo).toBe("5012345678901");
  });

  it("carries the headings across pages", () => {
    const twoPages = parseGcashStatement([
      header(100, 1),
      row(
        120,
        {
          date: "2026-08-02 09:15 AM",
          desc: "a",
          ref: "5012345678901",
          credit: "1.00",
          balance: "1.00",
        },
        1
      ),
      line(20, [["Page 2 of 2", 20]], 2),
      header(40, 2),
      row(
        60,
        {
          date: "2026-08-09 09:15 AM",
          desc: "b",
          ref: "5012345678909",
          credit: "2.00",
          balance: "3.00",
        },
        2
      ),
    ]);
    expect(twoPages.transactions.map((t) => t.referenceNo)).toEqual([
      "5012345678901",
      "5012345678909",
    ]);
    expect(twoPages.periodStart).toBe("2026-08-02");
    expect(twoPages.periodEnd).toBe("2026-08-09");
  });
});

describe("parseGcashStatement — without column headings", () => {
  const bare = (y, date, desc, ref, amount, balance) =>
    line(y, [
      [date, 20],
      [desc, 120],
      [ref, 330],
      [amount, 450],
      [balance, 540],
    ]);

  it("works out the direction from the running balance", () => {
    const result = parseGcashStatement([
      line(80, [
        ["Starting balance", 20],
        ["100.00", 540],
      ]),
      bare(120, "2026-08-02 09:15 AM", "Received GCash", "5012345678901", "1,399.00", "1,499.00"),
      bare(140, "2026-08-02 11:00 AM", "Sent GCash", "5012345678902", "500.00", "999.00"),
    ]);
    expect(result.headerFound).toBe(false);
    expect(result.transactions.map((t) => t.direction)).toEqual(["credit", "debit"]);
  });

  it("handles newest-first order", () => {
    const result = parseGcashStatement([
      bare(120, "2026-08-02 11:00 AM", "Sent GCash", "5012345678902", "500.00", "999.00"),
      bare(140, "2026-08-02 09:15 AM", "Received GCash", "5012345678901", "1,399.00", "1,499.00"),
      bare(160, "2026-08-01 09:15 AM", "Received GCash", "5012345678900", "100.00", "100.00"),
    ]);
    const byRef = Object.fromEntries(result.transactions.map((t) => [t.referenceNo, t.direction]));
    expect(byRef["5012345678902"]).toBe("debit");
    expect(byRef["5012345678901"]).toBe("credit");
  });

  it("says so when a row cannot be placed", () => {
    const result = parseGcashStatement([
      bare(120, "2026-08-02 09:15 AM", "Received GCash", "5012345678901", "1,399.00", "9,999.00"),
    ]);
    expect(result.transactions[0].direction).toBeNull();
    expect(result.warnings.join(" ")).toMatch(/could not tell/i);
  });
});

/**
 * The layout of a real GCash transaction history (personal account), rebuilt
 * from `npm run gcash:inspect` output on 2026-09-17: same x and y positions,
 * made-up values. Two-line descriptions are centred on their row, so their
 * first line sits ABOVE the row's date — the case that used to steal a line
 * for the row before.
 */
describe("parseGcashStatement — real GCash layout", () => {
  // The real statement's small font: about 3.3 PDF units per character.
  const line = (y, cells, page = 1) => ({
    page,
    y,
    pieces: cells.map(([str, x]) => ({ str, x, width: str.length * 3.3 })),
  });

  const real = [
    line(46, [["GCash Transaction History", 184]]),
    line(72, [["2026-09-01 to 2026-09-17", 247]]),
    line(93, [
      ["Date and Time", 50],
      ["Description", 211],
      ["Reference No.", 341],
      ["Debit", 427],
      ["Credit", 476],
      ["Balance", 524],
    ]),
    line(104, [
      ["STARTING BALANCE", 126],
      ["5.00", 533],
    ]),
    line(115, [
      ["2026-09-02 09:15 AM", 50],
      ["Transfer from 09171234567 to 09451234567", 126],
      ["5001000000001", 329],
      ["1399.00", 473],
      ["1404.00", 524],
    ]),
    line(126, [
      ["2026-09-03 10:00 AM", 50],
      ["Sent GCash to BPI Savings, Inc. with account ending in 1234", 126],
      ["5001000000002", 329],
      ["1399.00", 421],
      ["5.00", 533],
    ]),
    line(137, [["Received GCash from InstaPay with account ending in 5678 and", 126]]),
    line(140, [
      ["2026-09-04 11:00 AM", 50],
      ["5001000000003", 329],
      ["850.00", 476],
      ["855.00", 527],
    ]),
    line(144, [["invno:20260904ABCDEFG1HIJK123456789012345", 126]]),
    line(155, [
      ["2026-09-05 12:00 PM", 50],
      ["Transfer from 09181234567 to 09451234567", 126],
      ["5001000000004", 329],
      ["1299.00", 473],
      ["2154.00", 524],
    ]),
    line(165, [
      ["2026-09-06 01:00 PM", 50],
      ["Payment to ABC Hardware Shop Company", 126],
      ["5001000000005", 329],
      ["500.00", 424],
      ["1654.00", 524],
    ]),
    line(176, [["Payment to OnlineShop Philippines, Checkout Services Limited:", 126]]),
    line(180, [
      ["2026-09-07 02:00 PM", 50],
      ["5001000000006", 329],
      ["1000.00", 421],
      ["654.00", 527],
    ]),
    line(183, [["OrDER12Ab3CDefGhIj45KL6MnO", 126]]),
    line(194, [
      ["2026-09-08 03:00 PM", 50],
      ["Transfer from 09451234567 to 09191234567", 126],
      ["5001000000007", 329],
      ["200.00", 424],
      ["454.00", 527],
    ]),
    line(205, [
      ["ENDING BALANCE", 126],
      ["454.00", 527],
    ]),
    line(216, [
      ["Total Debit", 126],
      ["3099.00", 421],
    ]),
    line(227, [
      ["Total Credit", 126],
      ["3548.00", 473],
    ]),
  ];

  const result = parseGcashStatement(real);
  const byRef = Object.fromEntries(result.transactions.map((t) => [t.referenceNo, t]));

  it("reads every row, direction and amount, and agrees with the statement's total", () => {
    expect(result.headerFound).toBe(true);
    expect(result.periodStart).toBe("2026-09-01");
    expect(result.periodEnd).toBe("2026-09-17");
    expect(result.transactions.map((t) => t.direction)).toEqual([
      "credit",
      "debit",
      "credit",
      "credit",
      "debit",
      "debit",
      "debit",
    ]);
    expect(byRef["5001000000003"].amount).toBe("850.00");
    expect(result.warnings).toEqual([]);
  });

  it("gives a centred two-line description to its own row, not the row above", () => {
    expect(byRef["5001000000002"].description).toBe(
      "Sent GCash to BPI Savings, Inc. with account ending in 1234"
    );
    expect(byRef["5001000000003"].description).toBe(
      "Received GCash from InstaPay with account ending in 5678 and invno:20260904ABCDEFG1HIJK123456789012345"
    );
    expect(byRef["5001000000005"].description).toBe("Payment to ABC Hardware Shop Company");
    expect(byRef["5001000000006"].description).toBe(
      "Payment to OnlineShop Philippines, Checkout Services Limited: OrDER12Ab3CDefGhIj45KL6MnO"
    );
  });

  it("does not take a phone number in the description for the reference", () => {
    expect(byRef["5001000000001"].description).toBe("Transfer from 09171234567 to 09451234567");
  });
});

it("returns no transactions for a PDF that is not a statement", () => {
  const result = parseGcashStatement([line(40, [["Dear customer, thank you.", 20]])]);
  expect(result.transactions).toEqual([]);
});
