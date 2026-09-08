import crypto from "node:crypto";

import { PaymentGateway } from "./gateway.interface.js";
import { fromCentavos, toCentavos } from "./amounts.js";
import { getCurrentTimestampLocal, toTimestampLocal } from "../../utils/dateUtils.js";

/**
 * The mock gateway.
 *
 * ── Not a stub ──────────────────────────────────────────────────────────────
 *
 * This is a working gateway that happens to keep its money in memory. It makes
 * the whole payment path — Pay button, checkout, callback, signature check,
 * replay guard, settlement, reconnection — runnable end to end on a laptop with
 * no merchant account, and it is what the port is tested against.
 *
 * That matters more than it sounds. A mock that just returns `{ ok: true }`
 * lets a broken contract look healthy right up until the real credentials
 * arrive. So this one deliberately behaves like an awkward real provider:
 *
 *   - it works in CENTAVOS, like PayMongo, so a unit-conversion bug fails here
 *     rather than in production against a live card;
 *   - it signs callbacks with HMAC-SHA256 over the raw body, so the raw-body
 *     plumbing is exercised rather than assumed;
 *   - it fails closed with no secret configured;
 *   - it refuses to open a second session for a reference that already has a
 *     live one, the way a real gateway's idempotency behaves.
 *
 * The checkout page it points at is served by this app (`/pay/<token>` shows a
 * simulator when the mock is active), so the flow is clickable.
 */

/** Sessions this process has opened, by providerRef. */
const sessions = new Map();

/** How long a mock checkout stays open. Short, so expiry is testable. */
const DEFAULT_EXPIRY_SECONDS = 3600;

export class MockGateway extends PaymentGateway {
  get name() {
    return "mock";
  }

  get label() {
    return "Mock gateway (development)";
  }

  /**
   * The secret is what signs and verifies callbacks. Without one this gateway
   * is unusable — deliberately, so "the mock works with no config" never
   * becomes "the webhook endpoint accepts anything".
   */
  get secret() {
    return this.config.secret || process.env.PAYMENT_MOCK_SECRET || "";
  }

  isConfigured() {
    return Boolean(this.secret);
  }

  /** Always. If this ever returns false somebody has deployed the mock. */
  isTestMode() {
    return true;
  }

  describe(action, ctx = {}) {
    if (action === "createPayment") {
      return [
        `POST https://mock.local/v1/checkout_sessions`,
        `  reference: ${ctx.reference}`,
        `  amount: ${toCentavos(ctx.amount ?? "0")} (centavos)`,
        `  return_url: ${ctx.returnUrl}`,
      ].join("\n");
    }
    return `GET https://mock.local/v1/checkout_sessions/${ctx.providerRef}`;
  }

  /**
   * @param {import('./gateway.interface.js').PaymentRequest} request
   * @returns {Promise<import('./gateway.interface.js').PaymentSession>}
   */
  async createPayment(request) {
    if (!this.isConfigured()) {
      throw new Error("Mock gateway: PAYMENT_MOCK_SECRET is not set");
    }

    // Reuse rather than open a second session, the way a real gateway's
    // idempotency key behaves. Two live checkouts for one bill is a customer
    // who can pay twice.
    for (const [ref, session] of sessions) {
      if (session.reference === request.reference && session.status === "pending") {
        return {
          providerRef: ref,
          paymentUrl: session.paymentUrl,
          status: "pending",
          expiresAt: session.expiresAt,
          raw: { ...session, reused: true },
        };
      }
    }

    const providerRef = `mock_${crypto.randomBytes(12).toString("hex")}`;
    const expiresAt = toTimestampLocal(
      Date.now() + (request.expiresInSeconds ?? DEFAULT_EXPIRY_SECONDS) * 1000
    );

    const session = {
      id: providerRef,
      reference: request.reference,
      // Centavos on the wire, like PayMongo — so a conversion bug surfaces in
      // development instead of against a live card.
      amount: toCentavos(request.amount),
      currency: request.currency ?? "PHP",
      description: request.description,
      payer_email: request.payerEmail,
      status: "pending",
      // The simulator lives on our own pay page; `?simulate=1` reveals the
      // buttons that stand in for a hosted checkout.
      paymentUrl: `${request.returnUrl}?simulate=${providerRef}`,
      expiresAt,
      created_at: getCurrentTimestampLocal(),
    };

    sessions.set(providerRef, session);

    return {
      providerRef,
      paymentUrl: session.paymentUrl,
      status: "pending",
      expiresAt,
      raw: session,
    };
  }

  /**
   * HMAC-SHA256 over the exact bytes received, compared in constant time.
   *
   * A plain `===` returns as soon as two characters differ, which is
   * measurably faster for a wrong first byte — enough to recover a signature
   * one byte at a time. Hashing both sides also guarantees equal lengths, since
   * `timingSafeEqual` throws when they differ.
   *
   * @param {import('./gateway.interface.js').RawRequest} request
   * @returns {boolean}
   */
  verifyWebhook({ headers = {}, rawBody } = {}) {
    // Fail closed. An unconfigured deployment must not accept "invoice paid"
    // from anyone who found the URL.
    if (!this.isConfigured()) return false;
    if (!rawBody || rawBody.length === 0) return false;

    const provided = headers["x-mock-signature"];
    if (!provided) return false;

    const expected = crypto.createHmac("sha256", this.secret).update(rawBody).digest("hex");

    const a = crypto.createHash("sha256").update(String(provided)).digest();
    const b = crypto.createHash("sha256").update(expected).digest();
    return crypto.timingSafeEqual(a, b);
  }

  /**
   * @param {import('./gateway.interface.js').RawRequest} request
   * @returns {import('./gateway.interface.js').WebhookEvent}
   */
  parseWebhook({ rawBody } = {}) {
    // Parsed from the raw bytes, never from `req.body`: this app's sanitise
    // middleware rewrites the parsed body before any controller sees it.
    const payload = JSON.parse(rawBody.toString("utf8"));

    const OUTCOMES = {
      "payment.paid": "paid",
      "payment.failed": "failed",
      "payment.expired": "expired",
    };

    // `?? null` rather than a loose comparison: an amount of 0 is a real value
    // and must not be read as absent.
    const rawAmount = payload.data?.amount ?? null;

    return {
      eventId: payload.event_id,
      eventType: payload.type,
      outcome: OUTCOMES[payload.type] ?? "unknown",
      reference: payload.data?.reference ?? null,
      providerPaymentId: payload.data?.payment_id ?? null,
      providerRef: payload.data?.id ?? null,
      // Back to canonical form on the way in, exactly as it was converted on
      // the way out.
      amount: rawAmount === null ? null : fromCentavos(rawAmount),
      channel: payload.data?.channel ?? null,
      paidAt: payload.data?.paid_at ? toTimestampLocal(payload.data.paid_at) : null,
      raw: payload,
    };
  }

  /**
   * @param {string} providerRef
   */
  async getPayment(providerRef) {
    const session = sessions.get(providerRef);
    if (!session) return { outcome: "unknown", amount: null, paidAt: null, raw: {} };

    return {
      outcome: session.status === "paid" ? "paid" : session.status,
      amount: fromCentavos(session.amount),
      paidAt: session.paid_at ?? null,
      raw: session,
    };
  }

  /* ── Simulator ─────────────────────────────────────────────────────────
   *
   * The part a real adapter has no equivalent of: the customer's side of the
   * checkout. Driven by the dev-only endpoint the pay page calls.
   */

  /**
   * Pretend the customer paid, and build the callback the gateway would send.
   *
   * Returns the exact body and signature header so the caller can POST it at
   * the real webhook endpoint — the point being that the simulated flow goes
   * through verification, replay-guarding and settlement like any other, rather
   * than around them.
   *
   * @param {string} providerRef
   * @param {Object} [opts]
   * @param {'paid'|'failed'} [opts.outcome="paid"]
   * @param {string} [opts.channel="GCASH"]
   * @returns {{body: string, signature: string}|null} null when unknown.
   */
  simulateCallback(providerRef, { outcome = "paid", channel = "GCASH" } = {}) {
    const session = sessions.get(providerRef);
    if (!session) return null;

    session.status = outcome;
    session.paid_at = getCurrentTimestampLocal();
    session.payment_id = `mockpay_${crypto.randomBytes(10).toString("hex")}`;

    const payload = {
      // Stable per (session, outcome): a retry repeats it, a genuinely later
      // event does not — which is what the replay guard needs.
      event_id: `mockevt_${providerRef}_${outcome}`,
      type: outcome === "paid" ? "payment.paid" : "payment.failed",
      created_at: getCurrentTimestampLocal(),
      data: {
        id: providerRef,
        payment_id: session.payment_id,
        reference: session.reference,
        amount: session.amount,
        currency: session.currency,
        channel,
        paid_at: session.paid_at,
      },
    };

    const body = JSON.stringify(payload);
    const signature = crypto.createHmac("sha256", this.secret).update(body).digest("hex");

    return { body, signature };
  }

  /** Test seam: forget every session. */
  reset() {
    sessions.clear();
  }
}

export default MockGateway;
