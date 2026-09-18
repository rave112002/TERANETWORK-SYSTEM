import express from "express";

import { catchAsync } from "../../../utils/catchAsync.js";
import { logger } from "../../../../config/logger.js";
import { processWebhookEvent, recordWebhookEvent } from "../../../lib/payments/webhook.service.js";
import { availableProviders, resolveGateway } from "../../../lib/payment-gateways/index.js";

const router = express.Router();

/**
 * Payment gateway callbacks.
 *
 * One endpoint per provider slug, one shared body. The adapter verifies and
 * normalises; `lib/payments/webhook.service.js` decides what it means. Nothing
 * in this file knows which gateway is talking to it.
 *
 * ── Why this route is not behind CSRF or auth ───────────────────────────────
 *
 * A gateway is a server, not a browser: it holds no cookie and cannot fetch a
 * CSRF token. The signature IS the authentication, which is why
 * {@link PaymentGateway#verifyWebhook} must fail closed — an endpoint that
 * accepts unsigned callbacks is a reconnect-yourself-for-free button.
 *
 * ── What the status code means to a gateway ─────────────────────────────────
 *
 * Every provider treats a non-2xx as "resend later", usually several times over
 * some hours. That makes the response a control signal, not a formality:
 *
 *   200  handled, or permanently unhandleable — stop sending
 *   401  the signature did not verify — stop sending
 *   500  we failed in a way a retry might fix — please resend
 *
 * The dangerous mistake is answering 200 on an internal error: the payment is
 * lost, the customer stays disconnected, and nothing ever asks again. So an
 * unexpected failure deliberately answers 500 and takes the retry.
 */

/**
 * POST /:provider
 */
router.post(
  "/:provider",
  catchAsync(async (req, res) => {
    const { provider } = req.params;

    if (!availableProviders().includes(provider)) {
      // 404, not 501: an unknown slug is almost always a stale URL configured
      // in a gateway dashboard, and there is nothing to retry.
      logger.warn(`[webhook] callback for unknown provider '${provider}'`);
      return res.status(404).json({ error: "Unknown payment provider" });
    }

    const gateway = resolveGateway(provider);

    const request = {
      headers: req.headers,
      // The exact bytes. Never `req.body` — sanitizeMiddleware has rewritten
      // that, and a signature is computed over what was actually sent.
      rawBody: req.rawBody,
      contentType: req.headers["content-type"] ?? "",
    };

    if (!gateway.verifyWebhook(request)) {
      // Recorded before rejecting. A run of failures is either a
      // misconfiguration or somebody probing the endpoint, and neither is
      // visible if rejected callbacks leave no trace.
      //
      // Keyed on the clock rather than an event id, because an unverified body
      // cannot be trusted to supply one.
      await recordWebhookEvent(req.db, {
        provider,
        eventId: `unverified:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
        eventType: "signature_failed",
        signatureVerified: false,
        payload: { contentType: request.contentType, bytes: req.rawBody?.length ?? 0 },
      }).catch(() => {});

      logger.error(`🚨 [webhook] ${provider}: signature verification FAILED — rejecting`);
      return res.status(401).json({ error: "Invalid signature" });
    }

    let event;
    try {
      event = gateway.parseWebhook(request);
    } catch (err) {
      // Verified but unparseable: the provider changed their payload shape, or
      // sent an event type this adapter does not model. Retrying cannot fix
      // either, so it is recorded and acknowledged rather than looped on.
      logger.error(`🚨 [webhook] ${provider}: could not parse a verified callback: ${err.message}`);
      await recordWebhookEvent(req.db, {
        provider,
        eventId: `unparseable:${Date.now()}`,
        eventType: "parse_failed",
        signatureVerified: true,
        payload: { error: err.message },
      }).catch(() => {});
      return res.status(200).json({ received: true, handled: false });
    }

    const result = await processWebhookEvent(req.db, provider, event, {
      signatureVerified: true,
    });

    if (result.retryable) {
      return res.status(500).json({ error: "Processing failed, please retry" });
    }

    // The provider's own idea of a successful acknowledgement. Most accept any
    // 2xx; Dragonpay wants the literal body `result=OK` and keeps resending
    // without it — the kind of quirk that belongs in an adapter.
    const ack = gateway.webhookAck();
    res.status(ack.status).type(ack.contentType).send(ack.body);
    return undefined;
  })
);

export default router;
