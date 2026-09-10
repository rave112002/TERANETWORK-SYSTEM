import { describe, expect, it } from "vitest";

import {
  DEFAULT_DUE_DAY,
  DEFAULT_STATEMENT_DAY,
  computeBilledPeriod,
  serviceDaysInPeriod,
} from "./billing.dates.js";

describe("computeBilledPeriod", () => {
  it("covers the whole calendar month regardless of when in it the cycle runs", () => {
    const fromThe20th = computeBilledPeriod("2026-07-20");
    const fromThe1st = computeBilledPeriod("2026-07-01");

    expect(fromThe20th.periodStart).toBe("2026-07-01");
    expect(fromThe20th.periodEnd).toBe("2026-07-31");
    expect(fromThe1st.periodStart).toBe(fromThe20th.periodStart);
    expect(fromThe1st.periodEnd).toBe(fromThe20th.periodEnd);
  });

  it("issues on the statement day and falls due on the due day of the next month", () => {
    const july = computeBilledPeriod("2026-07-25");

    expect(july.statementDate).toBe("2026-07-25");
    expect(july.dueDate).toBe("2026-08-02");
  });

  it("honours a schedule the admin has changed", () => {
    // The whole point of the settings work: the client moving their invoice
    // day is a form field, not a deploy.
    const july = computeBilledPeriod("2026-07-20", { statementDay: 18, dueDay: 5 });

    expect(july.statementDate).toBe("2026-07-18");
    expect(july.dueDate).toBe("2026-08-05");
    // The period itself does not move with the statement day.
    expect(july.periodStart).toBe("2026-07-01");
    expect(july.periodEnd).toBe("2026-07-31");
  });

  it("keeps a due date inside its month rather than rolling into the next one", () => {
    // The settings bounds stop at 28 so this cannot come from the UI, but a
    // script passing 31 must get February 28th — not March 3rd, which is what
    // `moment().date(31)` does on its own.
    const january = computeBilledPeriod("2026-01-10", { statementDay: 31, dueDay: 31 });

    expect(january.statementDate).toBe("2026-01-31");
    expect(january.dueDate).toBe("2026-02-28");
  });

  it("rolls the due date into the next year in December", () => {
    const december = computeBilledPeriod("2026-12-25");

    expect(december.statementDate).toBe("2026-12-25");
    expect(december.dueDate).toBe("2027-01-02");
    expect(december.year).toBe(2026);
  });

  it("gets February right in a leap year and a common year", () => {
    expect(computeBilledPeriod("2028-02-10").periodEnd).toBe("2028-02-29");
    expect(computeBilledPeriod("2028-02-10").daysInMonth).toBe(29);
    expect(computeBilledPeriod("2026-02-10").periodEnd).toBe("2026-02-28");
    expect(computeBilledPeriod("2026-02-10").daysInMonth).toBe(28);
  });

  it("bills the Manila month, not the UTC one, at the month boundary", () => {
    // 2026-08-01 00:30 Manila is still 2026-07-31 in UTC. Getting this wrong
    // bills a customer for the wrong month, and only ever between 00:00 and
    // 08:00 on the 1st — the kind of bug that surfaces once and is never
    // reproduced on demand.
    const period = computeBilledPeriod("2026-07-31T16:30:00Z");

    expect(period.periodStart).toBe("2026-08-01");
    expect(period.periodEnd).toBe("2026-08-31");
  });

  it("does the same at the other end of the month", () => {
    // 2026-07-31 23:30 Manila is 15:30 UTC the same day; the July period must
    // not slide into August.
    const period = computeBilledPeriod("2026-07-31T15:30:00Z");

    expect(period.periodStart).toBe("2026-07-01");
    expect(period.periodEnd).toBe("2026-07-31");
  });

  it("defaults to the schedule the migration seeds", () => {
    // Not a tautology. These are the fallback for a caller with no company to
    // read settings for, and they have to match what migration 011 writes —
    // otherwise a preview or a script silently bills on a different day from
    // the running system. The client issues on the 25th, due on the 2nd.
    expect(DEFAULT_STATEMENT_DAY).toBe(25);
    expect(DEFAULT_DUE_DAY).toBe(2);

    const july = computeBilledPeriod("2026-07-20");
    expect(july.statementDate).toBe("2026-07-25");
    expect(july.dueDate).toBe("2026-08-02");
  });
});

describe("serviceDaysInPeriod", () => {
  const july = computeBilledPeriod("2026-07-25");

  it("bills the full month when the subscription predates the period", () => {
    expect(serviceDaysInPeriod("2026-05-04", july.periodStart, july.periodEnd, 31)).toBe(31);
  });

  it("bills the full month when the activation date is unknown", () => {
    expect(serviceDaysInPeriod(null, july.periodStart, july.periodEnd, 31)).toBe(31);
  });

  it("bills the full month when activated exactly on the first", () => {
    expect(serviceDaysInPeriod("2026-07-01", july.periodStart, july.periodEnd, 31)).toBe(31);
  });

  it("prorates from the activation day, inclusive", () => {
    // Activated the 16th → the 16th through the 31st is 16 days, not 15. The
    // customer had service on the day it was switched on.
    expect(serviceDaysInPeriod("2026-07-16", july.periodStart, july.periodEnd, 31)).toBe(16);
  });

  it("bills a single day for an activation on the last day of the month", () => {
    expect(serviceDaysInPeriod("2026-07-31", july.periodStart, july.periodEnd, 31)).toBe(1);
  });

  it("bills nothing for a subscription activated after the period", () => {
    expect(serviceDaysInPeriod("2026-08-03", july.periodStart, july.periodEnd, 31)).toBe(0);
  });

  it("ignores the time of day on the activation timestamp", () => {
    expect(serviceDaysInPeriod("2026-07-16 23:59:59", july.periodStart, july.periodEnd, 31)).toBe(
      16
    );
    expect(serviceDaysInPeriod("2026-07-16 00:00:01", july.periodStart, july.periodEnd, 31)).toBe(
      16
    );
  });

  it("takes exactly four arguments, so a suspension cannot reduce the bill", () => {
    // The client's rule: a customer disconnected for non-payment on Aug 5 and
    // reconnected on Aug 12 still owes the full month of August, because the
    // downtime was their own late payment.
    //
    // Both obvious "fixes" — subtracting suspended days, and re-anchoring to
    // the payment date — need a fifth parameter here. This pins the signature
    // so either one has to be a deliberate change to a failing test rather
    // than a tidy-up nobody reviews.
    expect(serviceDaysInPeriod.length).toBe(4);
  });
});
