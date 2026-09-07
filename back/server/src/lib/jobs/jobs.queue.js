import { getCurrentTimestampLocal, moment } from "../../utils/dateUtils.js";

/**
 * The durable work queue, on MySQL.
 *
 * A small interface — enqueue / claim / complete / fail / cancel — so the table
 * underneath could be swapped for a real broker later without touching callers.
 * That is the only reason this is a module rather than five inline queries.
 *
 * ── The three guarantees, and how each is obtained ──────────────────────────
 *
 * 1. **No two workers run the same job.** `claim()` selects with
 *    `FOR UPDATE SKIP LOCKED` inside a transaction: the row is locked as it is
 *    read, and a second worker skips past it rather than blocking on it. This
 *    is why the queue works with more than one worker and without a broker.
 *
 * 2. **A re-run does not duplicate work.** `enqueue()` refuses to add a second
 *    live job for a `dedupeKey` that already has one. The dunning sweep can run
 *    twice and still produce one disconnect per customer.
 *
 * 3. **A failure is retried, then parked.** `fail()` pushes `nextRunAt` into the
 *    future with exponential backoff plus jitter, and after `maxAttempts` marks
 *    the row `dead` rather than retrying forever. Dead is a state a human is
 *    expected to look at, not a synonym for "gave up quietly".
 *
 * ── What this module deliberately does not do ───────────────────────────────
 *
 * It never touches domain tables. A processor decides what a job *means*;
 * this only moves rows between states. That separation is what lets the
 * disconnect processor re-check its preconditions before acting — the queue has
 * no opinion about whether the work is still wanted.
 */

/** Jobs a worker may pick up. Anything else has reached a terminal state. */
const CLAIMABLE = "queued";

/** States that count as "this work is already in flight or waiting". */
const LIVE_STATUSES = ["queued", "processing"];

/**
 * Backoff before the next attempt: 1, 2, 4, 8, 16 minutes, capped, plus up to
 * 30 s of jitter.
 *
 * The jitter matters more than it looks. When an OLT goes unreachable, every
 * queued job for it fails within the same second; without jitter they would all
 * retry in the same second too, and keep arriving in a synchronised wave that
 * a 250 MHz device has no chance of absorbing.
 *
 * @param {number} attempts - attempts made so far, including the one that just failed
 * @returns {number} delay in seconds
 */
export const backoffSeconds = (attempts) => {
  const base = Math.min(2 ** Math.max(0, attempts - 1), 16) * 60;
  return base + Math.floor(Math.random() * 30);
};

/**
 * Add a job, unless an identical one is already live.
 *
 * @param {import('mysql2/promise').PoolConnection} conn - the caller's
 *   transaction. Enqueueing inside the transaction that made the change is what
 *   stops a job existing for a state write that rolled back.
 * @param {Object} job
 * @param {string} job.companyId
 * @param {string} [job.branchId]
 * @param {'deactivate'|'activate'|'status'|'email'} job.type
 * @param {Object} job.payload
 * @param {string} [job.dedupeKey] - omit for work that may legitimately repeat
 * @param {number} [job.maxAttempts=5]
 * @param {Date|string} [job.runAt] - defer the first attempt
 * @returns {Promise<{jobId: string|null, deduped: boolean}>} `deduped` is true
 *   when an equivalent job already existed and nothing was inserted.
 */
export const enqueue = async (
  conn,
  { companyId, branchId = null, type, payload, dedupeKey = null, maxAttempts = 5, runAt = null }
) => {
  const now = getCurrentTimestampLocal();
  const nextRunAt = runAt ? moment(runAt).format("YYYY-MM-DD HH:mm:ss") : now;

  if (dedupeKey) {
    // Locked, not just read: two sweeps racing must not both pass this check.
    const [existing] = await conn.execute(
      `SELECT jobId FROM jobs
       WHERE dedupeKey = ? AND status IN (?, ?)
       LIMIT 1 FOR UPDATE`,
      [dedupeKey, ...LIVE_STATUSES]
    );

    if (existing.length > 0) {
      return { jobId: existing[0].jobId, deduped: true };
    }
  }

  const [uuidRow] = await conn.execute(`SELECT UUID() as id`);
  const jobId = uuidRow[0].id;

  await conn.execute(
    `INSERT INTO jobs
       (jobId, companyId, branchId, type, payload, status, attempts, maxAttempts,
        nextRunAt, dedupeKey, dateCreated, dateUpdated)
     VALUES (?, ?, ?, ?, ?, 'queued', 0, ?, ?, ?, ?, ?)`,
    [
      jobId,
      companyId,
      branchId,
      type,
      JSON.stringify(payload ?? {}),
      maxAttempts,
      nextRunAt,
      dedupeKey,
      now,
      now,
    ]
  );

  return { jobId, deduped: false };
};

/**
 * Claim the next due job for this worker.
 *
 * The whole point is the `SKIP LOCKED`: several workers can run this
 * simultaneously and each gets a different row instead of queueing behind the
 * same one.
 *
 * @param {Object} db - the Database wrapper (`req.db` or the worker's own)
 * @param {Object} options
 * @param {string} options.workerId - identifies the holder, for debugging a stuck job
 * @param {string[]} [options.types] - restrict to certain job types
 * @returns {Promise<Object|null>} the claimed job, or null when nothing is due
 */
export const claim = async (db, { workerId, types = null }) => {
  let conn;
  try {
    conn = await db.beginTransaction();
    const now = getCurrentTimestampLocal();

    const typeFilter = types?.length
      ? ` AND type IN (${types.map(() => "?").join(", ")})`
      : "";

    const [rows] = await conn.execute(
      `SELECT jobId, companyId, branchId, type, payload, attempts, maxAttempts
       FROM jobs
       WHERE status = ? AND nextRunAt <= ?${typeFilter}
       ORDER BY id
       LIMIT 1
       FOR UPDATE SKIP LOCKED`,
      [CLAIMABLE, now, ...(types ?? [])]
    );

    if (rows.length === 0) {
      await db.commit(conn);
      return null;
    }

    const job = rows[0];

    await conn.execute(
      `UPDATE jobs
       SET status = 'processing', attempts = attempts + 1, lockedAt = ?, lockedBy = ?,
           startedAt = COALESCE(startedAt, ?), dateUpdated = ?
       WHERE jobId = ?`,
      [now, workerId, now, now, job.jobId]
    );

    await db.commit(conn);

    return {
      ...job,
      // mysql2 hands back JSON columns already parsed, but a string arrives
      // from some driver configurations — accept either.
      payload: typeof job.payload === "string" ? JSON.parse(job.payload) : job.payload,
      attempts: job.attempts + 1,
    };
  } catch (err) {
    await db.rollback(conn);
    throw err;
  }
};

/**
 * Mark a claimed job finished.
 *
 * @param {Object} db
 * @param {string} jobId
 * @param {Object} [result] - stored on the payload under `result`, for a status
 *   read whose answer is the point of running it
 */
export const complete = async (db, jobId, result = null) => {
  const now = getCurrentTimestampLocal();

  await db.query(
    `UPDATE jobs
     SET status = 'succeeded', lockedAt = NULL, lockedBy = NULL, lastError = NULL,
         finishedAt = ?, dateUpdated = ?,
         payload = ${result === null ? "payload" : "JSON_SET(payload, '$.result', CAST(? AS JSON))"}
     WHERE jobId = ? AND status = 'processing'`,
    result === null ? [now, now, jobId] : [now, now, JSON.stringify(result), jobId]
  );
};

/**
 * Record a failure: retry with backoff, or dead-letter once attempts run out.
 *
 * @returns {Promise<{status: 'queued'|'dead', attempts: number, retryInSeconds: number|null}>}
 */
export const fail = async (db, jobId, error) => {
  const now = getCurrentTimestampLocal();
  const message = (error?.message ?? String(error ?? "Unknown error")).slice(0, 2000);

  const [job] = await db.query(
    `SELECT attempts, maxAttempts FROM jobs WHERE jobId = ? LIMIT 1`,
    [jobId]
  );

  if (!job) return { status: "dead", attempts: 0, retryInSeconds: null };

  const attempts = Number(job.attempts);
  const exhausted = attempts >= Number(job.maxAttempts);

  if (exhausted) {
    // 'dead' rather than 'failed': a state someone is expected to come and look
    // at. Nothing retries out of it automatically.
    await db.query(
      `UPDATE jobs
       SET status = 'dead', lockedAt = NULL, lockedBy = NULL, lastError = ?,
           finishedAt = ?, dateUpdated = ?
       WHERE jobId = ?`,
      [message, now, now, jobId]
    );
    return { status: "dead", attempts, retryInSeconds: null };
  }

  const retryInSeconds = backoffSeconds(attempts);
  const nextRunAt = moment().add(retryInSeconds, "seconds").format("YYYY-MM-DD HH:mm:ss");

  await db.query(
    `UPDATE jobs
     SET status = 'queued', lockedAt = NULL, lockedBy = NULL, lastError = ?,
         nextRunAt = ?, dateUpdated = ?
     WHERE jobId = ?`,
    [message, nextRunAt, now, jobId]
  );

  return { status: "queued", attempts, retryInSeconds };
};

/**
 * Cancel queued jobs matching a dedupe key.
 *
 * This is how a payment stops a disconnect that has not started yet. Jobs
 * already `processing` are deliberately left alone — a worker mid-command
 * cannot be interrupted safely, so the processor's own precondition re-check is
 * what stops it doing the wrong thing.
 *
 * @param {import('mysql2/promise').PoolConnection|Object} conn - the caller's
 *   transaction where possible, so cancelling commits with the payment.
 * @returns {Promise<number>} how many were cancelled
 */
export const cancel = async (conn, dedupeKey, reason = null) => {
  const now = getCurrentTimestampLocal();

  const [result] = await conn.execute(
    `UPDATE jobs
     SET status = 'cancelled', lastError = ?, finishedAt = ?, dateUpdated = ?
     WHERE dedupeKey = ? AND status = 'queued'`,
    [reason, now, now, dedupeKey]
  );

  return result.affectedRows;
};

/**
 * Release jobs whose worker died mid-flight.
 *
 * A process killed while holding a row leaves it `processing` forever, with no
 * lock to expire — nothing in the database knows the holder is gone. So a stale
 * lock is reclaimed on age, and the attempt already counted against it stands:
 * a job that reliably kills its worker must still reach the dead letter rather
 * than cycling for ever.
 *
 * @param {Object} db
 * @param {number} [olderThanMinutes=15] - longer than the longest sane device command
 * @returns {Promise<number>} how many were released
 */
export const reclaimStale = async (db, olderThanMinutes = 15) => {
  const now = getCurrentTimestampLocal();
  const cutoff = moment().subtract(olderThanMinutes, "minutes").format("YYYY-MM-DD HH:mm:ss");

  const result = await db.query(
    `UPDATE jobs
     SET status = 'queued', lockedAt = NULL, lockedBy = NULL,
         lastError = 'Reclaimed after the worker holding it stopped responding',
         nextRunAt = ?, dateUpdated = ?
     WHERE status = 'processing' AND lockedAt < ?`,
    [now, now, cutoff]
  );

  return result.affectedRows ?? 0;
};

/** Counts by status, for the queue screen and the dead-letter alert. */
export const getQueueStats = async (db, companyId) => {
  const rows = await db.query(
    `SELECT status, COUNT(*) AS total FROM jobs WHERE companyId = ? GROUP BY status`,
    [companyId]
  );

  const stats = {
    queued: 0,
    processing: 0,
    succeeded: 0,
    failed: 0,
    dead: 0,
    cancelled: 0,
  };
  for (const row of rows) stats[row.status] = Number(row.total);
  return stats;
};

export default {
  enqueue,
  claim,
  complete,
  fail,
  cancel,
  reclaimStale,
  getQueueStats,
  backoffSeconds,
};
