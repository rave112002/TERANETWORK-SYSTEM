import "dotenv/config";

import Database from "../config/database.js";
import { logger } from "../config/logger.js";
import { registerProcessor, startWorker } from "../src/lib/jobs/worker.js";
import { provisioningProcessor } from "../src/lib/jobs/processors/provisioning.processor.js";
import { emailProcessor } from "../src/lib/jobs/processors/email.processor.js";
import { startScheduler } from "../src/lib/scheduler/scheduler.js";

/**
 * The provisioning worker — a separate process from the API.
 *
 * ── Why separate ────────────────────────────────────────────────────────────
 *
 * Everything this process does is slow and failure-prone: telnet sessions to an
 * OLT, SMTP handshakes. None of it belongs in an HTTP request, and none of it
 * should be able to take the API down. Splitting them also means the worker can
 * later move to a box with access to the OLT management VLAN while the API
 * stays where it is — the queue is the only thing between them.
 *
 * Run alongside the API:
 *
 *   npm run worker        # production
 *   npm run worker:dev    # restarts on save
 *
 * ── Processors ──────────────────────────────────────────────────────────────
 *
 * Registered below, one per job type. The queue and loop stay generic — adding
 * a kind of work means registering a handler, not editing the loop.
 */

const db = new Database();

// Device work: suspend, restore, and read an ONU's live state.
registerProcessor("deactivate", provisioningProcessor);
registerProcessor("activate", provisioningProcessor);
registerProcessor("status", provisioningProcessor);

// Invoice delivery: the bill itself, reminders, overdue notices, receipts.
registerProcessor("email", emailProcessor);

let worker;
let scheduler;

const shutdown = async (signal) => {
  logger.info(`[worker] ${signal} received, finishing the job in flight…`);
  try {
    // Deliberately not immediate: killing a worker mid-command would leave a
    // job 'processing' with no holder, and the device in an unknown state.
    if (scheduler) scheduler.stop();
    if (worker) await worker.stop();
    await db.close();
    logger.info("[worker] shut down cleanly");
    process.exit(0);
  } catch (error) {
    logger.error("[worker] error during shutdown", { error: error.message });
    process.exit(1);
  }
};

const main = async () => {
  if (process.env.RUN_WORKER === "false") {
    logger.info("[worker] RUN_WORKER=false — not starting");
    process.exit(0);
  }

  await db.initialize();
  const healthy = await db.healthCheck();
  if (!healthy) {
    logger.error("[worker] database health check failed — refusing to start");
    process.exit(1);
  }

  worker = startWorker(db, {
    workerId: process.env.WORKER_ID || `worker-${process.pid}`,
    pollIntervalMs: Number(process.env.WORKER_POLL_MS || 3000),
  });

  // The billing schedules live here rather than in the API, which may run as
  // several instances — each of which would fire the same cron. Set
  // RUN_SCHEDULER=false on any additional worker if this is ever scaled out.
  if (process.env.RUN_SCHEDULER !== "false") {
    scheduler = startScheduler(db);
  } else {
    logger.info("[worker] RUN_SCHEDULER=false — billing schedules not registered");
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
};

main().catch((error) => {
  logger.error("[worker] failed to start", { error: error.message });
  process.exit(1);
});
