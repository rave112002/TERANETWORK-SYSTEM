import cron from "node-cron";

import { logger } from "../../../config/logger.js";
import { runDailyBilling } from "../billing/reminders.service.js";
import { runMonthlyCycle } from "../billing/cycle.service.js";
import { runDunningSweep } from "../dunning/dunning.service.js";
import { systemAuditContext } from "../../utils/audit.js";

/**
 * The billing scheduler.
 *
 * ── Where it runs ───────────────────────────────────────────────────────────
 *
 * In the worker process, not the API. The API can be run behind a load balancer
 * with several instances; every one of them would fire the same cron at the
 * same second. The worker is a single process by design, which makes it the
 * only place a schedule means what it says.
 *
 * If the worker is ever scaled out, this needs a lock — but the operations
 * themselves are already idempotent (UNIQUE(subscriptionId, billingPeriodStart)
 * on invoices, dedupe keys on email jobs), so a duplicate run is wasted work
 * rather than a duplicate bill.
 *
 * ── Timing ──────────────────────────────────────────────────────────────────
 *
 * Both jobs run in the morning, Asia/Manila. Deliberately not at midnight:
 * anything that emails customers should land in an inbox during office hours,
 * and a failure at 09:00 is noticed the same day rather than the next.
 *
 * The dunning sweep runs at 20:00, late enough that a payment made during the
 * working day has landed, and early enough that somebody is still around when
 * it goes wrong. It queues disconnections; it does not perform them.
 */

/**
 * The statement day is the 15th and that part is a business rule, not a
 * preference — see lib/billing/billing.dates.js before changing the day field.
 * The hour is configurable, and 09:00 is the default for the reason above.
 */
export const CYCLE_CRON = process.env.BILLING_CYCLE_CRON || "0 9 15 * *";

/** The overdue sweep, then due reminders. */
export const DAILY_CRON = process.env.DAILY_BILLING_CRON || "0 8 * * *";

/**
 * The disconnection sweep, nightly.
 *
 * 20:00 by default: after the day's payments have had time to land, and while
 * somebody is still awake to notice if it queues a hundred disconnections when
 * it should have queued three.
 */
export const DUNNING_CRON = process.env.DUNNING_CRON || "0 20 * * *";

const TZ = process.env.TIMEZONE || "Asia/Manila";

/** Every company the system is currently billing for. */
const activeCompanies = async (db) =>
  db.query(`SELECT companyId, name FROM companies WHERE status = 'Active'`);

/**
 * Run the monthly cycle for every active company.
 *
 * @param {Object} db
 * @param {Object} [opts]
 * @param {Date|string} [opts.runDate]
 * @returns {Promise<Array>} one summary per company.
 */
export const runScheduledCycle = async (db, { runDate = new Date() } = {}) => {
  const companies = await activeCompanies(db);
  const summaries = [];

  for (const company of companies) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const result = await runMonthlyCycle(db, {
        runDate,
        companyId: company.companyId,
        context: systemAuditContext("billing_cycle", { companyId: company.companyId }),
      });

      logger.info(
        `[scheduler] billing cycle for ${company.name}: ${result.created} created, ` +
          `${result.skipped} skipped, ${result.failed} failed`
      );
      summaries.push({ companyId: company.companyId, ...result });

      // A failure inside a run is already isolated per subscription, but it
      // still means somebody was not billed. Loud, because a quiet one is
      // discovered when the customer asks why they got no bill.
      if (result.failed > 0) {
        logger.error(
          `🚨 [scheduler] ${result.failed} subscription(s) failed to bill for ${company.name}`,
          { failures: result.results.filter((r) => r.status === "failed") }
        );
      }
    } catch (error) {
      // One company's failure must not stop the others being billed.
      logger.error(`🚨 [scheduler] billing cycle failed for ${company.name}: ${error.message}`);
      summaries.push({ companyId: company.companyId, error: error.message });
    }
  }

  return summaries;
};

/**
 * Run the daily overdue sweep and reminders.
 *
 * Not per company: both operate on invoice due dates, which are company-
 * agnostic, and the queries are already indexed on (status, dueDate).
 *
 * @param {Object} db
 * @param {Object} [opts]
 * @returns {Promise<Object>}
 */
/**
 * Run the disconnection sweep for every active company.
 *
 * Queues job tickets and nothing more. The provisioning worker performs the
 * device work, re-checks the debt immediately beforehand, and honours DRY_RUN.
 *
 * @param {Object} db
 * @param {Object} [opts]
 * @returns {Promise<Array>} one summary per company.
 */
export const runScheduledDunning = async (db, { runDate = new Date() } = {}) => {
  const companies = await activeCompanies(db);
  const summaries = [];

  for (const company of companies) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const result = await runDunningSweep(db, {
        runDate,
        companyId: company.companyId,
        triggeredBy: "system:dunning",
      });

      summaries.push({ companyId: company.companyId, ...result });

      // Warning, not info: this is the system preparing to cut people off, and
      // a run that queues an unexpected number is the thing worth noticing in a
      // log at eight in the evening.
      if (result.queued > 0) {
        logger.warn(
          `[scheduler] dunning for ${company.name}: ${result.queued} disconnect(s) queued, ` +
            `${result.deduped} already pending${result.dryRun ? " [DRY RUN]" : ""}`
        );
      } else {
        logger.info(`[scheduler] dunning for ${company.name}: nobody eligible`);
      }
    } catch (error) {
      // Loud. A sweep that silently fails is a month of unpaid customers
      // staying connected, discovered when somebody looks at the revenue.
      logger.error(`🚨 [scheduler] dunning sweep failed for ${company.name}: ${error.message}`);
      summaries.push({ companyId: company.companyId, error: error.message });
    }
  }

  return summaries;
};

export const runScheduledDaily = async (db, { runDate = new Date() } = {}) => {
  const result = await runDailyBilling(db, {
    runDate,
    context: systemAuditContext("billing_daily"),
  });

  logger.info(
    `[scheduler] daily billing: ${result.overdue.updated} marked overdue, ` +
      `${result.reminders.queued} reminder(s) queued for ${result.reminders.target}`
  );

  return result;
};

/**
 * Register the schedules.
 *
 * @param {Object} db
 * @returns {{stop: () => void}} stops every registered task.
 */
export const startScheduler = (db) => {
  const options = { timezone: TZ };

  const cycleTask = cron.schedule(
    CYCLE_CRON,
    () => {
      logger.info("[scheduler] monthly billing cycle starting");
      // Not awaited — cron does not await the callback, and an unhandled
      // rejection here would take the worker down on a bad month.
      runScheduledCycle(db).catch((error) =>
        logger.error(`🚨 [scheduler] monthly cycle crashed: ${error.message}`)
      );
    },
    options
  );

  const dailyTask = cron.schedule(
    DAILY_CRON,
    () => {
      runScheduledDaily(db).catch((error) =>
        logger.error(`🚨 [scheduler] daily billing crashed: ${error.message}`)
      );
    },
    options
  );

  const dunningTask = cron.schedule(
    DUNNING_CRON,
    () => {
      runScheduledDunning(db).catch((error) =>
        logger.error(`🚨 [scheduler] dunning sweep crashed: ${error.message}`)
      );
    },
    options
  );

  logger.info(
    `[scheduler] cycle '${CYCLE_CRON}', daily '${DAILY_CRON}', dunning '${DUNNING_CRON}' (${TZ})`
  );

  return {
    stop: () => {
      cycleTask.stop();
      dailyTask.stop();
      dunningTask.stop();
    },
  };
};

export default {
  CYCLE_CRON,
  DAILY_CRON,
  DUNNING_CRON,
  startScheduler,
  runScheduledCycle,
  runScheduledDaily,
  runScheduledDunning,
};
