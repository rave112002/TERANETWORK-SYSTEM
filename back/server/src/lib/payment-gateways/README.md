# Adding a payment gateway

Everything provider-specific lives in this folder. Nothing outside it knows
which gateway is collecting money — not the billing engine, not settlement, not
the pay page, not the webhook controller.

Writing an adapter is one file, one line in `index.js`, and a few env keys.

---

## The five things that differ between gateways

The port was drawn against these three because they disagree everywhere a naive
interface would assume agreement. Check your provider against each row **before**
writing code — every one of these has a cheap right answer and an expensive
wrong one.

| | Xendit | PayMongo | Dragonpay |
| --- | --- | --- | --- |
| **Amount unit** | whole pesos (`1200`) | centavos (`120000`) | decimal string (`"1200.00"`) |
| **Callback body** | JSON, snake_case | JSON, JSON:API nesting | **form-encoded** |
| **Authentication** | static token in `x-callback-token` | HMAC-SHA256 over `` `${t}.${rawBody}` `` in `Paymongo-Signature` | SHA1 digest of `txnid:refno:status:message:secret` |
| **Paid status** | `PAID`, `SETTLED` | `link.payment.paid` | `S` |
| **Our reference** | `externalId` | `remarks` / checkout metadata | `txnid` |

### The amount unit is the one that will hurt you

Xendit takes whole pesos and PayMongo takes centavos — a factor of one hundred
in opposite directions. Get it wrong and you either bill somebody a hundred
times their subscription or collect one percent of it, and **nothing downstream
catches it**: `settleInvoice()` requires the payment to equal the invoice total
exactly, so an underpaid invoice stays unpaid and the customer stays
disconnected *after paying you*.

Never write `* 100`. Use `amounts.js`:

```js
import { toCentavos, fromCentavos } from "./amounts.js";

toCentavos("1200.00");   // 120000  — outbound
fromCentavos(120000);    // "1200.00" — inbound
```

`toWholePesos()` throws on a fractional amount rather than rounding, because
rounding hides exactly the mistake it exists to catch.

The Xendit figure is not inference: V2 confirmed `amount: 4999` with
`currency: 'PHP'` renders as PHP 4,999.00 on a live sandbox checkout. Xendit's
own docs cannot settle it — every example is IDR, whose sub-unit has been dead
for decades, so whole and minor units are the same number there.

---

## Writing the adapter

```js
import { PaymentGateway } from "./gateway.interface.js";
import { toCentavos, fromCentavos } from "./amounts.js";

export class AcmeGateway extends PaymentGateway {
  get name() { return "acme"; }          // stored on payments.provider
  get label() { return "Acme Payments"; }

  get secretKey() { return process.env.ACME_SECRET_KEY || ""; }

  isConfigured() { return Boolean(this.secretKey); }

  isTestMode() {
    if (!this.secretKey) return null;
    if (this.secretKey.startsWith("sk_test_")) return true;
    if (this.secretKey.startsWith("sk_live_")) return false;
    return null;                          // unrecognised — say unknown, never guess
  }

  async createPayment(request) { /* → PaymentSession */ }
  verifyWebhook(request)       { /* → boolean, over request.rawBody */ }
  parseWebhook(request)        { /* → WebhookEvent */ }
  async getPayment(providerRef){ /* → { outcome, amount, paidAt, raw } */ }
}
```

Register it:

```js
// index.js
const REGISTRY = {
  mock: () => new MockGateway(),
  acme: () => new AcmeGateway(),
};
```

Then `PAYMENT_PROVIDER=acme`. Nothing else changes.

---

## Rules an adapter must follow

**Verify over `request.rawBody`, never `request.parsedBody`.** A signature is
computed over exact bytes; a re-serialised object differs in key order and
number formatting. Worse, this app's `sanitizeMiddleware` rewrites `req.body`
before any controller sees it, so the parsed body is not even the same data.
`express.js` stashes the untouched buffer for this reason.

**Fail closed.** `verifyWebhook` returns `false` when nothing is configured. An
endpoint that accepts unsigned callbacks is a reconnect-yourself-for-free
button, and "we haven't set the key yet" is exactly when it is undefended.

**Compare secrets in constant time.** `===` returns as soon as two bytes
differ, which is measurably faster for a wrong first byte — enough to recover a
signature one byte at a time. Hash both sides and use
`crypto.timingSafeEqual`; hashing also guarantees the equal lengths it
requires, so a malformed header cannot crash the endpoint.

**Normalise statuses.** Return one of `paid`, `failed`, `expired`, `pending`,
`unknown` — never the provider's own string. Map generously toward *paid* when
a provider has several success states (Xendit's `PAID` and `SETTLED`): treating
one as unpaid leaves a paying customer disconnected, which is the expensive
direction to be wrong in. Anything unrecognised is `unknown`, which is recorded
and not acted on.

**Give a stable `eventId`.** The replay guard is `UNIQUE(provider, eventId)`,
and it is only as good as this. A retry of the same event must repeat its id; a
genuinely later event about the same payment must not. Prefer the provider's
payment id; if there is none, combine the object id with the status, so
`PAID` then `SETTLED` are two events rather than one swallowed as a duplicate.

**Do not touch the database.** No settling, no emailing, no queueing. An adapter
translates between this system and one HTTP API. Everything that decides what a
payment *means* lives in `../payments/`, which is what keeps the rules identical
whoever is collecting.

**Report the amount that arrived, not the one requested.** Providers send both.
Using the requested amount would let an underpayment settle a bill.

**Never log the error object wholesale.** SDK errors echo request headers back,
and your secret key travels in those. Log `err.message`.

---

## Testing it

`gateway.test.js` tests the mock, and its cases are the checklist: reuse an open
session, reject an unsigned body, reject a tampered body, fail closed
unconfigured, survive a wrong-length signature, keep event ids stable across
retries, treat a zero amount as real. Copy the file and point it at your
adapter with a sandbox key.

`amounts.test.js` guards the hundredfold error. If you add a unit, add a case.

Then run the S8 end-to-end suite with `PAYMENT_PROVIDER` set to your adapter.
Everything except the simulator applies unchanged, because none of it knows
which gateway it is talking to.

---

## Why credentials come from the environment

Every other setting in this system is per company, in `system_settings`. This
one is not, deliberately.

A callback arrives before we know whose it is. Verifying it needs the secret;
finding the company needs the invoice; finding the invoice needs the verified
payload. Putting credentials behind a tenant lookup makes that circular, and the
usual escape — try every tenant's key until one verifies — is an oracle that
tells an attacker when they have guessed a valid secret.

It also suits the deployment: one ISP, one box, one merchant account. The System
settings screen shows which provider is live and whether it is in test mode.
That is a read, and it is enough.

---

## Running two gateways at once

Supported, and usually the right way to change provider: register both adapters,
point `PAYMENT_PROVIDER` at the new one, and let the old one's callbacks keep
settling invoices already in flight. `payments.provider` records which gateway
took each payment, so revenue stays attributable and the ledger reads correctly
with both in it.
