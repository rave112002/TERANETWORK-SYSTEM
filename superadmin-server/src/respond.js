/**
 * The same response envelope the branch API uses, so the frontend unwraps both
 * the same way: `{ success, message, data }` / `{ success: false, message, code }`.
 */

export const ok = (res, message, data = {}, status = 200) =>
  res.status(status).json({ success: true, message, data });

export const fail = (res, status, message, code) =>
  res.status(status).json({ success: false, message, ...(code ? { code } : {}) });

/** Express 5 forwards rejected promises to the error handler by itself. */
export default { ok, fail };
