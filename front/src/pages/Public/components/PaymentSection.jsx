import { useState } from "react";
import { CreditCard, FlaskConical, Loader2, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * The pay half of the customer's invoice page.
 *
 * ── Three states, and the button only exists in one ─────────────────────────
 *
 * Whether online payment is possible is decided by the server and sent on the
 * invoice, never inferred here. A Pay button that appears because the browser
 * guessed, then fails because no gateway is configured, is worse than no button
 * at all: the customer believes they have tried to pay.
 *
 *   online enabled   → Pay now
 *   no gateway       → say so, and say what to do instead
 *   mock gateway     → the simulator, clearly labelled as not real money
 */

/** Plain fetch: this page carries no auth and no CSRF token. */
const post = async (path, body) => {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const parsed = await res.json().catch(() => null);
  if (!res.ok) throw new Error(parsed?.message || "Something went wrong");
  return parsed;
};

/**
 * The simulator, shown when a mock checkout has sent the customer back here
 * with `?simulate=<ref>`.
 *
 * It stands in for a hosted payment page, and it settles by POSTing a signed
 * callback at the real webhook endpoint — the same path a live payment takes,
 * through verification, the replay guard and settlement, rather than around
 * them. A shortcut that wrote `status = 'paid'` directly would prove nothing.
 */
const Simulator = ({ token, providerRef, onSettled }) => {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  const run = async (outcome) => {
    setBusy(outcome);
    setError(null);
    try {
      const prepared = await post(`/api/v1/public/invoices/${token}/simulate`, {
        providerRef,
        outcome,
      });

      const { webhookPath, signatureHeader, signature, body } = prepared.data;

      const delivered = await fetch(webhookPath, {
        method: "POST",
        headers: { "Content-Type": "application/json", [signatureHeader]: signature },
        body,
      });

      if (!delivered.ok) {
        throw new Error(`The gateway callback was rejected (${delivered.status})`);
      }

      onSettled?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      className="px-4 py-4"
      style={{
        borderRadius: 10,
        border: "1px dashed var(--color-warning)",
        background: "color-mix(in srgb, var(--color-warning) 6%, transparent)",
      }}
    >
      <p
        className="m-0 inline-flex items-center gap-2 font-semibold"
        style={{ fontSize: 13, color: "var(--color-warning)" }}
      >
        <FlaskConical className="h-4 w-4" />
        Test checkout — no real money moves
      </p>
      <p className="m-0 mt-1.5" style={{ fontSize: 12.5, color: "var(--color-text-secondary)" }}>
        This stands in for the payment gateway&apos;s page. Choosing an outcome sends the
        same signed callback a real gateway would.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={Boolean(busy)} onClick={() => run("paid")}>
          {busy === "paid" ? <Loader2 className="animate-spin" /> : null}
          Simulate successful payment
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={Boolean(busy)}
          onClick={() => run("failed")}
        >
          {busy === "failed" ? <Loader2 className="animate-spin" /> : null}
          Simulate failure
        </Button>
      </div>

      {error && (
        <p className="m-0 mt-3" style={{ fontSize: 12.5, color: "var(--color-error)" }}>
          {error}
        </p>
      )}
    </div>
  );
};

/**
 * @param {Object} props
 * @param {string} props.token the invoice's public token, from the URL.
 * @param {Object} props.invoice the public invoice, including `payment`.
 * @param {string|null} props.simulateRef `?simulate=<ref>` when returning from
 *   a mock checkout.
 * @param {Function} props.onSettled refetch, once a payment has been applied.
 */
const PaymentSection = ({ token, invoice, simulateRef, onSettled }) => {
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState(null);

  const payment = invoice.payment ?? {};

  const startCheckout = async () => {
    setStarting(true);
    setError(null);
    try {
      const result = await post(`/api/v1/public/invoices/${token}/pay`);
      // A full assignment rather than a router navigation: the checkout is the
      // gateway's page, not ours.
      window.location.assign(result.data.paymentUrl);
    } catch (err) {
      setError(err.message);
      setStarting(false);
    }
  };

  if (simulateRef) {
    return <Simulator token={token} providerRef={simulateRef} onSettled={onSettled} />;
  }

  // No gateway configured. Say what to do instead rather than showing a button
  // that cannot work.
  if (!payment.online) {
    return (
      <div
        className="px-4 py-4 text-center"
        style={{ borderRadius: 10, border: "1px dashed var(--color-line)" }}
      >
        <p className="m-0" style={{ fontSize: 13.5, color: "var(--color-text-secondary)" }}>
          Online payment is not available right now.
        </p>
        <p className="m-0 mt-1.5" style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
          Please settle this at the office, or contact{" "}
          {invoice.companyEmail ? (
            <a href={`mailto:${invoice.companyEmail}`} style={{ color: "var(--color-link)" }}>
              {invoice.companyEmail}
            </a>
          ) : (
            "your provider"
          )}
          {invoice.companyPhone ? ` or ${invoice.companyPhone}` : ""}.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Said before they click, not after. Somebody testing a real deployment
          needs to know the difference immediately. */}
      {payment.testMode && (
        <p
          className="m-0 mb-3 inline-flex items-center gap-1.5"
          style={{ fontSize: 12, color: "var(--color-warning)" }}
        >
          <FlaskConical className="h-3.5 w-3.5" />
          Test mode — no real money will move
        </p>
      )}

      <Button type="button" size="lg" className="w-full" disabled={starting} onClick={startCheckout}>
        {starting ? <Loader2 className="animate-spin" /> : <CreditCard />}
        Pay {invoice.total ? "now" : ""}
      </Button>

      <p
        className="m-0 mt-2.5 text-center"
        style={{ fontSize: 12, color: "var(--color-text-muted)" }}
      >
        You will be taken to a secure payment page.
      </p>

      {error && (
        <p
          className="m-0 mt-3 inline-flex items-start gap-1.5"
          style={{ fontSize: 12.5, color: "var(--color-error)" }}
        >
          <TriangleAlert className="h-3.5 w-3.5 shrink-0" style={{ marginTop: 1 }} />
          {error}
        </p>
      )}
    </div>
  );
};

export default PaymentSection;
