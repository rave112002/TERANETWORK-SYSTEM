import { describe, expect, it } from "vitest";

import {
  DUE_DAY_OF_NEXT_MONTH,
  STATEMENT_DAY,
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

  it("issues on the 15th and falls due on the 2nd of the next month", () => {
    const july = computeBilledPeriod("2026-07-15");

    expect(july.statementDate).toBe("2026-07-15");
    expect(july.dueDate).toBe("2026-08-02");
  });

  it("rolls the due date into the next year in December", () => {
    const december = computeBilledPeriod("2026-12-15");

    expect(december.statementDate).toBe("2026-12-15");
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

  it("keeps the statement and due days where the billing model puts them", () => {
    // Not a tautology: these constants are what make a suspended customer
    // accrue nothing, and moving the statement to the 1st would silently
    // double-bill every reconnected customer. See billing.dates.js.
    expect(STATEMENT_DAY).toBe(15);
    expect(DUE_DAY_OF_NEXT_MONTH).toBe(2);
  });
});

describe("serviceDaysInPeriod", () => {
  const july = computeBilledPeriod("2026-07-15");

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
