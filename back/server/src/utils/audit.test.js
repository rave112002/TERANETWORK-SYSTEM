import { describe, expect, it } from "vitest";

import { getAuditContext, redactState, systemAuditContext, writeAudit } from "./audit.js";

/**
 * A fake transaction connection. Records every statement so a test can assert
 * what would have been sent, without a database.
 */
const fakeConn = () => {
  const calls = [];
  return {
    calls,
    execute: async (sql, params = []) => {
      calls.push({ sql, params });
      if (/SELECT UUID\(\)/i.test(sql)) return [[{ id: "audit-uuid-1" }], []];
      return [{ affectedRows: 1 }, []];
    },
  };
};

const parseMetadata = (conn) => {
  const insert = conn.calls.find((c) => /INSERT INTO audit_trail/i.test(c.sql));
  return JSON.parse(insert.params[7]);
};

describe("redactState", () => {
  it("keeps null distinguishable from an empty object", () => {
    expect(redactState(null)).toBeNull();
    expect(redactState(undefined)).toBeNull();
    expect(redactState({})).toEqual({});
  });

  it("redacts secrets by substring, whatever the casing or separator", () => {
    const redacted = redactState({
      credentialsEnc: "abc",
      credentials_enc: "abc",
      password_hash: "argon2id$...",
      totpSecret: "JBSWY3DP",
      apiKey: "sk_live_x",
      private_key: "-----BEGIN",
      xenditCallbackToken: "tok_123",
    });

    for (const value of Object.values(redacted)) {
      expect(value).toBe("[redacted]");
    }
  });

  it("leaves ordinary fields alone", () => {
    expect(
      redactState({ serialNo: "HWTC1234", provisioningState: "active", lastRxDbm: -18.4 })
    ).toEqual({ serialNo: "HWTC1234", provisioningState: "active", lastRxDbm: -18.4 });
  });

  it("records the shape of a binary blob, never its bytes", () => {
    const state = redactState({ blob: Buffer.from("secret-bytes") });
    expect(state.blob).toBe("[binary 12 bytes]");
    expect(state.blob).not.toContain("secret");
  });

  it("preserves a null secret as null rather than claiming one existed", () => {
    expect(redactState({ password: null })).toEqual({ password: null });
  });
});

describe("writeAudit", () => {
  const context = {
    accountId: "acct-1",
    companyId: "co-1",
    branchId: "br-1",
    ip: "10.0.0.5",
    userAgent: "vitest",
  };

  it("uses the caller's connection, so the row is part of their transaction", async () => {
    const conn = fakeConn();
    await writeAudit(conn, { context, module: "onus", action: "deactivate" });

    // Both the UUID and the INSERT go through the same conn.execute.
    expect(conn.calls).toHaveLength(2);
    expect(conn.calls[0].sql).toMatch(/SELECT UUID\(\)/i);
    expect(conn.calls[1].sql).toMatch(/INSERT INTO audit_trail/i);
  });

  it("takes the id from MySQL rather than generating one in JavaScript", async () => {
    const conn = fakeConn();
    const auditId = await writeAudit(conn, { context, module: "onus", action: "deactivate" });
    expect(auditId).toBe("audit-uuid-1");
  });

  it("stores before and after under metadata, redacted", async () => {
    const conn = fakeConn();
    await writeAudit(conn, {
      context,
      module: "olts",
      action: "update",
      before: { name: "OLT-1", credentialsEnc: "old-secret" },
      after: { name: "OLT-1 (renamed)", credentialsEnc: "new-secret" },
    });

    const metadata = parseMetadata(conn);
    expect(metadata.before.name).toBe("OLT-1");
    expect(metadata.after.name).toBe("OLT-1 (renamed)");
    expect(metadata.before.credentialsEnc).toBe("[redacted]");
    expect(metadata.after.credentialsEnc).toBe("[redacted]");

    // The whole serialised row must not carry the secret anywhere.
    const insert = conn.calls.find((c) => /INSERT INTO audit_trail/i.test(c.sql));
    expect(JSON.stringify(insert.params)).not.toContain("old-secret");
    expect(JSON.stringify(insert.params)).not.toContain("new-secret");
  });

  it("omits the meta key entirely when none was given", async () => {
    const conn = fakeConn();
    await writeAudit(conn, { context, module: "invoices", action: "void" });
    expect(parseMetadata(conn)).not.toHaveProperty("meta");
  });

  it("carries extra context through meta when given", async () => {
    const conn = fakeConn();
    await writeAudit(conn, {
      context,
      module: "onus",
      action: "deactivate",
      meta: { jobId: "job-9", reason: "dunning" },
    });
    expect(parseMetadata(conn).meta).toEqual({ jobId: "job-9", reason: "dunning" });
  });

  it("writes the actor, tenant and request context onto the row", async () => {
    const conn = fakeConn();
    await writeAudit(conn, {
      context,
      module: "onus",
      action: "activate",
      description: "Reconnected after payment",
    });

    const insert = conn.calls.find((c) => /INSERT INTO audit_trail/i.test(c.sql));
    const [auditId, companyId, branchId, accountId, action, module, description] = insert.params;
    expect(auditId).toBe("audit-uuid-1");
    expect(companyId).toBe("co-1");
    expect(branchId).toBe("br-1");
    expect(accountId).toBe("acct-1");
    expect(action).toBe("activate");
    expect(module).toBe("onus");
    expect(description).toBe("Reconnected after payment");
  });
});

describe("getAuditContext", () => {
  it("reads the actor off req.user, never the request body", () => {
    const req = {
      user: { accountId: "acct-1", companyId: "co-1", branchId: "br-1" },
      body: { accountId: "attacker" },
      ip: "10.0.0.5",
      get: () => "vitest",
    };
    expect(getAuditContext(req)).toEqual({
      accountId: "acct-1",
      companyId: "co-1",
      branchId: "br-1",
      ip: "10.0.0.5",
      userAgent: "vitest",
    });
  });

  it("survives a SuperAdmin, who has no company or branch", () => {
    const req = { user: { accountId: "sa-1", type: "SUPERADMIN" }, get: () => null };
    const context = getAuditContext(req);
    expect(context.accountId).toBe("sa-1");
    expect(context.companyId).toBeNull();
    expect(context.branchId).toBeNull();
  });
});

describe("systemAuditContext", () => {
  it("names the automation instead of leaving the actor blank", () => {
    // accountId is NOT NULL, and "who disconnected this customer?" must have a
    // readable answer.
    expect(systemAuditContext("dunning").accountId).toBe("system:dunning");
    expect(systemAuditContext("xendit-webhook").accountId).toBe("system:xendit-webhook");
  });

  it("fits the accountId column", () => {
    expect(systemAuditContext("billing-cycle").accountId.length).toBeLessThanOrEqual(50);
  });

  it("carries tenant scope when the job knows it", () => {
    const context = systemAuditContext("dunning", { companyId: "co-1", branchId: "br-1" });
    expect(context.companyId).toBe("co-1");
    expect(context.branchId).toBe("br-1");
  });
});
