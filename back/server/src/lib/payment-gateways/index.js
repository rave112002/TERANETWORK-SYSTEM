import { PaymentGateway, ATTEMPT_STATUSES, OUTCOMES } from "./gateway.interface.js";
import { HitPayGateway } from "./hitpay.gateway.js";
import { MockGateway } from "./mock.gateway.js";
import APIError from "../../utils/APIError.js";
import { logger } from "../../../config/logger.js";

export { PaymentGateway, HitPayGateway, MockGateway, ATTEMPT_STATUSES, OUTCOMES };

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
  hitpay: () => new HitPayGateway(),
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
 * Which provider a branch collects through.
 *
 * `branches.paymentProvider` when set, the company default otherwise. NULL is
 * the normal state for a branch nobody has thought about, and following the
 * default is the right answer for it.
 *
 * ── Why this reads the database when the credentials do not ─────────────────
 *
 * The two questions are different, and only one of them is circular.
 *
 * "Which gateway should this invoice's Pay button open?" is asked while holding
 * the invoice, so the branch is already known. "Is this callback genuine?" is
 * asked before anything is known — and that one takes its secret from the
 * provider slug in the webhook URL, never from a lookup. Choosing the gateway
 * per branch therefore costs nothing in the place that could not afford it.
 *
 * A row that names a provider with no adapter is treated as unset rather than
 * fatal. A typo in a settings field should not take down billing for a branch;
 * it should collect through the company default and be visible on the screen
 * that set it.
 *
 * @param {Object} db
 * @param {string|null} branchId
 * @returns {Promise<string>} a provider slug.
 */
export const providerForBranch = async (db, branchId) => {
  const fallback = configuredProvider();
  if (!branchId) return fallback;

  const rows = await db.query(
    `SELECT paymentProvider FROM branches WHERE branchId = ? LIMIT 1`,
    [branchId]
  );

  const chosen = rows[0]?.paymentProvider;
  if (!chosen) return fallback;

  if (!REGISTRY[chosen]) {
    logger.error(
      `🚨 [payments] branch ${branchId} is set to collect through '${chosen}', which has no ` +
        `adapter. Falling back to '${fallback}'. Available: ${availableProviders().join(", ")}`
    );
    return fallback;
  }

  return chosen;
};

/**
 * The gateway a given branch collects through.
 *
 * @param {Object} db
 * @param {string|null} branchId
 * @returns {Promise<PaymentGateway>}
 *
 * @example
 *   const gateway = await resolveGatewayForBranch(db, invoice.branchId);
 *   const session = await gateway.createPayment({ reference: invoice.invoiceNo, … });
 */
export const resolveGatewayForBranch = async (db, branchId) =>
  resolveGateway(await providerForBranch(db, branchId));

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
 * @param {string} [provider] defaults to the company-wide `PAYMENT_PROVIDER`.
 *   Pass a branch's provider to describe what THAT branch collects through.
 * @returns {{provider: string, label: string, configured: boolean, testMode: boolean|null, available: string[]}}
 */
export const gatewayStatus = (provider = configuredProvider()) => {
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

/**
 * The same summary, for one branch's gateway.
 *
 * The pay page needs this rather than {@link gatewayStatus}: it decides whether
 * a Pay button is shown at all, and the company default may be a different
 * gateway from the one this invoice would actually be collected through. Ask
 * the wrong one and a customer either gets no button when checkout would have
 * worked, or a button that leads nowhere.
 *
 * @param {Object} db
 * @param {string|null} branchId
 * @returns {Promise<{provider: string, label: string, configured: boolean, testMode: boolean|null, available: string[]}>}
 */
export const gatewayStatusForBranch = async (db, branchId) =>
  gatewayStatus(await providerForBranch(db, branchId));

export default {
  resolveGateway,
  gatewayStatusForBranch,
  resolveGatewayForBranch,
  providerForBranch,
  configuredProvider,
  availableProviders,
  isOnlinePaymentEnabled,
  gatewayStatus,
};
