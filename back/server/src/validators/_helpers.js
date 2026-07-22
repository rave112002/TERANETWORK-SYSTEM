import { z } from "zod";

/**
 * Wrap a schema so an empty string is treated as "absent" (undefined).
 * Ant Design forms and multipart/form-data both send "" for cleared optional
 * fields; without this an optional `.email()`/`.enum()` would reject "".
 */
export const emptyToUndefined = (schema) =>
  z.preprocess((v) => (v === "" ? undefined : v), schema);

/** Optional free-text string, capped at `max`, tolerant of "". */
export const optionalString = (max) =>
  emptyToUndefined(z.string().max(max).optional());

/** Optional email, capped at `max`, tolerant of "". */
export const optionalEmail = (max = 100) =>
  emptyToUndefined(z.string().email("Invalid email address").max(max).optional());
