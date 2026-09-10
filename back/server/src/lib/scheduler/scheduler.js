import cron from "node-cron";
import moment from "moment-timezone";

import { logger } from "../../../config/logger.js";
import { getBillingSchedule } from "../settings/settings.service.js";
import { runDailyBilling } from "../billing/reminders.service.js";
import { runDunningSweep } from "../dunning/dunning.service.js";
import { runMonthlyCycle } from "../billing/cycle.service.js";
import { systemAuditContext } from "../../utils/audit.js";

/**
 * The billing scheduler.
 *
 * ── Where it runs ───────────────────────────────────────────────────────────
 *
 * In the worker process, not the API. The API can be run behind a load balancer
 * with several instances; every one of them would fire the same schedule at the
 * same second. The worker is a single process by design, which makes it the
 * only place a schedule means what it says.
 *
 * If the worker is ever scaled out, this needs a lock — but the operations
 * themselves are already idempotent (UNIQUE(subscriptionId, billingPeriodStart)
 * on invoices, dedupe keys on email and provisioning jobs), so a duplicate run
 * is wasted work rather than a duplicate bill.
 *
 * ── One tick, not three crons ───────────────────────────────────────────────
 *
 * There used to be three cron expressions here, two of them settable only from
 * the environment. That made the statement day a deployment concern: the client
 * changing "we invoice on the 25th now" meant editing `.env` and restarting.
 *
 * Instead this wakes up once an hour and asks each company's settings whether
 * anything is due. An admin edits the schedule on the System screen and the
 * next tick honours it — no restart, and no chance of the cron string and the
 * setting disagreeing about which day the statement goes out.
 *
 * The cost is that a schedule is only ever accurate to the hour. That is fine:
 * every one of these runs is a batch job whose exact minute nobody observes.
 *
 * ── Catching up after downtime ──────────────────────────────────────────────
 *
 * A run is due when the hour has ARRIVED, not when it matches exactly — so a
 * worker that was down at 09:00 on the statement day still bills when it comes
 * back at 14:00, instead of skipping the month. `lastRun` below keeps it to
 * once a day per company.
 *
 * That marker is in memory, so a restart forgets it and the run repeats. That
 * is deliberate and safe: repeating is exactly what idempotence is for, and the
 * alternative — persisting it — would turn a forgotten flag into a month with
 * no invoices.
 */

const TZ = process.env.TIMEZONE || "Asia/Manila";

/**
 * How often the scheduler wakes up. Hourly, because every setting it reads is
 * expressed in whole hours. Overridable only for tests.
 */
export const TICK_CRON = process.env.SCHEDULER_TICK_CRON || "0 * * * *";

/** Every company the system is currently billing for. */
const activeCompanies = async (db) =>
  db.query(`SELECT companyId, name FROM companies WHERE status = 'Active'`);

/**
 * `${job}:${companyId}` → the 'YYYY-MM-DD' it last ran on.
 *
 * Not exported and not persisted — see the note above about why forgetting it
 * is the safe failure.
 */
const lastRun = new Map();

/**
 * Claim today's run of a job for a company, if its hour has arrived.
 *
 * Marks as a side effect, hence the name: asking twice in one day gets one
 * yes. A company whose run then fails is not retried until tomorrow, which is
 * the right side to err on — an hourly retry of a failing billing run is a
 * loop nobody watching the log can read.
 *
 * @param {string} job 'cycle' | 'daily' | 'dunning'
 * @param {string} companyId
 * @param {moment.Moment} now
 * @param {number} hour the configured hour for this job.
 * @param {boolean} [dayMatches=true] extra condition — the cycle also needs the
 *   statement day.
 * @returns {boolean}
 */
const claimRun = (job, companyId, now, hour, dayMatches = true) => {
  if (!dayMatches || now.hour() < hour) return false;

  const key = `${job}:${companyId}`;
  const today = now.format("YYYY-MM-DD");
  if (lastRun.get(key) === today) return false;

  lastRun.set(key, today);
  return true;
};

/** Drop markers from previous days so the map cannot grow without bound. */
const pruneLastRun = (today) => {
  for (const [key, day] of lastRun) {
    if (day !== today) lastRun.delete(key);
  }
};

/**
 * Run the monthly cycle for every active company, or one named company.
 *
 * @param {Object} db
 * @param {Object} [opts]
 * @param {Date|string} [opts.runDate]
 * @param {Array<{companyId: string, name: string}>|null} [opts.companies] pre-read list.
 * @returns {Promise<Array>} one summary per company.
 */
export const runScheduledCycle = async (db, { runDate = new Date(), companies = null } = {}) => {
  const targets = companies ?? (await activeCompanies(db));
  const summaries = [];

  for (const company of targets) {
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
 * Run the daily notices for every active company.
 *
 * Per company, because the reminder lead time and grace period that decide
 * which invoices get chased today are per company.
 *
 * @param {Object} db
 * @param {Object} [opts]
 * @returns {Promise<Array>} one summary per company.
 */
export const runScheduledDaily = async (db, { runDate = new Date(), companies = null } = {}) => {
  const targets = companies ?? (await activeCompanies(db));
  const summaries = [];

  for (const company of targets) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const result = await runDailyBilling(db, {
        runDate,
        companyId: company.companyId,
        context: systemAuditContext("billing_daily", { companyId: company.companyId }),
      });

      logger.info(
        `[scheduler] daily billing for ${company.name}: ${result.overdue.updated} marked overdue, ` +
          `${result.finals.queued} final notice(s), ` +
          `${result.reminders.queued} reminder(s) for ${result.reminders.target}`
      );
      summaries.push({ companyId: company.companyId, ...result });
    } catch (error) {
      logger.error(`🚨 [scheduler] daily billing failed for ${company.name}: ${error.message}`);
      summaries.push({ companyId: company.companyId, error: error.message });
    }
  }

  return summaries;
};

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
export const runScheduledDunning = async (db, { runDate = new Date(), companies = null } = {}) => {
  const targets = companies ?? (await activeCompanies(db));
  const summaries = [];

  for (const company of targets) {
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

/**
 * One pass: ask every company's settings what is due this hour, and run it.
 *
 * Exported so a test can drive it at an arbitrary time rather than waiting an
 * hour for cron.
 *
 * @param {Object} db
 * @param {Object} [opts]
 * @param {Date|string} [opts.now=new Date()]
 * @returns {Promise<{cycle: Array, daily: Array, dunning: Array}>} the companies
 *   each job ran for.
 */
export const tick = async (db, { now = new Date() } = {}) => {
  const at = moment.tz(now, TZ);
  pruneLastRun(at.format("YYYY-MM-DD"));

  const companies = await activeCompanies(db);
  const dueCycle = [];
  const dueDaily = [];
  const dueDunning = [];

  for (const company of companies) {
    let schedule;
    try {
      // eslint-disable-next-line no-await-in-loop
      schedule = await getBillingSchedule(db, company.companyId);
    } catch (error) {
      // A settings read that fails must not stop the other companies being
      // billed, and must not be interpreted as "nothing is due".
      logger.error(
        `🚨 [scheduler] could not read the billing schedule for ${company.name}: ${error.message}`
      );
      continue;
    }

    const onStatementDay = at.date() === Math.min(schedule.statementDay, at.daysInMonth());

    if (claimRun("cycle", company.companyId, at, schedule.cycleHour, onStatementDay)) {
      dueCycle.push(company);
    }
    if (claimRun("daily", company.companyId, at, schedule.dailyHour)) {
      dueDaily.push(company);
    }
    if (claimRun("dunning", company.companyId, at, schedule.dunningHour)) {
      dueDunning.push(company);
    }
  }

  // In this order on purpose. The daily run sends the last warning before a
  // disconnection, so on a day when both are due it must go first — and the
  // cycle before either, so a fresh invoice exists before anything chases it.
  const cycle = dueCycle.length > 0 ? await runScheduledCycle(db, { runDate: now, companies: dueCycle }) : [];
  const daily = dueDaily.length > 0 ? await runScheduledDaily(db, { runDate: now, companies: dueDaily }) : [];
  const dunning =
    dueDunning.length > 0 ? await runScheduledDunning(db, { runDate: now, companies: dueDunning }) : [];

  return { cycle, daily, dunning };
};

/**
 * Register the hourly tick.
 *
 * @param {Object} db
 * @returns {{stop: () => void}}
 */
export const startScheduler = (db) => {
  const task = cron.schedule(
    TICK_CRON,
    () => {
      // Not awaited — cron does not await the callback, and an unhandled
      // rejection here would take the worker down on a bad hour.
      tick(db).catch((error) => logger.error(`🚨 [scheduler] tick crashed: ${error.message}`));
    },
    { timezone: TZ }
  );

  logger.info(
    `[scheduler] ticking '${TICK_CRON}' (${TZ}); the billing schedule is read from ` +
      `system settings on every tick`
  );

  return { stop: () => task.stop() };
};

export default {
  TICK_CRON,
  startScheduler,
  tick,
  runScheduledCycle,
  runScheduledDaily,
  runScheduledDunning,
};
