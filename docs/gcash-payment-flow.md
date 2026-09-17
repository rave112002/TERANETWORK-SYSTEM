# GCash Business payment flow — Option A

**Created:** 2026-09-16
**Status:** Direction decided ([D8](migration/00-decisions.md#d8--gcash-business-merchant-qr-on-the-invoice-option-a-hitpay-parked)).
**Integration not built.** Waiting on the client's GCash Business account, product details and
documentation.
**Deployment context:** one locally deployed installation per branch
([D7](migration/00-decisions.md#d7--one-branch-per-installation)).

---

## 1. The decision in one paragraph

Every invoice carries the client's **GCash Business merchant QR**: one static QR, the same on
every invoice. The subscriber scans it in the GCash app and pays. The money lands in the ISP's GCash
Business account. This system then **gets the GCash transaction information, matches it to the
customer's invoice, marks the invoice paid, and restores service**. That replaces the Google Sheet
the client uses today. There is **no QR per invoice**, **no checkout session**, and **no public
endpoint** unless the GCash product the client receives turns out to need one.

---

## 2. The business flow

The client's process today:

```
GCash  →  Google Sheets  →  MikroTik
```

The target, with **Google Sheets replaced entirely by this system**:

```
 ┌──────────────────────┐
 │ ISP Billing System    │  1. generates the invoice
 │                       │  2. invoice carries the GCash Business merchant QR
 └──────────┬────────────┘  3. sent to the subscriber by email / SMS
            ▼
 ┌──────────────────────┐
 │ Subscriber            │  4. scans the QR in the GCash app
 │                       │  5. pays the invoice amount
 └──────────┬────────────┘
            ▼
 ┌──────────────────────┐
 │ ISP's GCash Business  │  6. payment received
 │ account               │
 └──────────┬────────────┘
            ▼  7. the system obtains / checks the transaction information
 ┌──────────────────────┐     (mechanism to be decided: see §5)
 │ ISP Billing System    │  8. matches the payment to the customer and invoice
 │                       │  9. updates payment and invoice status
 └──────────┬────────────┘
            ▼  10. once confirmed, applies the service action
 ┌──────────────────────┐
 │ OLT / MikroTik        │  service restored
 └──────────────────────┘
```

---

## 3. What already exists, and what Option A changes

| Area | Today in the codebase | Under Option A |
| --- | --- | --- |
| **QR on the invoice** | `lib/qr/payQr.js` encodes **this system's** `/pay/<token>` URL. `invoice.render.js` and `email.processor.js` put that QR and link on the PDF and email. | The QR is the client's **static merchant QR image**. The `/pay/<token>` page is built for customers reaching the server over the internet, which a LAN-only installation does not offer. **Open question Q7:** keep a link at all? |
| **Opening a payment** | `payment.service.js` → a gateway adapter's `createPayment()` → a checkout URL, recorded in `payment_attempts`. | **Nothing is opened.** A static QR has no session, so `createPayment()`, `payment_attempts` and checkout expiry do not apply. |
| **Knowing a payment happened** | The gateway calls `POST /api/v1/public/webhooks/<provider>`, verified by signature. | The system **fetches or receives** transaction data by whatever means the GCash product allows (§5). A webhook is only one possibility, and only if GCash documents it. |
| **Which invoice a payment is for** | Carried by the gateway: we send the invoice number as the reference and it comes back on the callback. | **Not carried.** A static QR cannot pass our invoice number to GCash, so the system has to work it out. This is the new work: §4. |
| **Recording and settling** | `settleInvoice()` in `lib/billing/settlement.service.js`: locks the invoice, requires the **exact** total, inserts `payments`, marks it paid, writes the audit record. `providerPaymentId` is unique, so the same transaction cannot be recorded twice. | **Reused unchanged.** A matched GCash transaction settles through `settleInvoice()` with `channel: 'GCASH'`, `provider: 'gcash'`, and the GCash reference number as `providerPaymentId`. That key is the duplicate guard. |
| **Restoring service** | `settleInvoice()` → `queueReconnectionIfSettled()`: if the subscription is `suspended` and nothing else is unpaid, it queues an OLT `activate` job, which the worker runs. | **Reused unchanged** for the OLT. **MikroTik is not built:** see §6. |

The takeaway: **settlement and reconnection are done.** Option A adds two things: a way for
transaction data to reach the system, and a matcher.

### Why this is not "just another gateway adapter"

The adapter interface in `back/server/src/lib/payment-gateways/` (`createPayment`,
`verifyWebhook`, `parseWebhook`, `getPayment`) was drawn around **checkout-session gateways**:
HitPay, Xendit, PayMongo. Each opens a session per invoice and gets the reference back. A static
merchant QR does none of that. Forcing it into that interface would mean stub methods and a fake
webhook. When this is built, it belongs **beside** the gateway registry as an ingestion + matching
path, and the gateway registry stays for HitPay.

---

## 4. Matching: the part that needs care

A payment to a static QR arrives without our invoice number. What a transaction can carry depends
on the GCash product, but the likely signals are:

| Signal | Use | Caveat |
| --- | --- | --- |
| **GCash reference number** | Duplicate guard (`providerPaymentId`) | Identifies the transaction, not the customer |
| **Amount** | Narrows candidates to open invoices with that exact total | Many subscribers share a plan price, so ₱1,299.00 matches dozens |
| **Payer mobile / name** (often partly masked) | Matches against `customers.phone` / `name` | Family members pay for each other; masking may hide too much |
| **Message / note field**, if the product has one | The subscriber types their **account number** (`ACC-000123`) | Only works if the field exists **and** customers are told to use it |
| **Timestamp** | Tie-breaker | Weak on its own |

### Rules the matcher must follow

1. **Never settle an ambiguous match automatically.** If more than one open invoice fits, the
   transaction goes to a **review queue** for Billing staff to assign. Paying the wrong account
   restores the wrong customer's internet and leaves the real payer disconnected.
2. **No match is not an error.** Unmatched transactions are kept and shown to staff, never dropped.
3. **Amounts must match exactly**, as `settleInvoice()` already requires. Partial payments,
   overpayments, and one payment covering two months all go to review. They are not rounded or
   split automatically.
4. **Fees:** if GCash deducts a merchant fee before the amount we see (**Q4**), exact matching
   breaks for every transaction. That has to be settled before the matcher is written.
5. **Record first, then act.** Store each transaction as received, then match it, the same way
   `webhook_events` does for gateways, so a crash between the two cannot lose a payment.

### The cheapest reliable identifier

If the product has a message field, the invoice and email should tell the subscriber to **enter
their account number** when paying. An exact `ACC-` match plus an exact amount can settle safely
without staff. Everything else goes to review.

---

## 5. How transaction data reaches the system (to be decided)

Chosen from the client's actual product, not assumed. Each route below settles through the same
matcher and `settleInvoice()`:

| Route | Needs | Internet exposure | Latency |
| --- | --- | --- | --- |
| **Route 1. Outbound API polling:** the system calls GCash's API on a schedule | An API that lists incoming transactions, plus credentials | **Outbound only.** No public endpoint. | Minutes |
| **Route 2. Report import:** staff download the transaction report from the GCash Business portal and upload it | A downloadable report (CSV/XLSX) | None | Whenever staff import it |
| **Route 3. Manual entry:** Billing staff record a payment from the GCash notification, with the reference number | Nothing from GCash | None | Immediate, human-driven |
| **Route 4. Inbound callback:** GCash calls a URL on our server | GCash documenting callbacks for this product | **Public HTTPS endpoint required** | Seconds |

**Route 3 works today** (2026-09-17). The **Record payment** drawer on the Invoices screen
(`POST /admin/payments`) takes a **Reference no.**, required for GCash and QR Ph. It is
normalised (`1234 567 890123` → `1234567890123`, `lib/payments/reference.js`) and stored in
`payments.providerPaymentId`, whose unique key makes a second entry of the same transaction
impossible. The 409 names the invoice and customer it already went to. **Any future importer must
settle through the same normaliser**, so a payment entered by hand and later imported collides
instead of counting twice. Route 3 is the fallback whatever else is built. **Route 4 is the only route that brings
public-endpoint infrastructure**, and it is chosen only if the product requires it.

---

## 6. MikroTik

The client's flow ends at MikroTik. What exists today:

- **Built:** reconnection at the **OLT**. A settled invoice queues an `activate` job that takes the
  ONU off the blacklist (`lib/olt-drivers`, mock-tested; never run on real hardware).
- **Not built:** a MikroTik `RouterOsClient` (**M22**). It is blocked on **P4**: router IP, RouterOS
  version, API port, and read-only credentials.

**Q8** below asks what the client's current Sheets→MikroTik step actually changes on the router (a
PPPoE secret enabled? an address list? a queue?). That decides whether the service action is OLT,
MikroTik, or both.

---

## 7. Questions for the client

| # | Question | Why it matters |
| --- | --- | --- |
| **Q1** | Which GCash Business product was the application for, and has it been approved? | Everything in §5 depends on it |
| **Q2** | Does it come with API access? If so, the API documentation and sandbox/merchant credentials. | Decides between routes 1–4 |
| **Q3** | Without an API, can transactions be exported from the portal, and in what format and columns? | Route 2 |
| **Q4** | Does GCash deduct a fee from the amount received, or is it billed separately? | Exact-amount matching breaks if the received amount is net of fees |
| **Q5** | What does each transaction show: payer mobile? payer name? a message field? | Decides how well automatic matching can work (§4) |
| **Q6** | Can subscribers be asked to type their account number in a message when paying? | The cheapest reliable identifier |
| **Q7** | Should invoices still carry a link (e.g. to view the bill), or only the merchant QR? | Whether `/pay/<token>` stays on the invoice |
| **Q8** | In today's Google Sheets → MikroTik process, what exactly is changed on the router to restore a customer? | Decides the service action (§6) |
| **Q9** | One GCash Business merchant account (one QR) per branch, or one shared? | Each installation's configuration |
| **Q10** | How are invoices sent by SMS today, and through which provider? | SMS delivery is not built; only email exists |

---

## 8. What the GCash for Business overview answers

**Read 2026-09-17:** [GCash_for_Business_Overview.md](GCash_for_Business_Overview.md). It is a general
product overview with no source or date, not the client's product documentation or contract, so
treat its figures as indicative.

| # | Answer | What it changes |
| --- | --- | --- |
| **Q4** Fees | **Partly.** A Merchant Discount Rate applies: about **1.5–2% for QR payments**, 2–3.5% online. It does not say whether the fee comes off each transaction or at settlement. | Plan for fees. Exact-amount matching is safe **only if** the transaction record shows the **gross** amount the customer paid. The report sample below settles it. |
| **Q3** Report export | **Yes.** The Merchant Portal generates **PDF/CSV transaction logs**. | **Route 2 (report import) is viable** with no API and no public endpoint. The columns are still unknown (Q5). |
| **Q2** API access | **Not for this model.** The APIs described are for **online checkout** (GCash Web Pay, Shopify/WooCommerce plugins, custom API): a session per payment, like HitPay. Nothing mentions an API to *list payments made to a static merchant QR*. | **Route 1 (polling) is unconfirmed**, and Route 4 belongs to the checkout products rather than Option A. Don't plan around either until the client's own documentation says otherwise. |
| — Portal access | The portal shows **transactions in real time**, with **multi-user roles** (restricted cashier/manager access without withdrawal rights). | Billing staff can get their own restricted portal login to look up references for **Route 3**, which works today. |
| **Q9** One QR or one per branch | **Unclear.** The portal tracks "branch sales", so one merchant account can cover several branches. | **Matters under D7.** If both branches share one QR and account, each installation's export contains the other branch's payments. An importer then has to leave those unmatched rather than flag them, or each branch needs its own QR. |
| **New** QR Ph | The merchant QR is **QR Ph compatible**: customers can pay it from **Maya, BDO, BPI** and other banks, not only GCash. | Not every payer is a GCash user, so **payer mobile or name cannot be relied on** for matching, and some references will be QR Ph ones. The Record payment drawer already requires a reference for both **GCash and QR Ph**. |
| **New** Dynamic QR | Static **and dynamic** QR Ph codes exist. | A dynamic QR can carry the amount per invoice, which would make matching much easier. D8 chose a static QR, so this is **not** being built. It is a fallback if static-QR matching proves unreliable in practice. |

**Still unanswered:** Q1 (which product was approved), Q5 (the fields a transaction carries), Q6
(a message field), Q7, Q8 (MikroTik restore step), Q10 (SMS).

### The most useful next request

**One sample transaction report (CSV) exported from their GCash Business portal**, with names and
numbers redacted if they prefer. That single file answers **Q4** (is there a fee column, and is
the amount gross or net), **Q5** (which columns exist), **Q6** (is there a message column) and most
of **Q9** (does it hold both branches), and it is what an importer would be written against.

---

## 9. What not to do until the documentation arrives

- Do **not** write a GCash API client, endpoint URLs, auth scheme, or signature check from memory.
- Do **not** add a public webhook route, tunnel, or port-forward for GCash.
- Do **not** generate per-invoice or per-subscriber QR codes.
- Do **not** create GCash-specific tables or migrations yet. The shape of the staging table
  depends on what a transaction actually contains (Q5).
- Do **not** delete or rewrite HitPay. It is parked.

What **can** be prepared safely before then, if wanted:

- Putting the client's merchant QR **image** on the invoice PDF and email in place of the
  `/pay/<token>` QR. This needs only the image file and an answer to Q7.
- The review-queue design for unmatched and ambiguous payments. It is needed whichever of §5's
  routes is chosen.
