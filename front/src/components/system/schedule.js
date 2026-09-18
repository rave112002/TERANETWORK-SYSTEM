/**
 * Helpers for showing the billing schedule, shared by the branch's System page
 * and the central SuperAdmin's System settings page.
 */

/** 1 → "1st", 2 → "2nd", 25 → "25th". */
export const ordinal = (n) => {
  const value = Number(n);
  if (!Number.isFinite(value)) return String(n);
  const suffix =
    value % 100 >= 11 && value % 100 <= 13
      ? "th"
      : ({ 1: "st", 2: "nd", 3: "rd" }[value % 10] ?? "th");
  return `${value}${suffix}`;
};

/** 20 → "20:00". */
export const asHour = (h) => `${String(Number(h) || 0).padStart(2, "0")}:00`;

/**
 * The schedule, as a sentence.
 *
 * Seven number fields do not tell an admin what their edit does. This is the
 * consequence spelled out — it updates as they type, so a change that would cut
 * customers off a day early is visible before it is saved rather than after the
 * first customer calls.
 *
 * @param {Object} values the live form values.
 * @returns {string}
 */
export const describeSchedule = ({
  STATEMENT_DAY,
  DUE_DAY,
  GRACE_DAYS,
  REMINDER_DAYS_BEFORE,
  DUNNING_HOUR,
}) => {
  const grace = Number(GRACE_DAYS) || 0;
  const remind = Number(REMINDER_DAYS_BEFORE) || 0;

  const cutOff =
    grace === 0
      ? `at ${asHour(DUNNING_HOUR)} on the ${ordinal(DUE_DAY)}`
      : `${grace} day${grace === 1 ? "" : "s"} later, at ${asHour(DUNNING_HOUR)}`;

  const reminder =
    remind === 0
      ? "There is no advance reminder"
      : `A reminder goes out ${remind} day${remind === 1 ? "" : "s"} before that`;

  return (
    `Invoices for the calendar month go out on the ${ordinal(STATEMENT_DAY)}, ` +
    `due on the ${ordinal(DUE_DAY)} of the following month. ` +
    `${reminder}. Unpaid accounts are suspended ${cutOff}.`
  );
};
