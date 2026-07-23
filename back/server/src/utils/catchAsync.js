import { z } from "zod";

import { ERROR_CODES } from "./APIError.js";

// Validate request body
// Note: Declared as async for middleware consistency and future-proofing
// even though schema.parse() is currently synchronous
export const validateBody = (schema) => {
  // eslint-disable-next-line require-await
  return async (req, res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Zod v3+ exposes `issues`; older versions use `errors`.
        const issues = error.issues || error.errors || [];
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          code: ERROR_CODES.VALIDATION_FAILED,
          errors: issues.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  };
};

// Validate query parameters.
//
// In Express 5 `req.query` is a GETTER on the prototype — assigning to its
// properties does not stick, so the previous per-key copy silently did nothing
// and controllers kept reading the raw strings (an empty `?page=` stayed "",
// which is not `undefined`, so their destructuring defaults never fired and
// `Number("")` produced 0). Shadow the getter with an own data property so the
// coerced values and schema defaults actually reach the handler.
export const validateQuery = (schema) => {
  // eslint-disable-next-line require-await
  return async (req, res, next) => {
    try {
      const parsed = schema.parse(req.query);
      req.validatedQuery = parsed;
      Object.defineProperty(req, "query", {
        value: parsed,
        writable: true,
        configurable: true,
        enumerable: true,
      });
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorList = error.issues || error.errors || [];
        return res.status(400).json({
          success: false,
          message: "Invalid query parameters",
          code: ERROR_CODES.VALIDATION_FAILED,
          errors: errorList.map((err) => ({
            field: err.path.join("."),
            message: err.message,
          })),
        });
      }
      next(error);
    }
  };
};

// Validate route parameters
// Note: Declared as async for middleware consistency and future-proofing
export const validateParams = (schema) => {
  // eslint-disable-next-line require-await
  return async (req, res, next) => {
    try {
      req.params = schema.parse(req.params);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const issues = error.issues || error.errors || [];
        return res.status(400).json({
          success: false,
          message: "Invalid parameters",
          code: ERROR_CODES.VALIDATION_FAILED,
          errors: issues.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  };
};

// Async error wrapper
export const catchAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
