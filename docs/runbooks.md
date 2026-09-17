# Runbooks

What to do when something goes wrong, written for whoever is on the phone with
the customer — not for whoever wrote the code.

Each entry states the symptom first, because that is what you have.

> **Every branch is its own installation** — its own server, database, worker, backups and
> settings ([D7](decisions.md#d7--one-branch-per-installation)). Everything below
> applies to one installation; do it on the branch that has the problem.

---

## The system in one paragraph

Two processes. **The API** (`back`, `npm start`) serves the portals and the
public payment page. **The worker** (`back`, `npm run worker`) does everything
slow or failure-prone: talking to the OLT, sending email, and running the
schedules. They share one MySQL database and communicate only through the
`jobs` table. The worker can be restarted at any time without losing work — a
job it was holding is reclaimed after its lock goes stale.

**Nothing changes a customer's service except the worker**, and only after the
device confirms the command, in the same transaction that records it. If the
database says a modem is suspended, a real device said so.

An account runs **Active → Suspended → For pull-out → Closed**. The first step
is automatic and the last two are decisions a person makes; see "This customer
has been cut off for months" below.

---

## "The invoices didn't go out"

**Check the date they were meant to go out on:** Settings → System → **Billing
schedule**. It says the day and the hour in plain English at the top of the
section. The client's is the 25th at 09:00.

**Check the worker is running.** The schedule lives in the worker, not the API.
`npm run worker` prints `[scheduler] ticking '0 * * * *' …` on startup, then
wakes up every hour and asks the settings what is due.

**A worker that was down at 09:00 catches up on its own** — it runs the moment
it comes back, as long as it is still the same day. A worker that was down for
the whole of the 25th does not; run it by hand as below.

**Fix:** Billing → Invoices → **Run billing**, pick any date inside the month
you want, and press *Generate invoices*. The date picks the month, not the
statement day — any day in it produces the same invoices.

**It is safe to press twice.** Every invoice is guarded by a unique key on
(subscription, billing period): a second run reports the customers it skipped
rather than billing anyone again. If you are unsure whether the first run
finished, run it again — that is cheaper than checking.

**What to expect:** the toast says how many were created and how many skipped.
Skipped is normal — suspended subscriptions accrue nothing, and anyone already
billed for the month is passed over.

---

## "The customer paid but they're still disconnected"

This should not happen, and if it does the cause is almost always one of three
things. Work down the list.

**1. Did the payment actually settle?** Billing → Invoices, find the invoice.
If it does not say *Paid*, the money did not reach us — check the gateway's own
dashboard before anything else.

**2. Is the reconnection queued?** System → Jobs, filter to `activate`.
Reconnection is queued automatically when a payment clears the customer's
**last** unpaid invoice. If they had three overdue bills and paid one, they stay
disconnected — deliberately, because the other two are still owed. Check
Reports → Aging for that customer.

**3. Is the worker running?** A queued reconnection with no worker sits there
forever. Start it, and the job runs within seconds.

**Manual override:** Network → ONUs → the modem's ⋮ → *Restore service*. Use
this only after checking 1 and 2 — it sends the command regardless of what is
owed.

---

## "There are red jobs in the queue"

System → Jobs. The status tells you what to do.

| Status | Meaning | Action |
| --- | --- | --- |
| `queued` | waiting for the worker | none, unless it has been there minutes — then check the worker is up |
| `processing` | a worker is on it now | none |
| `failed` | it failed and will retry | none yet; watch it |
| `dead` | it gave up after five attempts | **this needs a person** |

**A dead letter means something did not happen.** A modem was never actually
disconnected, or an invoice was never actually emailed. The row's `lastError`
says why. Fix the cause, then re-trigger the action from its own screen — there
is deliberately no "retry" button, because a job that failed five times usually
needs its cause fixed rather than another attempt.

The dashboard surfaces dead letters at the top of **Needs attention**. If that
panel is empty, there are none.

---

## "The OLT is unreachable"

Every device attempt is recorded whether it succeeds or not. Network → ONUs →
the modem's ⋮ → **Device history** shows the exact command sent and the device's
verbatim reply.

If a run of jobs is failing with connection errors:

1. Can you reach the OLT from the worker's machine? (`telnet <host> <port>`.)
   The worker needs the management VLAN; the API does not.
2. Is another session already open? The HSGQ tolerates **one** CLI session.
   Somebody logged in with PuTTY will block the worker.
3. Are the credentials right? Network → OLTs → edit → re-enter them. They are
   stored encrypted and cannot be read back, so a wrong password looks like a
   connection failure.

Jobs retry with backoff, so a brief outage resolves itself. A sustained one
produces dead letters — see above.

---

## "Somebody was disconnected who shouldn't have been"

**First, get them back online:** Network → ONUs → ⋮ → *Restore service*.

**Then find out why.** Device history on that modem shows what was sent and
when, and who or what triggered it — `system:dunning` for the nightly sweep,
`user:<id>` for a person.

The sweep only queues a disconnection for a subscription that is **active**, has
an **unpaid** invoice past its due date **plus the grace period**, and has **no
live exemption**. The worker re-checks all of that immediately before sending
the command. If somebody was cut off anyway, one of those facts was true at the
time — usually an unnoticed second unpaid invoice.

**To stop it recurring while you sort it out:** Billing → Dunning → the
customer's ⋮ → *Grant exemption*. That shields them until the date you set.

---

## "Change when things happen"

Settings → System → **Billing schedule**. Every date and hour in the billing
cycle is there: the day invoices go out, the day payment falls due, how many
days early the reminder goes, the grace period, and the hour each of the three
runs fires at.

**No restart is needed.** The worker re-reads the schedule every hour, so a
change is live within the hour. The sentence above the fields says what the
current settings mean for a customer, and it updates as you type — read it
before saving.

**Zero grace is a valid value** and is the client's rule: due on the 2nd, cut
off at 20:00 on the 2nd. It is not read as "unset".

### Two changes the system will refuse

**Invoices cannot go out before the previous month's cut-off day.** Set the
statement day to the 1st with payment due on the 2nd and the system says no.
The reason is that a suspended customer is skipped by the billing run, which is
what makes them accrue nothing while cut off — and that only works if the run
happens *after* the disconnection. Issue earlier and everyone who reconnects is
billed for a month they had no service.

**Notices cannot be scheduled after the disconnection sweep.** The morning run
sends the last warning; the evening sweep cuts people off. Swap them and the
warning arrives the day after the thing it was warning about.

Both refusals name the two values that disagree, so the message says what to
move.

---

## "What does a customer actually receive?"

For one invoice that goes unpaid, on the client's schedule:

| When | Email | Says |
| --- | --- | --- |
| the 25th | Invoice issued | the bill, with the PDF attached and a pay link |
| the last day of the month | Reminder | due in two days |
| the 2nd, 08:00 | **Last notice** | still unpaid, service goes off at 20:00 today |
| the 3rd, 08:00 | Overdue | past due, and what that means |

The reminder lands on the last day of the month every month — Sep 30, Oct 31,
Feb 28 — because two days before the 2nd always does.

**The last notice is the one that matters.** It exists because with no grace
period the only other notice arrived on the 3rd, the morning after the customer
had already been cut off. If a customer says they were disconnected without
warning, check Billing → Invoices → their invoice for whether that email was
sent; a customer with no email address on file never gets any of these, and the
job records that as the reason.

---

## "This customer has been cut off for months — what now?"

Subscribers → **Modem Recovery**. Two lists, and they are two different jobs.

**Ready to give up on** is the office decision. An account appears here once it
has been without service for the configured number of days (60 by default; the
figure is on Settings → System). Nothing has happened to it yet. The row shows
what they owe and how long they have been off, so a small balance and a big one
are not treated the same.

Marking one for pull-out is the point of no return for that subscription:

- paying no longer restores their service, at any amount
- the balance is **still owed** and still appears in Reports → Aging
- coming back is a **new subscription**, with a new installation fee
- the modem is still on their wall until somebody collects it

**Awaiting collection** is the field work. It carries the address, the phone
number, the modem's MAC and which NAP port it is on. Close each job when the
technician reports back.

### Closing a pull-out

You are asked one question: did the modem come back?

| Answer | What happens |
| --- | --- |
| **Modem recovered** | back into stock, un-blacklisted at the OLT so it works when next seated, NAP port freed |
| **Could not recover it** | written off, **stays blacklisted** so nobody else can use it, NAP port freed |

The NAP port is freed either way. Holding a port because a technician could not
retrieve a modem would slowly starve a NAP for no benefit.

**Un-blacklisting matters.** A modem left blacklisted is a brick the next time
it is seated, months later, with nothing on the screen to explain why. That is
why "recovered" queues a device job — check System → Jobs if you want to see it
land.

### "I marked the wrong account"

The row's ⋮ → **Cancel pull-out** puts it back to suspended. Use it for a
mistake, not for a customer who has decided to pay: it does not restore service,
and it is not a way around the new-installation rule.

---

## "A customer wants to come back after being closed"

They are a new subscription. Create it the same way as any other: Subscribers →
Subscriptions → **New subscription**, attach a modem, activate.

The installation fee lands automatically — the first invoice on any subscription
carries it, and a new subscription has no prior invoices. Their old balance is
separate and still owed.

Do not try to revive the closed subscription. It is closed precisely so that the
history reads truthfully: what they were charged, when service stopped, and what
happened to the modem.

---

## "Change the payment gateway"

> ⏸️ **HitPay and GCash for Business are parked (2026-09-17).** Payments go to TERANETWORK's
> personal GCash account — see [payments.md](payments.md). Record each one by hand from the
> invoice (Billing → Invoices → Record payment) and enter the transaction's **Reference no.**
> It is required for GCash, Maya, QR Ph and bank transfer, and the system refuses a reference it has already seen,
> saying which invoice it went to. To check whether a payment is already in, search
> Billing → Payments by the reference, in any spacing. The rest of this section describes the
> parked gateway set-up.

There are two levels, and they answer different questions.

**Which gateway a branch collects through** is a field: SuperAdmin → Company
Management → Branches → edit → **Collect through**. "Company default" follows
`PAYMENT_PROVIDER`; anything else pins that branch. This is how HitPay covers
the Taguig branches while another branch collects elsewhere. No restart.

**The company default and every credential** are in `back/.env`. Changing those
needs an API restart, not a deploy.

**Branches on the same gateway share one merchant account.** The credentials
live in the environment, not per branch, so two branches both set to HitPay bill
through the same HitPay account. Separate merchant accounts per branch is not
something this supports today.

Two gateways can run at once: register both adapters, point branches at
whichever they use, and callbacks from either keep settling. `payments.provider`
records which gateway took each payment, so the ledger reads correctly with both
in it.

**The one thing that does not transfer is saved payment methods.** Autodebit
mandates and card tokens belong to the gateway that created them. Switching
means every enrolled customer re-authorises. See
`back/server/src/lib/payment-gateways/README.md`.

---

## "Payments are not working for one branch"

> ⏸️ Written for HitPay, which is parked. With one installation per branch, "one branch" means
> "this installation".

Work down these, in order.

**1. Is that branch pointed at a gateway that exists?** SuperAdmin → Branches →
edit → Collect through. A branch set to a provider with no adapter falls back to
the company default and writes a 🚨 line naming the branch and the slug. Search
the API log for `has no adapter`.

**2. Are that gateway's credentials set?** HitPay needs both
`PAYMENT_HITPAY_API_KEY` and `PAYMENT_HITPAY_SALT`, and they are different
values. With only the key you get a working checkout whose every callback is
rejected as an invalid signature.

**3. Are the callbacks arriving?** System → Jobs shows nothing for webhooks;
they are recorded as `webhook_events`. A run of `signature_failed` rows means
the salt is wrong, or the sandbox salt is in a live deployment. Nothing at all
means the gateway does not have the URL: register it in HitPay under Developers
→ Webhook Endpoints as `<PUBLIC_APP_URL>/api/v1/public/webhooks/hitpay`.

**4. Is it pointed at the right environment?** `PAYMENT_HITPAY_MODE` is
`sandbox` or `live`, and defaults to `sandbox` when unset. A live key with a
sandbox mode talks to the wrong host and fails every call.

**The customer is never stuck because of this.** An invoice with no working
gateway still issues and still emails; it simply carries no Pay button, and cash
can still be recorded by hand on Billing → Payments.

---

## "Where does the money reconcile?"

Reports → **Collections**, set the date range, **Export CSV**. That is what
came in, by day, with the method and who recorded it.

Reports → **Aging** is what is still owed, bucketed the way an accountant reads
it. The buckets run from the **due** date, and `Current` means issued but not
yet due — not late.

The export is the same query as the screen. If the page and the file ever
disagree, that is a bug worth reporting, not a rounding difference.

---

## What to back up

| What | Why |
| --- | --- |
| **The MySQL database** | everything. Customers, invoices, payments, the audit trail, the device logs |
| `back/.env` | gateway keys, `CREDENTIAL_MASTER_KEY`, JWT secrets |
| `back/storage/invoices/` | generated invoice PDFs |
| `back/public/uploads/` | company logo, user avatars |

**`CREDENTIAL_MASTER_KEY` deserves its own copy somewhere else.** It wraps the
OLT passwords. Restore the database without it and every stored device
credential is unrecoverable — you would have to re-enter them by hand.

A nightly `mysqldump` plus those directories is enough. Test a restore before
you need one.

---

## Turning everything off safely

There is a kill switch: Settings → System settings → `DRY_RUN` = `true`.

With it on, the worker still claims jobs, still logs exactly what it *would*
have sent to the device, and sends nothing. Billing still runs; nobody is
disconnected. Use it while testing against real hardware, or when something is
behaving oddly and you want the system to stop touching devices without
stopping it altogether.

The device history marks those entries `dry_run`, so a rehearsal is never
mistaken for the real thing.
