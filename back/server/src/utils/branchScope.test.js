import { describe, expect, it } from "vitest";

import { assertBranchInScope, branchScope, getScopedBranchIds } from "./branchScope.js";

/**
 * Branch isolation.
 *
 * TERANETWORK is one company with several branches, and a branch user must not
 * be able to read another branch's customers, invoices, ONUs or jobs. That
 * boundary is enforced in exactly one place — `branchScope()` — so this suite
 * is the thing standing between a technician in Bagumbayan and the New Lower
 * Bicutan subscriber list.
 *
 * Nothing in V1 or V2 tested this, because neither had branches.
 */

const admin = (branchIds, branchId = branchIds[0]) => ({
  type: "ADMIN",
  companyId: "co-1",
  branchId,
  branchIds,
});

const superAdmin = { type: "SUPERADMIN", accountId: "sa-1" };

describe("getScopedBranchIds", () => {
  it("returns every assigned branch for a multi-branch user", () => {
    expect(getScopedBranchIds(admin(["bicutan", "bagumbayan"]))).toEqual([
      "bicutan",
      "bagumbayan",
    ]);
  });

  it("returns null for SuperAdmin — unrestricted, company-wide", () => {
    expect(getScopedBranchIds(superAdmin)).toBeNull();
  });

  it("falls back to the home branch when assignments are missing", () => {
    // Migration 001 backfills a row per user, so this is belt-and-braces: a
    // user inserted without an assignment degrades to their own branch rather
    // than being locked out of their own data.
    expect(getScopedBranchIds({ type: "ADMIN", branchId: "bicutan" })).toEqual(["bicutan"]);
  });

  it("returns an empty scope, not a full one, for a user with nothing", () => {
    expect(getScopedBranchIds({ type: "ADMIN" })).toEqual([]);
    expect(getScopedBranchIds(null)).toEqual([]);
    expect(getScopedBranchIds(undefined)).toEqual([]);
  });

  it("ignores empty entries rather than emitting a null placeholder", () => {
    expect(getScopedBranchIds(admin(["bicutan", null, "", "bagumbayan"]))).toEqual([
      "bicutan",
      "bagumbayan",
    ]);
  });
});

describe("branchScope — the generated predicate", () => {
  it("binds one placeholder per branch", () => {
    const scope = branchScope("u.branchId", ["bicutan", "bagumbayan"]);
    expect(scope.clause).toBe(" AND u.branchId IN (?, ?)");
    expect(scope.params).toEqual(["bicutan", "bagumbayan"]);
  });

  it("never interpolates a branch id into the SQL string", () => {
    const scope = branchScope("u.branchId", ["bicutan'; DROP TABLE users--"]);
    expect(scope.clause).toBe(" AND u.branchId IN (?)");
    expect(scope.clause).not.toContain("DROP");
    expect(scope.params).toEqual(["bicutan'; DROP TABLE users--"]);
  });

  it("adds no restriction for SuperAdmin", () => {
    expect(branchScope("u.branchId", null)).toEqual({ clause: "", params: [] });
  });

  it("FAILS CLOSED for a user with no branches", () => {
    // The single most important assertion here. If an empty scope produced an
    // empty clause, a user with no assignment would see EVERY branch instead
    // of none — the exact inversion of what the boundary is for.
    const scope = branchScope("u.branchId", []);
    expect(scope.clause).toBe(" AND 1 = 0");
    expect(scope.params).toEqual([]);
  });

  it("accepts a bare column and an aliased one", () => {
    expect(branchScope("branchId", ["b1"]).clause).toBe(" AND branchId IN (?)");
    expect(branchScope("a.branchId", ["b1"]).clause).toBe(" AND a.branchId IN (?)");
  });

  it("rejects a column reference that could carry SQL", () => {
    // The column name is interpolated, not bound, so it is the one part of the
    // fragment that must be developer-controlled.
    expect(() => branchScope("u.branchId; DROP TABLE users--", ["b1"])).toThrow();
    expect(() => branchScope("u.branchId) OR (1=1", ["b1"])).toThrow();
    expect(() => branchScope("a.b.c", ["b1"])).toThrow();
    expect(() => branchScope("", ["b1"])).toThrow();
  });

  it("copies the params so a caller cannot mutate the scope afterwards", () => {
    const branchIds = ["bicutan"];
    const scope = branchScope("branchId", branchIds);
    branchIds.push("bagumbayan");
    expect(scope.params).toEqual(["bicutan"]);
  });
});

describe("assertBranchInScope — guarding writes", () => {
  it("allows a branch the user is assigned to", () => {
    expect(() => assertBranchInScope(admin(["bicutan", "bagumbayan"]), "bagumbayan")).not.toThrow();
  });

  it("rejects a branch the user is not assigned to, with 403", () => {
    try {
      assertBranchInScope(admin(["bicutan"]), "bagumbayan");
      throw new Error("expected assertBranchInScope to throw");
    } catch (error) {
      expect(error.status).toBe(403);
      expect(error.message).toMatch(/do not have access/i);
    }
  });

  it("rejects any branch for a user with no assignment", () => {
    expect(() => assertBranchInScope({ type: "ADMIN" }, "bicutan")).toThrow();
  });

  it("allows SuperAdmin anywhere", () => {
    expect(() => assertBranchInScope(superAdmin, "any-branch")).not.toThrow();
  });
});

describe("the isolation property, end to end", () => {
  /** Stand-in for a controller: build the WHERE a scoped list query would run. */
  const buildListQuery = (user) => {
    const scope = branchScope("c.branchId", getScopedBranchIds(user));
    return {
      sql: `SELECT * FROM customers c WHERE c.companyId = ?${scope.clause} AND c.status != 'Deleted'`,
      params: ["co-1", ...scope.params],
    };
  };

  it("restricts a single-branch technician to their own branch", () => {
    const { sql, params } = buildListQuery(admin(["bagumbayan"]));
    expect(sql).toContain("c.branchId IN (?)");
    expect(params).toEqual(["co-1", "bagumbayan"]);
    expect(params).not.toContain("bicutan");
  });

  it("widens to both branches for a user assigned to both", () => {
    const { params } = buildListQuery(admin(["bicutan", "bagumbayan"]));
    expect(params).toEqual(["co-1", "bicutan", "bagumbayan"]);
  });

  it("returns nothing for an unassigned user", () => {
    const { sql, params } = buildListQuery({ type: "ADMIN" });
    expect(sql).toContain("AND 1 = 0");
    expect(params).toEqual(["co-1"]);
  });

  it("leaves SuperAdmin unfiltered but still company-scoped", () => {
    const { sql, params } = buildListQuery(superAdmin);
    expect(sql).not.toContain("branchId IN");
    expect(sql).toContain("c.companyId = ?");
    expect(params).toEqual(["co-1"]);
  });
});
