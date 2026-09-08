/**
 * The payment gateway port.
 *
 * Every gateway this system can collect through implements this contract, and
 * nothing outside `lib/payment-gateways/` knows which one is in use. Switching
 * provider is a new adapter file plus one environment variable.
 *
 * ── Designed against three gateways, not one ────────────────────────────────
 *
 * A port shaped around a single vendor inherits that vendor's model and stops
 * fitting the second one. This contract was drawn against the real request and
 * callback shapes of Xendit, PayMongo and Dragonpay, because they disagree in
 * every place a naive interface would assume agreement:
 *
 *   Amount unit     whole pesos │ centavos │ decimal string
 *   Callback body   JSON        │ JSON     │ form-encoded
 *   Authentication  static token in a header
 *                               │ HMAC-SHA256 over `timestamp.rawBody`
 *                                          │ SHA1 digest of concatenated fields
 *   Paid status     "PAID"/"SETTLED"
 *                               │ "link.payment.paid"
 *                                          │ "S"
 *   Our reference   externalId  │ remarks / metadata │ txnid
 *
 * Three consequences the contract has to carry, and does:
 *
 *   1. Verification receives the RAW request body, never the parsed one. HMAC
 *      is computed over exact bytes, and this app's sanitise middleware
 *      rewrites `req.body` before any controller sees it.
 *   2. Adapters normalise statuses into our own small vocabulary. A caller
 *      must never compare against a provider's string.
 *   3. Amount conversion happens here, at the boundary, through `amounts.js` —
 *      never in billing code.
 *
 * ── What an adapter must not do ─────────────────────────────────────────────
 *
 * Touch the database, settle an invoice, or send anything to a customer. An
 * adapter translates between this system and one HTTP API; everything that
 * decides what a payment *means* lives in `lib/payments/`, so the rules stay
 * identical no matter who is collecting the money.
 */

/**
 * What we ask a gateway to collect.
 *
 * @typedef {Object} PaymentRequest
 * @property {string} reference our invoice number; the round-trip key that
 *   brings a callback back to the right invoice.
 * @property {string} amount canonical 2dp string, e.g. "1200.00". Adapters
 *   convert; callers never do.
 * @property {string} currency ISO code, always "PHP" here.
 * @property {string} description shown to the customer at checkout.
 * @property {string} payerName
 * @property {string} payerEmail
 * @property {string} returnUrl where the customer lands afterwards — always
 *   our own `/pay/<token>` page, never a gateway URL, so the page can re-check
 *   the truth when a callback has not arrived yet.
 * @property {number} [expiresInSeconds] how long the checkout stays valid.
 */

/**
 * What a gateway gives back.
 *
 * @typedef {Object} PaymentSession
 * @property {string} providerRef the gateway's id for this attempt.
 * @property {string} paymentUrl where to send the customer.
 * @property {'pending'|'paid'|'failed'|'expired'|'cancelled'} status
 * @property {string|null} expiresAt 'YYYY-MM-DD HH:mm:ss' Manila local, or null.
 * @property {Object} raw the untouched response, stored for forensics.
 */

/**
 * One callback, normalised.
 *
 * @typedef {Object} WebhookEvent
 * @property {string} eventId the gateway's own id for this event — the replay
 *   key. Must be stable across retries of the same event and different for a
 *   genuinely new one.
 * @property {string} eventType the provider's raw event name, for the log.
 * @property {'paid'|'failed'|'expired'|'pending'|'unknown'} outcome
 * @property {string|null} reference our invoice number, as it came back.
 * @property {string|null} providerPaymentId identifies the money movement, and
 *   becomes the payment row's idempotency key.
 * @property {string|null} providerRef the attempt this settles, when given.
 * @property {string|null} amount canonical 2dp string of what actually
 *   arrived — not what was asked for.
 * @property {string|null} channel how they paid: 'GCASH', 'QRPH', 'CARD'…
 * @property {string|null} paidAt 'YYYY-MM-DD HH:mm:ss' Manila local.
 * @property {Object} raw the parsed body, verbatim.
 */

/**
 * The inbound request, as handed to verification and parsing.
 *
 * @typedef {Object} RawRequest
 * @property {Object} headers lower-cased header names.
 * @property {Buffer} rawBody the exact bytes received. Signature verification
 *   MUST use this — a re-serialised body will not match, and the parsed body
 *   has already been through the sanitiser.
 * @property {string} contentType
 */

/* eslint-disable no-unused-vars */

/**
 * The contract. Adapters extend this and override everything.
 *
 * A base class rather than a bare object so an unimplemented method fails
 * loudly at the call site, naming itself, instead of returning `undefined` and
 * being discovered three layers away as a null payment URL in a customer's
 * email.
 */
export class PaymentGateway {
  /**
   * @param {Object} [config] provider credentials and options, from env.
   */
  constructor(config = {}) {
    this.config = config;
  }

  /** Stable slug stored on `payments.provider`, e.g. "xendit". */
  get name() {
    throw new Error("A payment gateway must declare a name");
  }

  /** Human-readable, for the settings screen. */
  get label() {
    return this.name;
  }

  /**
   * Is this gateway usable right now?
   *
   * Callers degrade rather than fail: with nothing configured the billing cycle
   * still issues and emails invoices, they simply carry no Pay button. That is
   * what lets the system run end to end on a machine with no credentials.
   *
   * @returns {boolean}
   */
  isConfigured() {
    return false;
  }

  /**
   * Are we pointed at test credentials?
   *
   * Surfaced so the UI and logs can say TEST MODE loudly. Silently running
   * against live keys is how somebody charges a real card during a demo.
   *
   * @returns {boolean|null} null when it cannot be determined — the caller
   *   should warn rather than assume either way.
   */
  isTestMode() {
    return null;
  }

  /**
   * Describe what a call would do, without making it.
   *
   * The same affordance the OLT drivers carry: it makes a dry run show the
   * real request rather than a summary of one, which is the difference between
   * a rehearsal and a guess.
   *
   * @param {'createPayment'|'getPayment'} action
   * @param {Object} ctx
   * @returns {string}
   */
  describe(action, ctx = {}) {
    return `${this.name}: ${action} ${JSON.stringify(ctx)}`;
  }

  /**
   * Open a checkout for one invoice.
   *
   * Must be safe to call twice for the same `reference` — either by reusing an
   * open session or by the caller's own guard. Two live sessions for one bill
   * is a customer who can pay twice.
   *
   * @param {PaymentRequest} request
   * @returns {Promise<PaymentSession>}
   */
  async createPayment(request) {
    throw new Error(`${this.name}: createPayment is not implemented`);
  }

  /**
   * Is this callback genuinely from the gateway?
   *
   * Must fail CLOSED — with nothing configured, reject. An unconfigured
   * deployment must not be an open door: anyone who found the URL could POST
   * "invoice paid" and reconnect themselves for free.
   *
   * @param {RawRequest} request
   * @returns {boolean}
   */
  verifyWebhook(request) {
    return false;
  }

  /**
   * Normalise a verified callback.
   *
   * Called only after {@link verifyWebhook} passes. Parse from `rawBody`, not
   * from anything Express has already touched.
   *
   * @param {RawRequest} request
   * @returns {WebhookEvent}
   */
  parseWebhook(request) {
    throw new Error(`${this.name}: parseWebhook is not implemented`);
  }

  /**
   * Read a payment's current state directly from the gateway.
   *
   * The reconciliation safety net: this is what catches a payment whose
   * callback never arrived, so a customer who paid is never left disconnected
   * because of somebody else's outage.
   *
   * @param {string} providerRef
   * @returns {Promise<{outcome: string, amount: string|null, paidAt: string|null, raw: Object}>}
   */
  async getPayment(providerRef) {
    throw new Error(`${this.name}: getPayment is not implemented`);
  }

  /**
   * What to answer the gateway with on success.
   *
   * Most expect any 2xx. Dragonpay expects the literal body `result=OK` and
   * will keep retrying without it — which is exactly the kind of provider
   * quirk that belongs in an adapter rather than in a shared controller.
   *
   * @returns {{status: number, body: string, contentType: string}}
   */
  webhookAck() {
    return { status: 200, body: JSON.stringify({ received: true }), contentType: "application/json" };
  }
}

/** The outcomes an adapter may report. Anything else is a bug in the adapter. */
export const OUTCOMES = Object.freeze(["paid", "failed", "expired", "pending", "unknown"]);

/** Attempt states, mirroring `payment_attempts.status`. */
export const ATTEMPT_STATUSES = Object.freeze([
  "pending",
  "paid",
  "failed",
  "expired",
  "cancelled",
]);

export default { PaymentGateway, OUTCOMES, ATTEMPT_STATUSES };
