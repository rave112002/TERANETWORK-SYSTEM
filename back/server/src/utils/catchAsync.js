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

// Validate query parameters
// Note: req.query is read-only in Express, so we store parsed data in req.validatedQuery
// and also copy validated values back to req.query properties individually
export const validateQuery = (schema) => {
  // eslint-disable-next-line require-await
  return async (req, res, next) => {
    try {
      const parsed = schema.parse(req.query);
      // Store validated data in a separate property
      req.validatedQuery = parsed;
      // Also update individual query properties (since req.query object itself is read-only)
      Object.keys(parsed).forEach((key) => {
        req.query[key] = parsed[key];
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
