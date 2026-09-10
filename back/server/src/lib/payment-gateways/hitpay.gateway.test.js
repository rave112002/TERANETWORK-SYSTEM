import crypto from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";

import { HitPayGateway } from "./hitpay.gateway.js";

/**
 * The HitPay adapter.
 *
 * Two things here can lose real money if they are wrong, and they are what most
 * of these tests are about: the amount unit, and the callback signature.
 */

const SALT = "test_salt_do_not_use_anywhere_real";
const API_KEY = "test_api_key";

let gateway;

beforeEach(() => {
  gateway = new HitPayGateway({ apiKey: API_KEY, salt: SALT, mode: "sandbox" });
});

/** Sign a JSON body the way HitPay's dashboard webhook does. */
const signV2 = (body) => crypto.createHmac("sha256", SALT).update(body).digest("hex");

/**
 * Sign a form body the way HitPay's own PHP wrapper does.
 *
 * Written out longhand rather than by calling the adapter's private method, so
 * this is an independent check of the algorithm and not the adapter agreeing
 * with itself:
 *
 *   foreach ($args as $key => $val) { $hmacSource[$key] = "{$key}{$val}"; }
 *   ksort($hmacSource);
 *   hash_hmac('sha256', implode("", array_values($hmacSource)), $secret);
 */
const signV1 = (fields) => {
  const pairs = Object.keys(fields)
    .filter((k) => k !== "hmac")
    .sort()
    .map((k) => k + fields[k])
    .join("");
  return crypto.createHmac("sha256", SALT).update(pairs).digest("hex");
};

const asRequest = ({ body, headers = {}, contentType = "application/json" }) => ({
  headers,
  rawBody: Buffer.from(body, "utf8"),
  contentType,
});

describe("configuration", () => {
  it("needs both the API key and the salt", () => {
    expect(gateway.isConfigured()).toBe(true);
    expect(new HitPayGateway({ apiKey: API_KEY, salt: "" }).isConfigured()).toBe(false);
    // The salt signs callbacks and the API key authenticates requests. With
    // only the key you get a working checkout whose every callback is rejected.
    expect(new HitPayGateway({ apiKey: "", salt: SALT }).isConfigured()).toBe(false);
  });

  it("defaults to sandbox rather than live", () => {
    // A missing environment variable must not quietly point a fresh deployment
    // at live credentials and charge somebody during a demo.
    const unset = new HitPayGateway({ apiKey: API_KEY, salt: SALT });
    expect(unset.isTestMode()).toBe(true);
    expect(unset.baseUrl).toContain("sandbox");
  });

  it("uses the live host only when explicitly told to", () => {
    const live = new HitPayGateway({ apiKey: API_KEY, salt: SALT, mode: "live" });
    expect(live.isTestMode()).toBe(false);
    expect(live.baseUrl).toBe("https://api.hit-pay.com/v1");
  });

  it("says it does not know rather than guessing at a typo", () => {
    // The contract: null means the UI should say "unknown", not pick the
    // reassuring answer.
    const typo = new HitPayGateway({ apiKey: API_KEY, salt: SALT, mode: "produciton" });
    expect(typo.isTestMode()).toBeNull();
  });
});

describe("the amount unit", () => {
  it("sends pesos, not centavos", () => {
    // The single most expensive mistake available in this file. HitPay takes
    // major units: "1200.00" is one thousand two hundred pesos. Sending 120000
    // would charge a hundred times the bill.
    const described = gateway.describe("createPayment", {
      amount: "1200.00",
      currency: "PHP",
      reference: "INV-2026-000001",
      returnUrl: "https://example.test/pay/abc",
    });

    expect(described).toContain("amount: 1200.00 PHP");
    expect(described).not.toContain("120000");
  });

  it("reads an amount back in the same units it sent", () => {
    const body = JSON.stringify({
      id: "req_1",
      status: "completed",
      reference_number: "INV-2026-000001",
      amount: "1200.00",
      payments: [{ id: "pay_1", status: "succeeded", amount: "1200.00", payment_type: "gcash" }],
    });

    const event = gateway.parseWebhook(
      asRequest({ body, headers: { "hitpay-signature": signV2(body) } })
    );

    expect(event.amount).toBe("1200.00");
  });

  it("keeps a zero amount rather than reading it as absent", () => {
    const body = JSON.stringify({
      id: "req_1",
      status: "failed",
      reference_number: "INV-1",
      amount: "0.00",
      payments: [],
    });

    expect(gateway.parseWebhook(asRequest({ body })).amount).toBe("0.00");
  });
});

describe("verifyWebhook — v2, the dashboard-registered endpoint", () => {
  const body = JSON.stringify({ id: "req_1", status: "completed", reference_number: "INV-1" });

  it("accepts a correctly signed callback", () => {
    expect(
      gateway.verifyWebhook(asRequest({ body, headers: { "hitpay-signature": signV2(body) } }))
    ).toBe(true);
  });

  it("rejects a body that was altered after signing", () => {
    // The attack this exists to stop: take a real callback, change the amount
    // or the reference, replay it.
    const signature = signV2(body);
    const tampered = body.replace("INV-1", "INV-2");

    expect(
      gateway.verifyWebhook(asRequest({ body: tampered, headers: { "hitpay-signature": signature } }))
    ).toBe(false);
  });

  it("rejects a signature made with a different salt", () => {
    const wrong = crypto.createHmac("sha256", "some_other_salt").update(body).digest("hex");
    expect(gateway.verifyWebhook(asRequest({ body, headers: { "hitpay-signature": wrong } }))).toBe(
      false
    );
  });

  it("signs the exact bytes, not a re-serialised object", () => {
    // Two JSON strings can carry the same object and different bytes. HMAC is
    // over bytes, so verification must be too.
    const spaced = '{ "id": "req_1" }';
    const compact = '{"id":"req_1"}';

    expect(
      gateway.verifyWebhook(asRequest({ body: spaced, headers: { "hitpay-signature": signV2(spaced) } }))
    ).toBe(true);
    expect(
      gateway.verifyWebhook(asRequest({ body: compact, headers: { "hitpay-signature": signV2(spaced) } }))
    ).toBe(false);
  });
});

describe("verifyWebhook — v1, the deprecated webhook parameter", () => {
  const fields = {
    payment_id: "pay_1",
    payment_request_id: "req_1",
    phone: "",
    amount: "1200.00",
    currency: "PHP",
    status: "completed",
    reference_number: "INV-2026-000001",
  };

  const formBody = (extra = {}) =>
    new URLSearchParams({ ...fields, ...extra }).toString();

  it("accepts a callback signed the way HitPay's own wrapper signs one", () => {
    const body = formBody({ hmac: signV1(fields) });

    expect(
      gateway.verifyWebhook(
        asRequest({ body, contentType: "application/x-www-form-urlencoded" })
      )
    ).toBe(true);
  });

  it("rejects one whose fields were changed", () => {
    const hmac = signV1(fields);
    const body = formBody({ hmac, amount: "1.00" });

    expect(
      gateway.verifyWebhook(
        asRequest({ body, contentType: "application/x-www-form-urlencoded" })
      )
    ).toBe(false);
  });

  it("rejects one with no hmac field at all", () => {
    expect(
      gateway.verifyWebhook(
        asRequest({ body: formBody(), contentType: "application/x-www-form-urlencoded" })
      )
    ).toBe(false);
  });

  it("excludes the hmac field from what it signs", () => {
    // Including it would make the signature depend on itself, and nothing
    // would ever verify.
    const withHmac = signV1({ ...fields, hmac: "should-be-ignored" });
    expect(withHmac).toBe(signV1(fields));
  });
});

describe("verifyWebhook — failing closed", () => {
  const body = JSON.stringify({ id: "req_1" });

  it("rejects everything when no salt is configured", () => {
    // An unconfigured deployment must not be an open door: anyone who found
    // the URL could POST "invoice paid" and reconnect themselves for free.
    const unsalted = new HitPayGateway({ apiKey: API_KEY, salt: "" });

    expect(
      unsalted.verifyWebhook(asRequest({ body, headers: { "hitpay-signature": signV2(body) } }))
    ).toBe(false);
  });

  it("rejects an empty body", () => {
    expect(gateway.verifyWebhook(asRequest({ body: "" }))).toBe(false);
  });

  it("rejects a request that matches neither scheme", () => {
    // No signature header and not form-encoded. Not a HitPay callback, or a
    // third scheme nobody has told us about — refusing is the only safe answer.
    expect(gateway.verifyWebhook(asRequest({ body, contentType: "text/plain" }))).toBe(false);
  });
});

describe("parseWebhook", () => {
  const v2Body = (over = {}) =>
    JSON.stringify({
      id: "req_1",
      status: "completed",
      reference_number: "INV-2026-000001",
      amount: "1200.00",
      payments: [
        { id: "pay_1", status: "succeeded", amount: "1200.00", payment_type: "gcash", created_at: "2026-09-10T04:30:00Z" },
      ],
      ...over,
    });

  it("normalises a completed payment", () => {
    const body = v2Body();
    const event = gateway.parseWebhook(
      asRequest({ body, headers: { "hitpay-signature": signV2(body), "hitpay-event-type": "completed" } })
    );

    expect(event.outcome).toBe("paid");
    expect(event.reference).toBe("INV-2026-000001");
    expect(event.providerPaymentId).toBe("pay_1");
    expect(event.providerRef).toBe("req_1");
    expect(event.channel).toBe("GCASH");
  });

  it("maps HitPay's statuses into our vocabulary", () => {
    const outcomeOf = (status) =>
      gateway.parseWebhook(asRequest({ body: v2Body({ status, payments: [] }) })).outcome;

    // Callers must never compare against a provider's own string.
    expect(outcomeOf("completed")).toBe("paid");
    expect(outcomeOf("failed")).toBe("failed");
    expect(outcomeOf("expired")).toBe("expired");
    expect(outcomeOf("pending")).toBe("pending");
    expect(outcomeOf("something_new")).toBe("unknown");
  });

  it("keys the event on the payment, so a retry is recognised", () => {
    // HitPay sends no event id. The replay guard needs a key that repeats on a
    // resend and differs for a genuinely new event; one payment id is one
    // movement of money, however many times it is announced.
    const first = gateway.parseWebhook(asRequest({ body: v2Body() }));
    const resent = gateway.parseWebhook(asRequest({ body: v2Body() }));

    expect(first.eventId).toBe(resent.eventId);
    expect(first.eventId).toContain("pay_1");
  });

  it("still produces a stable key when there is no payment to key on", () => {
    const failed = v2Body({ status: "failed", payments: [] });
    const a = gateway.parseWebhook(asRequest({ body: failed }));
    const b = gateway.parseWebhook(asRequest({ body: failed }));

    expect(a.eventId).toBe(b.eventId);
    // And distinct from the completed event for the same request, so a later
    // success is not swallowed as a duplicate of the earlier failure.
    expect(a.eventId).not.toBe(gateway.parseWebhook(asRequest({ body: v2Body() })).eventId);
  });

  it("reports the payment that actually succeeded, not the first attempt", () => {
    const body = v2Body({
      payments: [
        { id: "pay_failed", status: "failed", amount: "1200.00", payment_type: "card" },
        { id: "pay_ok", status: "succeeded", amount: "1200.00", payment_type: "gcash" },
      ],
    });

    const event = gateway.parseWebhook(asRequest({ body }));
    expect(event.providerPaymentId).toBe("pay_ok");
    expect(event.channel).toBe("GCASH");
  });

  it("picks the scheme from the request, not from configuration", () => {
    const fields = {
      payment_id: "pay_9",
      payment_request_id: "req_9",
      amount: "500.00",
      currency: "PHP",
      status: "completed",
      reference_number: "INV-2026-000009",
      payment_type: "paynow_online",
    };

    const event = gateway.parseWebhook(
      asRequest({
        body: new URLSearchParams({ ...fields, hmac: signV1(fields) }).toString(),
        contentType: "application/x-www-form-urlencoded",
      })
    );

    expect(event.outcome).toBe("paid");
    expect(event.reference).toBe("INV-2026-000009");
    expect(event.providerPaymentId).toBe("pay_9");
    expect(event.providerRef).toBe("req_9");
    expect(event.amount).toBe("500.00");
    expect(event.channel).toBe("PAYNOW_ONLINE");
  });
});

describe("createPayment", () => {
  it("refuses to run unconfigured rather than failing at HitPay", () => {
    const unset = new HitPayGateway({ apiKey: "", salt: "" });
    return expect(unset.createPayment({ amount: "1.00" })).rejects.toThrow(
      /PAYMENT_HITPAY_API_KEY/
    );
  });
});
