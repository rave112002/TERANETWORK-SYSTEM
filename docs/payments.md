# Payments — personal GCash + statement check

**Created:** 2026-09-17 · Decision: [D9](decisions.md#d9--personal-gcash-account-with-a-statement-check)

HitPay and GCash for Business are **parked**. Their code stays and is unused; their design is in
[archive/gcash-business/](archive/gcash-business/).

## Where customers see how to pay

**Settings → How customers pay** holds the **GCash number**, the **GCash account name**, the
**Facebook page link** and the invoice **Terms and conditions**. Staff can change them at any time.
Every invoice PDF and billing email (invoice, reminder, last notice, overdue notice) prints a
**How to pay** box built from them:

```
1. Send PHP 1,399.00 by GCash to 0912 3456 789 (ACCOUNT NAME).
   Paying from Maya or a bank app? Send it to the same GCash number.
2. Before sending, write your account number ACC-000001 in the GCash message.
3. Send a screenshot of your payment to our Facebook page:
   https://www.facebook.com/...
```

The invoice PDF follows the client's existing layout: coloured bar, "Invoice for" / "Invoice
details", a Description / Plan / Amount table, Grand Total, How to pay, then Terms and conditions
(left off when blank). The two colours are `COLORS` at the top of
`back/server/src/lib/pdf/invoicePdf.js`.

- The settings are read when a document is made, and invoice PDFs are re-rendered on every
  download, so a changed number shows up on the next email or download.
- If the GCash number is blank, invoices still go out and say "To pay, please contact
  TERANETWORK."
- The old "Pay now" link and QR code are gone from invoices and emails. The `/pay/<token>` page
  and the gateways behind it are parked.

## How money comes in

1. The customer sends money to **TERANETWORK's GCash number**: GCash Express Send, or a transfer
   from Maya or an online bank into that GCash account.
2. The customer sends the **proof of payment** to TERANETWORK's Facebook page.
3. Staff open the invoice → **Record payment**, choose the method, and type the **reference
   number**.
   - GCash: the reference is on the customer's proof.
   - Maya / QR Ph / bank transfer: find the payment in TERANETWORK's GCash history and copy its
     reference.
   - A reference can only be recorded once. The system says which invoice already has it.
4. The invoice is paid. A suspended customer is reconnected. **Everything after this is
   unchanged:** unpaid customers are swept after the due date, and paid customers stay online.

## Checking the records (Billing → GCash Check)

Every week or so:

1. In the GCash app, request the transaction history for the dates to check.
2. Download the password-protected PDF GCash sends.
3. **Billing → GCash Check → Upload statement**, choose the PDF and type its password.

**The PDF and its password are never saved.** The file is read in memory. Only the **incoming**
lines are kept (date, description, reference, amount). Money going out is ignored. Statements may
overlap, and uploading the same period again updates the existing check.

### What the check shows

| Result | Meaning | What to do |
| --- | --- | --- |
| ✅ Matched | Reference is in both, same amount | Nothing |
| ⚠️ Amount differs | Same reference, different amount | A typo, or a fee taken off. Check the proof. |
| ❌ Recorded, not in the file | A recorded payment whose reference is not in the statement | A mistyped reference or a fake screenshot. Check the proof. |
| ➕ In the file, not recorded | Money arrived but no invoice was marked paid | Find the customer and record the payment. **They may still be disconnected.** If it isn't a customer (family, refund…), mark it **Not a customer payment**. |
| 🔎 Possible typo | A ❌ reference and a ➕ reference differ by 1–2 characters | If it is the same payment, click **Use this reference**. That fixes both rows, and the old value is kept in the audit trail. |

The check **only reports**. It never marks an invoice paid or unpaid on its own. Problems from the
latest statement also appear under **Needs attention** on the dashboard.

Which payments are checked: those recorded by hand as **GCash, Maya, QR Ph or Bank transfer**.
Cash is not in the statement.

## For developers

| Piece | Where |
| --- | --- |
| PDF → text lines (pdf.js, in memory) | `back/server/src/lib/payments/gcash-statement/pdfText.js` |
| Text lines → transactions | `…/gcash-statement/parser.js` |
| The four results + typo pairs (pure) | `…/gcash-statement/reconcile.js` |
| Loading a check from the DB | `…/gcash-statement/statement.service.js` |
| API (`/api/v1/admin/payment-statements`, permission `billing / payments`) | `back/server/src/controllers/v1/admin/payment-statements.controller.js` |
| Tables `gcash_statements`, `gcash_statement_transactions` | `back/database/migrations/015_gcash_statements.sql` |
| Page | `front/src/pages/Admin/Billing/GcashCheck/` |
| How-to-pay text (shared by PDF and emails) | `back/server/src/lib/payments/instructions.js` |
| The four settings | `back/server/src/validators/settings.validator.js`, `front/src/pages/Admin/Settings/index.jsx` |

### ⚠️ The parser has not yet read a real statement

GCash doesn't publish the PDF layout, and the real sample is password-protected. The parser
finds rows by what they must contain (date and time, reference digits, amounts under
Debit/Credit/Balance headings, or the running balance when there are no headings), and it warns
when totals don't add up. It is tested against statement-shaped PDFs, **not a real one yet**.
To check a real file without exposing its contents:

```bash
cd back
npm run gcash:inspect -- "C:\path\to\statement.pdf"
```

It asks for the password (not shown as you type) and prints the layout with every letter
replaced by `x` and every digit by `9`. The output is safe to share.
