import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { MockGateway } from "./mock.gateway.js";
import { PaymentGateway } from "./gateway.interface.js";
import { availableProviders, configuredProvider, gatewayStatus, resolveGateway } from "./index.js";

const SECRET = "test-secret-do-not-use";

const sign = (body) => crypto.createHmac("sha256", SECRET).update(body).digest("hex");

const request = (body, signature) => ({
  headers: { "x-mock-signature": signature ?? sign(body) },
  rawBody: Buffer.from(body, "utf8"),
  contentType: "application/json",
});

let gateway;

beforeEach(() => {
  process.env.PAYMENT_MOCK_SECRET = SECRET;
  gateway = new MockGateway();
  gateway.reset();
});

afterEach(() => {
  delete process.env.PAYMENT_MOCK_SECRET;
  delete process.env.PAYMENT_PROVIDER;
});

describe("the port's contract", () => {
  it("refuses to run unimplemented methods instead of returning undefined", async () => {
    // A base method that quietly returned undefined would surface three layers
    // away as a null payment URL in a customer's email.
    const bare = new (class extends PaymentGateway {
      get name() {
        return "bare";
      }
    })();

    await expect(bare.createPayment({})).rejects.toThrow(/createPayment is not implemented/);
    await expect(bare.getPayment("x")).rejects.toThrow(/getPayment is not implemented/);
    expect(() => bare.parseWebhook({})).toThrow(/parseWebhook is not implemented/);
  });

  it("makes an unnamed gateway fail loudly", () => {
    const anonymous = new (class extends PaymentGateway {})();
    expect(() => anonymous.name).toThrow(/must declare a name/);
  });

  it("verifies nothing by default, so a half-written adapter is closed", () => {
    const bare = new (class extends PaymentGateway {
      get name() {
        return "bare";
      }
    })();
    expect(bare.verifyWebhook({})).toBe(false);
    expect(bare.isConfigured()).toBe(false);
  });
});

describe("resolveGateway", () => {
  it("defaults to the mock, so a fresh checkout runs", () => {
    expect(configuredProvider()).toBe("mock");
    expect(resolveGateway().name).toBe("mock");
  });

  it("names the unknown provider and lists what exists", () => {
    expect(() => resolveGateway("stripe")).toThrow(/stripe/);
    expect(() => resolveGateway("stripe")).toThrow(/Available: mock/);
  });

  it("reports status without throwing on a bad provider", () => {
    process.env.PAYMENT_PROVIDER = "nonesuch";
    const status = gatewayStatus();
    expect(status.provider).toBe("nonesuch");
    expect(status.configured).toBe(false);
    expect(status.available).toEqual(availableProviders());
  });

  it("reports the mock as configured only once it has a secret", () => {
    expect(gatewayStatus().configured).toBe(true);
    delete process.env.PAYMENT_MOCK_SECRET;
    expect(gatewayStatus().configured).toBe(false);
  });
});

describe("createPayment", () => {
  const invoice = {
    reference: "INV-2026-000123",
    amount: "1200.00",
    currency: "PHP",
    description: "July 2026",
    payerName: "Juan",
    payerEmail: "juan@example.test",
    returnUrl: "http://localhost:5173/pay/abc",
  };

  it("returns a usable session", async () => {
    const session = await gateway.createPayment(invoice);

    expect(session.providerRef).toMatch(/^mock_/);
    expect(session.paymentUrl).toContain("/pay/abc");
    expect(session.status).toBe("pending");
    expect(session.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it("puts the amount on the wire in centavos", async () => {
    const session = await gateway.createPayment(invoice);
    // The mock speaks centavos on purpose, so a conversion bug fails here and
    // not against a live card.
    expect(session.raw.amount).toBe(120000);
  });

  it("reuses an open session rather than opening a second one", async () => {
    const first = await gateway.createPayment(invoice);
    const second = await gateway.createPayment(invoice);

    // Two live checkouts for one bill is a customer who can pay twice.
    expect(second.providerRef).toBe(first.providerRef);
    expect(second.raw.reused).toBe(true);
  });

  it("opens a separate session for a different invoice", async () => {
    const first = await gateway.createPayment(invoice);
    const other = await gateway.createPayment({ ...invoice, reference: "INV-2026-000124" });
    expect(other.providerRef).not.toBe(first.providerRef);
  });

  it("refuses to run unconfigured", async () => {
    delete process.env.PAYMENT_MOCK_SECRET;
    await expect(new MockGateway().createPayment(invoice)).rejects.toThrow(/not set/);
  });

  it("describes the call it would make, for a dry run", () => {
    const described = gateway.describe("createPayment", invoice);
    expect(described).toContain("INV-2026-000123");
    expect(described).toContain("120000");
  });
});

describe("verifyWebhook", () => {
  const body = JSON.stringify({ event_id: "evt_1", type: "payment.paid" });

  it("accepts a correctly signed body", () => {
    expect(gateway.verifyWebhook(request(body))).toBe(true);
  });

  it("rejects a tampered body", () => {
    const signature = sign(body);
    const tampered = JSON.stringify({ event_id: "evt_1", type: "payment.paid", extra: 1 });
    expect(gateway.verifyWebhook(request(tampered, signature))).toBe(false);
  });

  it("rejects a wrong signature", () => {
    expect(gateway.verifyWebhook(request(body, "deadbeef"))).toBe(false);
  });

  it("rejects a missing signature", () => {
    expect(gateway.verifyWebhook({ headers: {}, rawBody: Buffer.from(body) })).toBe(false);
  });

  it("rejects an empty body", () => {
    expect(gateway.verifyWebhook({ headers: {}, rawBody: Buffer.alloc(0) })).toBe(false);
  });

  it("fails CLOSED when no secret is configured", () => {
    // The important one. An unconfigured deployment must not accept "invoice
    // paid" from anyone who found the URL.
    delete process.env.PAYMENT_MOCK_SECRET;
    expect(new MockGateway().verifyWebhook(request(body, "anything"))).toBe(false);
  });

  it("survives a signature of the wrong length without throwing", () => {
    // timingSafeEqual throws on unequal buffers; hashing both sides first is
    // what stops a malformed header crashing the endpoint.
    expect(() => gateway.verifyWebhook(request(body, "short"))).not.toThrow();
    expect(gateway.verifyWebhook(request(body, "short"))).toBe(false);
  });
});

describe("parseWebhook", () => {
  it("normalises a paid callback", async () => {
    const session = await gateway.createPayment({
      reference: "INV-2026-000123",
      amount: "1200.00",
      currency: "PHP",
      description: "July",
      payerEmail: "juan@example.test",
      returnUrl: "http://localhost:5173/pay/abc",
    });

    const callback = gateway.simulateCallback(session.providerRef);
    const event = gateway.parseWebhook(request(callback.body, callback.signature));

    expect(event.outcome).toBe("paid");
    expect(event.reference).toBe("INV-2026-000123");
    // Converted back out of centavos, so settlement compares like with like.
    expect(event.amount).toBe("1200.00");
    expect(event.providerRef).toBe(session.providerRef);
    expect(event.providerPaymentId).toMatch(/^mockpay_/);
    expect(event.channel).toBe("GCASH");
    expect(event.paidAt).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it("gives the same event id for a repeat of the same event", async () => {
    const session = await gateway.createPayment({
      reference: "INV-2026-000200",
      amount: "500.00",
      returnUrl: "http://localhost:5173/pay/x",
    });

    const a = gateway.parseWebhook(request(gateway.simulateCallback(session.providerRef).body));
    const b = gateway.parseWebhook(request(gateway.simulateCallback(session.providerRef).body));

    // The replay guard is only as good as this: a retry must repeat its id.
    expect(a.eventId).toBe(b.eventId);
  });

  it("normalises a failed callback", async () => {
    const session = await gateway.createPayment({
      reference: "INV-2026-000201",
      amount: "500.00",
      returnUrl: "http://localhost:5173/pay/x",
    });

    const callback = gateway.simulateCallback(session.providerRef, { outcome: "failed" });
    const event = gateway.parseWebhook(request(callback.body, callback.signature));

    expect(event.outcome).toBe("failed");
    expect(event.eventId).not.toBe(`mockevt_${session.providerRef}_paid`);
  });

  it("reports an unmodelled event type as unknown rather than guessing", () => {
    const body = JSON.stringify({
      event_id: "evt_x",
      type: "payment.something_new",
      data: { reference: "INV-1" },
    });
    const event = gateway.parseWebhook(request(body));

    // Guessing at an unrecognised type is how a "pending" becomes a payment.
    expect(event.outcome).toBe("unknown");
  });

  it("reads from the raw bytes, not a re-serialised object", () => {
    // Key order differs from anything JSON.stringify would produce from the
    // parsed object, which is exactly the case that breaks naive verification.
    const body = '{"type":"payment.paid","event_id":"evt_2","data":{"amount":120000}}';
    const event = gateway.parseWebhook(request(body));

    expect(event.eventId).toBe("evt_2");
    expect(event.amount).toBe("1200.00");
  });

  it("treats a zero amount as a real value, not as absent", () => {
    const body = JSON.stringify({ event_id: "e", type: "payment.paid", data: { amount: 0 } });
    expect(gateway.parseWebhook(request(body)).amount).toBe("0.00");
  });
});

describe("getPayment", () => {
  it("reports an unknown reference rather than inventing a state", async () => {
    expect(await gateway.getPayment("mock_nothing")).toMatchObject({ outcome: "unknown" });
  });

  it("reflects a settled session", async () => {
    const session = await gateway.createPayment({
      reference: "INV-2026-000300",
      amount: "750.00",
      returnUrl: "http://localhost:5173/pay/y",
    });
    gateway.simulateCallback(session.providerRef);

    const state = await gateway.getPayment(session.providerRef);
    expect(state.outcome).toBe("paid");
    expect(state.amount).toBe("750.00");
  });
});
