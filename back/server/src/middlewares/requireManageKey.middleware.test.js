import { describe, expect, it, vi } from "vitest";

vi.mock("../../config/logger.js", () => ({ logger: { warn: vi.fn() } }));

const { requireManageKey } = await import("./requireManageKey.middleware.js");

const KEY = "k".repeat(40);

const run = (key, headerValue) => {
  const req = { get: (h) => (h === "x-manage-key" ? headerValue : undefined), ip: "100.64.0.1" };
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  const next = vi.fn();
  requireManageKey(() => key)(req, res, next);
  return { res, next };
};

describe("requireManageKey", () => {
  it("lets the right key through", () => {
    const { next, res } = run(KEY, KEY);
    expect(next).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(200);
  });

  it("refuses a missing or wrong key", () => {
    expect(run(KEY, undefined).res.body.code).toBe("MANAGE_KEY_INVALID");
    expect(run(KEY, `${KEY}x`).res.statusCode).toBe(401);
    expect(run(KEY, KEY.slice(1)).next).not.toHaveBeenCalled();
  });

  it("stays closed when no key, or a too-short key, is configured", () => {
    expect(run(undefined, "anything").res.statusCode).toBe(503);
    expect(run("", "").res.body.code).toBe("MANAGE_DISABLED");
    expect(run("short", "short").next).not.toHaveBeenCalled();
  });
});
