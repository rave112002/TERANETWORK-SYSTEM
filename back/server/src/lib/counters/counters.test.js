import { describe, expect, it } from "vitest";

import { formatReference, nextAccountNo, nextSequence } from "./counters.js";

/**
 * A fake connection that models MySQL's own reporting for
 * `INSERT ... ON DUPLICATE KEY UPDATE`: affectedRows is 1 when the row was
 * inserted and 2 when it was updated, and `LAST_INSERT_ID(expr)` publishes the
 * pre-increment value as insertId.
 */
const fakeCounters = () => {
  const rows = new Map();
  return {
    rows,
    execute: async (_sql, [name]) => {
      if (!rows.has(name)) {
        rows.set(name, 2);
        return [{ affectedRows: 1, insertId: 0 }, []];
      }
      const current = rows.get(name);
      rows.set(name, current + 1);
      return [{ affectedRows: 2, insertId: current }, []];
    },
  };
};

describe("nextSequence", () => {
  it("starts at 1", async () => {
    const conn = fakeCounters();
    expect(await nextSequence(conn, "customerAccountNo:co-1")).toBe(1);
  });

  it("never repeats a value", async () => {
    const conn = fakeCounters();
    const values = [];
    for (let i = 0; i < 25; i += 1) {
      values.push(await nextSequence(conn, "customerAccountNo:co-1"));
    }
    expect(values).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
    expect(new Set(values).size).toBe(25);
  });

  it("keeps separate sequences independent", async () => {
    const conn = fakeCounters();
    expect(await nextSequence(conn, "a")).toBe(1);
    expect(await nextSequence(conn, "b")).toBe(1);
    expect(await nextSequence(conn, "a")).toBe(2);
    expect(await nextSequence(conn, "b")).toBe(2);
  });

  it("uses the caller's connection, so a rollback takes the number with it", async () => {
    const conn = fakeCounters();
    let sawExecute = false;
    const spy = {
      ...conn,
      execute: async (...args) => {
        sawExecute = true;
        return conn.execute(...args);
      },
    };
    await nextSequence(spy, "customerAccountNo:co-1");
    expect(sawExecute).toBe(true);
  });
});

describe("formatReference", () => {
  it("pads to the display width", () => {
    expect(formatReference("ACC", 1)).toBe("ACC-000001");
    expect(formatReference("ACC", 123)).toBe("ACC-000123");
    expect(formatReference("ACC", 999999)).toBe("ACC-999999");
  });

  it("grows past the width instead of wrapping or colliding", () => {
    // Padding is a convention, not a cap — number 1,000,000 must stay unique.
    expect(formatReference("ACC", 1000000)).toBe("ACC-1000000");
    expect(formatReference("ACC", 1000000)).not.toBe(formatReference("ACC", 0));
  });

  it("takes a custom width, for invoice numbering later", () => {
    expect(formatReference("INV-2026", 123, 6)).toBe("INV-2026-000123");
  });
});

describe("nextAccountNo", () => {
  it("produces the documented ACC-000123 shape", async () => {
    const conn = fakeCounters();
    expect(await nextAccountNo(conn, "co-1")).toBe("ACC-000001");
    expect(await nextAccountNo(conn, "co-1")).toBe("ACC-000002");
  });

  it("fits the accountNo column (VARCHAR(20))", async () => {
    const conn = fakeCounters();
    const accountNo = await nextAccountNo(conn, "co-1");
    expect(accountNo.length).toBeLessThanOrEqual(20);
  });

  it("runs one continuous sequence per company, not per branch", async () => {
    // Staff and customers quote an account number on the phone; it should not
    // depend on which office opened the account.
    const conn = fakeCounters();
    await nextAccountNo(conn, "co-1");
    await nextAccountNo(conn, "co-1");
    expect([...conn.rows.keys()]).toEqual(["customerAccountNo:co-1"]);
  });
});
