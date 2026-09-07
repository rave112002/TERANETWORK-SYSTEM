import { logger } from "../../../config/logger.js";
import { claim, complete, fail, reclaimStale } from "./jobs.queue.js";

/**
 * The worker loop.
 *
 * Claims one job at a time, hands it to a processor, and records the outcome.
 * It deliberately knows nothing about OLTs or invoices — a processor is
 * registered per job type, so adding device work (S6) or email (S7) means
 * registering a handler, not editing this file.
 *
 * ── Why one job at a time ───────────────────────────────────────────────────
 *
 * The lab OLT has a 250 MHz CPU and tolerates a single CLI session. Running
 * jobs sequentially is not a simplification to fix later — it is the device's
 * actual limit. When a second OLT arrives, the change is a per-device lock, not
 * a bigger thread pool, and `olts.maxConcurrentSessions` already records what
 * each device will take.
 *
 * ── Failure is expected, not exceptional ────────────────────────────────────
 *
 * A device is unreachable often enough that it is ordinary. A processor that
 * throws gets its job retried with backoff and eventually dead-lettered; what
 * it must never do is leave the domain tables saying something the device did
 * not confirm. That invariant lives in the processors, and it is the reason
 * this loop treats a thrown error as routine rather than fatal.
 */

/** Registered handlers, by job type. */
const processors = new Map();

/**
 * Register the handler for a job type.
 *
 * @param {string} type
 * @param {(job: Object, ctx: {db: Object, logger: Object}) => Promise<Object|void>} handler
 *   Resolves to an optional result stored on the job; throws to fail it.
 */
export const registerProcessor = (type, handler) => {
  processors.set(type, handler);
};

/** Types this worker currently knows how to run. */
export const registeredTypes = () => [...processors.keys()];

/**
 * Run a single claimed job to completion or failure.
 *
 * Exported so a test — or an operator debugging one stuck job — can drive one
 * unit of work without starting the loop.
 *
 * @returns {Promise<'succeeded'|'queued'|'dead'|'unhandled'>}
 */
export const processJob = async (db, job, { workerId }) => {
  const handler = processors.get(job.type);

  if (!handler) {
    // An unknown type is a deployment mistake — a worker older than the code
    // that enqueued the work. Fail it so it retries rather than vanishes: the
    // next deploy may well be able to run it.
    await fail(db, job.jobId, new Error(`No processor registered for job type '${job.type}'`));
    logger.error(`[worker] no processor for type '${job.type}'`, { jobId: job.jobId });
    return "unhandled";
  }

  try {
    const result = await handler(job, { db, logger });
    await complete(db, job.jobId, result ?? null);
    logger.info(`[worker] ${job.type} succeeded`, { jobId: job.jobId, workerId });
    return "succeeded";
  } catch (error) {
    const outcome = await fail(db, job.jobId, error);

    if (outcome.status === "dead") {
      // Loud on purpose. A dead job means a customer is in a state nobody
      // intended and no further attempt is coming.
      logger.error(`🚨 [worker] ${job.type} DEAD-LETTERED after ${outcome.attempts} attempts`, {
        jobId: job.jobId,
        type: job.type,
        payload: job.payload,
        error: error.message,
      });
    } else {
      logger.warn(
        `[worker] ${job.type} failed (attempt ${outcome.attempts}), retrying in ${outcome.retryInSeconds}s`,
        { jobId: job.jobId, error: error.message }
      );
    }

    return outcome.status;
  }
};

/**
 * Start the polling loop.
 *
 * @param {Object} db
 * @param {Object} [options]
 * @param {number} [options.pollIntervalMs=3000] - wait when the queue is empty
 * @param {number} [options.reclaimEveryMs=300000] - how often to release stale locks
 * @param {string} [options.workerId]
 * @returns {{ stop: () => Promise<void> }}
 */
export const startWorker = (db, options = {}) => {
  const {
    pollIntervalMs = 3000,
    reclaimEveryMs = 5 * 60 * 1000,
    workerId = `worker-${process.pid}`,
  } = options;

  let running = true;
  let idle = Promise.resolve();
  let lastReclaim = 0;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const loop = async () => {
    logger.info(`[worker] started as ${workerId}`, { types: registeredTypes() });

    while (running) {
      try {
        if (Date.now() - lastReclaim > reclaimEveryMs) {
          lastReclaim = Date.now();
          const released = await reclaimStale(db);
          if (released > 0) {
            logger.warn(`[worker] reclaimed ${released} job(s) from a stopped worker`);
          }
        }

        const job = await claim(db, { workerId });

        if (!job) {
          await sleep(pollIntervalMs);
          continue;
        }

        await processJob(db, job, { workerId });
      } catch (error) {
        // Reaching here means the queue itself failed — the database is down,
        // say. Keep looping: the alternative is a worker that exits on a blip
        // and stops disconnecting or reconnecting anyone until someone notices.
        logger.error("[worker] loop error, continuing", { error: error.message });
        await sleep(pollIntervalMs);
      }
    }

    logger.info(`[worker] ${workerId} stopped`);
  };

  idle = loop();

  return {
    /** Finish the job in flight, then stop. */
    stop: async () => {
      running = false;
      await idle;
    },
  };
};

export default { registerProcessor, registeredTypes, processJob, startWorker };
