import { PaymentGateway, ATTEMPT_STATUSES, OUTCOMES } from "./gateway.interface.js";
import { MockGateway } from "./mock.gateway.js";
import APIError from "../../utils/APIError.js";

export { PaymentGateway, MockGateway, ATTEMPT_STATUSES, OUTCOMES };

/**
 * Gateway resolution — the one place that knows which provider is in use.
 *
 * ── Why the provider comes from the environment, not the database ───────────
 *
 * Every other setting in this system is per company, in `system_settings`, and
 * this one deliberately is not.
 *
 * A callback arrives before we know whose it is. Verifying it needs the secret;
 * finding the company needs the invoice; finding the invoice needs the verified
 * payload. Putting credentials behind a tenant lookup makes that circular, and
 * the usual escape — try every tenant's key until one verifies — is an oracle
 * that tells an attacker when they have guessed a valid secret.
 *
 * It also happens to be the right shape for the deployment: one ISP, one box,
 * one merchant account. Secrets stay in the environment where the rest of the
 * infrastructure keeps them, rather than in a database row that ends up in a
 * backup somebody emails.
 *
 * The System settings screen shows which provider is live and whether it is in
 * test mode. That is a read, and it is enough.
 *
 * ── Adding a gateway ────────────────────────────────────────────────────────
 *
 * Write the adapter, add a case below, add its env keys to `.env.example`.
 * Nothing else in the codebase changes — not the billing engine, not
 * settlement, not the pay page, not the webhook controller.
 */

/** Adapters wired up. The value is a factory, so nothing is built until asked. */
const REGISTRY = {
  mock: () => new MockGateway(),
};

/**
 * Providers that have an adapter, for the settings screen and error messages.
 * @returns {string[]}
 */
export const availableProviders = () => Object.keys(REGISTRY);

/**
 * Which provider is configured. `mock` when unset, so a fresh checkout runs.
 * @returns {string}
 */
export const configuredProvider = () => process.env.PAYMENT_PROVIDER || "mock";

/**
 * The gateway for a given provider slug, or the configured one.
 *
 * @param {string} [provider] defaults to `PAYMENT_PROVIDER`.
 * @returns {PaymentGateway}
 * @throws {APIError} 501 when no adapter exists for that slug.
 *
 * @example
 *   const gateway = resolveGateway();
 *   const session = await gateway.createPayment({ reference: invoiceNo, … });
 */
export const resolveGateway = (provider = configuredProvider()) => {
  const factory = REGISTRY[provider];

  if (!factory) {
    // Named, and listing what does exist — a typo in an env var should not
    // present as a mysterious payment failure.
    throw new APIError(
      `No payment gateway adapter for '${provider}'. Available: ${availableProviders().join(", ")}`,
      501,
      "NOT_IMPLEMENTED"
    );
  }

  return factory();
};

/**
 * Whether payments can be taken online right now.
 *
 * Callers degrade rather than fail: with nothing configured, invoices still
 * issue and email, they just carry no Pay button. Nobody should have to hold
 * merchant credentials to run the billing cycle.
 *
 * @returns {boolean}
 */
export const isOnlinePaymentEnabled = () => {
  try {
    return resolveGateway().isConfigured();
  } catch {
    return false;
  }
};

/**
 * A summary for the settings screen and the health endpoint.
 *
 * `testMode` is reported honestly, including the `null` an adapter returns when
 * it cannot tell from the key it was given — the UI should say "unrecognised"
 * rather than pick the reassuring answer.
 *
 * @returns {{provider: string, label: string, configured: boolean, testMode: boolean|null, available: string[]}}
 */
export const gatewayStatus = () => {
  const provider = configuredProvider();

  try {
    const gateway = resolveGateway(provider);
    return {
      provider,
      label: gateway.label,
      configured: gateway.isConfigured(),
      testMode: gateway.isTestMode(),
      available: availableProviders(),
    };
  } catch {
    return {
      provider,
      label: provider,
      configured: false,
      testMode: null,
      available: availableProviders(),
    };
  }
};

export default {
  resolveGateway,
  configuredProvider,
  availableProviders,
  isOnlinePaymentEnabled,
  gatewayStatus,
};
