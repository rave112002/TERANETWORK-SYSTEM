import crypto from "node:crypto";

import { PaymentGateway } from "./gateway.interface.js";
import { toDecimalString } from "./amounts.js";
import { toTimestampLocal } from "../../utils/dateUtils.js";

/**
 * HitPay — the client's chosen gateway for the Taguig branches.
 *
 * Docs: https://docs.hitpayapp.com/apis/guide/online-payments
 *
 * ── The amount unit, first, because it is the one that hurts ────────────────
 *
 * HitPay takes the amount in MAJOR UNITS as a decimal — "1200.00" means one
 * thousand two hundred pesos. It does not use centavos. That happens to match
 * our canonical form exactly, so the conversion is `toDecimalString` and
 * nothing else.
 *
 * It is still routed through `amounts.js` rather than passed through, because
 * "these two formats happen to agree today" is not a thing to leave implicit
 * next to a number that moves real money.
 *
 * ── Two webhook schemes, and why both are handled ───────────────────────────
 *
 * HitPay has changed how it signs callbacks, and which one arrives depends on
 * how the merchant's account is set up rather than on anything in this code:
 *
 *   v2  registered in Dashboard → Developers → Webhook Endpoints. JSON body,
 *       signature in the `Hitpay-Signature` header, HMAC-SHA256 over the raw
 *       JSON bytes. This is the current, documented path.
 *
 *   v1  triggered by the `webhook` parameter on the payment request itself.
 *       Form-encoded body carrying its own `hmac` field, computed by building
 *       "{key}{value}" for every other field, sorting those by key,
 *       concatenating with no separator, then HMAC-SHA256. HitPay marks the
 *       parameter deprecated but has published no removal date.
 *
 * Supporting only v2 would work right up until the client's account turns out
 * to be configured the old way, and the symptom would be every callback
 * rejected as an invalid signature — which reads exactly like a wrong salt.
 * Thirty lines is a cheap price for not spending a go-live afternoon on that.
 *
 * The scheme is chosen by what the request actually looks like, not by
 * configuration, so there is no third thing to get wrong.
 *
 * ── What is NOT sent ────────────────────────────────────────────────────────
 *
 * The `webhook` parameter. It is deprecated, and sending it would ask for the
 * scheme we would rather not be on. Callbacks come from the dashboard-
 * registered endpoint. See README.md for the URL to register.
 */

const LIVE_BASE = "https://api.hit-pay.com/v1";
const SANDBOX_BASE = "https://api.sandbox.hit-pay.com/v1";

/** HitPay's payment-request statuses, mapped to ours. */
const OUTCOME_BY_STATUS = {
  completed: "paid",
  succeeded: "paid",
  failed: "failed",
  expired: "expired",
  pending: "pending",
};

/** How long a HitPay request may take before we stop waiting on it. */
const REQUEST_TIMEOUT_MS = 15000;

export class HitPayGateway extends PaymentGateway {
  get name() {
    return "hitpay";
  }

  get label() {
    return "HitPay";
  }

  get apiKey() {
    return this.config.apiKey || process.env.PAYMENT_HITPAY_API_KEY || "";
  }

  /**
   * The salt from Dashboard → Settings → API Keys. Signs and verifies
   * callbacks, and is a different value from the API key — mixing the two up
   * gives a working checkout whose every callback is rejected.
   */
  get salt() {
    return this.config.salt || process.env.PAYMENT_HITPAY_SALT || "";
  }

  /**
   * Sandbox unless told otherwise.
   *
   * The default is the harmless one on purpose: a missing environment variable
   * should not quietly point a fresh deployment at live credentials and charge
   * somebody during a demo.
   */
  get mode() {
    return (this.config.mode || process.env.PAYMENT_HITPAY_MODE || "sandbox").toLowerCase();
  }

  get baseUrl() {
    return this.mode === "live" ? LIVE_BASE : SANDBOX_BASE;
  }

  isConfigured() {
    return Boolean(this.apiKey && this.salt);
  }

  /**
   * HitPay's sandbox and live keys are not distinguishable by prefix, so this
   * reports what the deployment declared. An unrecognised mode returns null
   * rather than guessing — the contract says the UI should then say "unknown"
   * instead of picking the reassuring answer.
   */
  isTestMode() {
    if (this.mode === "sandbox") return true;
    if (this.mode === "live") return false;
    return null;
  }

  describe(action, ctx = {}) {
    if (action === "createPayment") {
      return [
        `POST ${this.baseUrl}/payment-requests`,
        `  X-BUSINESS-API-KEY: ${this.apiKey ? "(set)" : "(MISSING)"}`,
        `  amount: ${toDecimalString(ctx.amount ?? "0")} ${ctx.currency ?? "PHP"}`,
        `  reference_number: ${ctx.reference}`,
        `  redirect_url: ${ctx.returnUrl}`,
      ].join("\n");
    }
    return `GET ${this.baseUrl}/payment-requests/${ctx.providerRef}`;
  }

  /**
   * One HTTP call to HitPay.
   *
   * Form-encoded, and with `X-Requested-With: XMLHttpRequest`, because that is
   * what HitPay's own PHP wrapper sends and what their guide documents as
   * required. The API reference also describes a JSON body; form encoding is
   * the one with two independent sources behind it.
   *
   * @returns {Promise<Object>} the parsed JSON body.
   * @throws {Error} on a non-2xx, carrying HitPay's own message where it gave one.
   */
  async #call(method, path, body = null) {
    const url = `${this.baseUrl}${path}`;
    const headers = {
      "X-BUSINESS-API-KEY": this.apiKey,
      "X-Requested-With": "XMLHttpRequest",
      Accept: "application/json",
    };

    if (body) headers["Content-Type"] = "application/x-www-form-urlencoded";

    let response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: body ? new URLSearchParams(body).toString() : undefined,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      // A timeout or DNS failure, not a rejection. Said as such, because the
      // caller's next decision — retry or give up — depends on the difference.
      throw new Error(`HitPay is unreachable: ${err.message}`);
    }

    const text = await response.text();
    let parsed = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }

    if (!response.ok) {
      // HitPay returns 422 with `message` and a field-level `errors` object.
      // Both are carried through: "amount must be at least 1" is worth seeing
      // in a log, and "request failed with 422" is not.
      const detail =
        parsed?.message ??
        (parsed?.errors ? JSON.stringify(parsed.errors) : text.slice(0, 300)) ??
        "no response body";
      throw new Error(`HitPay ${method} ${path} failed (${response.status}): ${detail}`);
    }

    return parsed ?? {};
  }

  /**
   * @param {import('./gateway.interface.js').PaymentRequest} request
   * @returns {Promise<import('./gateway.interface.js').PaymentSession>}
   */
  async createPayment(request) {
    if (!this.isConfigured()) {
      throw new Error(
        "HitPay: PAYMENT_HITPAY_API_KEY and PAYMENT_HITPAY_SALT must both be set"
      );
    }

    const payload = {
      // Major units, as a decimal string. See the note at the top of this file.
      amount: toDecimalString(request.amount),
      currency: (request.currency ?? "PHP").toUpperCase(),
      // The round-trip key. Everything that brings a callback back to the right
      // invoice hangs off this one field.
      reference_number: request.reference,
      purpose: request.description,
      // Always our own pay page, never a HitPay URL: the customer comes back
      // somewhere that re-checks the truth rather than to a gateway's idea of
      // what happened.
      redirect_url: request.returnUrl,
      // Single use. A repeatable link on a bill is a customer who can pay twice.
      allow_repeated_payments: "false",
      // HitPay emails and texts its own receipts if asked to. It is not asked
      // to: this system sends the payment confirmation, and two different
      // receipts for one payment is a support call.
      send_email: "false",
      send_sms: "false",
    };

    if (request.payerName) payload.name = request.payerName;
    if (request.payerEmail) payload.email = request.payerEmail;

    const created = await this.#call("POST", "/payment-requests", payload);

    return {
      providerRef: created.id,
      paymentUrl: created.url,
      status: OUTCOME_BY_STATUS[String(created.status).toLowerCase()] ?? "pending",
      expiresAt: created.expiry_date ? toTimestampLocal(created.expiry_date) : null,
      raw: created,
    };
  }

  /**
   * Constant-time compare of two hex digests.
   *
   * Both sides are hashed first. `timingSafeEqual` throws on a length mismatch,
   * and a plain `===` returns as soon as two characters differ — measurably
   * faster for a wrong first byte, which is enough to recover a signature one
   * byte at a time.
   */
  #matches(provided, expected) {
    if (!provided || !expected) return false;
    const a = crypto.createHash("sha256").update(String(provided)).digest();
    const b = crypto.createHash("sha256").update(String(expected)).digest();
    return crypto.timingSafeEqual(a, b);
  }

  /**
   * HitPay's v1 signature, from their own PHP wrapper:
   *
   *   foreach ($args as $key => $val) { $hmacSource[$key] = "{$key}{$val}"; }
   *   ksort($hmacSource);
   *   hash_hmac('sha256', implode("", array_values($hmacSource)), $secret);
   *
   * So: concatenate key and value with no separator, sort those strings BY KEY,
   * join with no separator, HMAC-SHA256. The `hmac` field itself is excluded.
   *
   * @param {Object<string,string>} fields
   * @returns {string} hex digest
   */
  #v1Signature(fields) {
    const source = Object.keys(fields)
      .filter((key) => key !== "hmac")
      .sort()
      .map((key) => `${key}${fields[key]}`)
      .join("");

    return crypto.createHmac("sha256", this.salt).update(source).digest("hex");
  }

  /**
   * Is this callback genuinely from HitPay?
   *
   * Fails closed with no salt configured. An unconfigured deployment must not
   * be an open door: anyone who found the URL could POST "invoice paid" and
   * reconnect themselves for free.
   *
   * @param {import('./gateway.interface.js').RawRequest} request
   * @returns {boolean}
   */
  verifyWebhook({ headers = {}, rawBody, contentType = "" } = {}) {
    if (!this.salt) return false;
    if (!rawBody || rawBody.length === 0) return false;

    const signature = headers["hitpay-signature"];

    // v2: signed over the exact bytes received. Verified from `rawBody` and
    // never from a re-serialised object — JSON.stringify does not promise to
    // reproduce byte-for-byte what arrived.
    if (signature) {
      const expected = crypto.createHmac("sha256", this.salt).update(rawBody).digest("hex");
      return this.#matches(signature, expected);
    }

    // v1: the signature travels inside a form-encoded body.
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const fields = Object.fromEntries(new URLSearchParams(rawBody.toString("utf8")));
      if (!fields.hmac) return false;
      return this.#matches(fields.hmac, this.#v1Signature(fields));
    }

    // Neither scheme. Not a HitPay callback, or a third one nobody has told us
    // about — either way, refusing is the only safe answer.
    return false;
  }

  /**
   * Normalise a verified callback.
   *
   * ── Where the event id comes from ───────────────────────────────────────
   *
   * HitPay does not send one, and the replay guard needs a key that repeats on
   * a retry and differs for a genuinely new event. The PAYMENT id is exactly
   * that: one per movement of money, stable however many times HitPay resends
   * the notification about it.
   *
   * A failure notification may carry no payment id at all, so that case falls
   * back to the payment request plus the status — still stable on retry, and
   * still distinct from the later "completed" event for the same request.
   *
   * @param {import('./gateway.interface.js').RawRequest} request
   * @returns {import('./gateway.interface.js').WebhookEvent}
   */
  parseWebhook({ headers = {}, rawBody, contentType = "" } = {}) {
    const isV1 =
      !headers["hitpay-signature"] && contentType.includes("application/x-www-form-urlencoded");

    return isV1 ? this.#parseV1(rawBody) : this.#parseV2(rawBody, headers);
  }

  /** Dashboard-registered webhook: a JSON payment_request object. */
  #parseV2(rawBody, headers) {
    const payload = JSON.parse(rawBody.toString("utf8"));

    const status = String(payload.status ?? headers["hitpay-event-type"] ?? "").toLowerCase();

    // `payments[]` carries the actual money movements. The last one is the one
    // that completed the request; earlier entries are failed attempts.
    const payments = Array.isArray(payload.payments) ? payload.payments : [];
    const settled = [...payments].reverse().find((p) => String(p.status).toLowerCase() === "succeeded" || String(p.status).toLowerCase() === "completed");
    const payment = settled ?? payments[payments.length - 1] ?? null;

    return {
      eventId: payment?.id
        ? `hitpay:payment:${payment.id}`
        : `hitpay:request:${payload.id}:${status}`,
      eventType: headers["hitpay-event-type"] ?? status ?? "unknown",
      outcome: OUTCOME_BY_STATUS[status] ?? "unknown",
      reference: payload.reference_number ?? null,
      providerPaymentId: payment?.id ?? null,
      providerRef: payload.id ?? null,
      // What actually arrived, not what was asked for. A partial payment must
      // read as its real amount so settlement can refuse it.
      amount: this.#amountOf(payment?.amount ?? payload.amount),
      channel: this.#channelOf(payment?.payment_type),
      paidAt: payment?.created_at ? toTimestampLocal(payment.created_at) : null,
      raw: payload,
    };
  }

  /** Legacy webhook: form-encoded flat fields. */
  #parseV1(rawBody) {
    const fields = Object.fromEntries(new URLSearchParams(rawBody.toString("utf8")));
    const status = String(fields.status ?? "").toLowerCase();

    return {
      eventId: fields.payment_id
        ? `hitpay:payment:${fields.payment_id}`
        : `hitpay:request:${fields.payment_request_id}:${status}`,
      eventType: status || "unknown",
      outcome: OUTCOME_BY_STATUS[status] ?? "unknown",
      reference: fields.reference_number ?? null,
      providerPaymentId: fields.payment_id ?? null,
      providerRef: fields.payment_request_id ?? null,
      amount: this.#amountOf(fields.amount),
      channel: this.#channelOf(fields.payment_type),
      paidAt: null,
      raw: fields,
    };
  }

  /** `?? null` rather than a falsy check: an amount of 0 is a real value. */
  #amountOf(value) {
    if (value === undefined || value === null || value === "") return null;
    return toDecimalString(value);
  }

  /** 'paynow_online' → 'PAYNOW_ONLINE'. Our own column is uppercase. */
  #channelOf(value) {
    return value ? String(value).toUpperCase() : null;
  }

  /**
   * Read a payment request's current state straight from HitPay.
   *
   * The reconciliation safety net: this is what catches a payment whose
   * callback never arrived, so somebody who paid is never left disconnected
   * because of a webhook outage.
   *
   * @param {string} providerRef
   */
  async getPayment(providerRef) {
    const found = await this.#call("GET", `/payment-requests/${providerRef}`);
    const status = String(found.status ?? "").toLowerCase();

    const payments = Array.isArray(found.payments) ? found.payments : [];
    const payment = payments[payments.length - 1] ?? null;

    return {
      outcome: OUTCOME_BY_STATUS[status] ?? "unknown",
      amount: this.#amountOf(payment?.amount ?? found.amount),
      paidAt: payment?.created_at ? toTimestampLocal(payment.created_at) : null,
      raw: found,
    };
  }
}

export default HitPayGateway;
