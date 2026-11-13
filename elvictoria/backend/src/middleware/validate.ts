import type { NextFunction, Request, Response } from "express";
import { ZodError, type ZodSchema, z } from "zod";
import { ApiError } from "../lib/errors.js";

/**
 * Validated (parsed/coerced) request data slot. Express 5 exposes req.query
 * through a getter that re-parses the URL, so parsed query values cannot be
 * written back; handlers therefore read the coerced values from here.
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      validated?: { body?: unknown; query?: unknown; params?: unknown };
    }
  }
}

/**
 * Validation middleware using zod schemas.
 *
 * Usage: router.post("/", validate(bodySchema, querySchema), routeHandler)
 * Parsed (and coerced/trimmed) values replace the raw ones on the request,
 * so handlers only ever see clean data.
 */
export function validate(schemas: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const validated: { body?: unknown; query?: unknown; params?: unknown } = {};
      if (schemas.body) {
        validated.body = schemas.body.parse(req.body ?? {});
        req.body = validated.body;
      }
      if (schemas.query) validated.query = schemas.query.parse(req.query);
      if (schemas.params) validated.params = schemas.params.parse(req.params);
      req.validated = validated;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const fields: Record<string, string> = {};
        for (const issue of err.issues) {
          const key = issue.path.join(".") || "form";
          if (!fields[key]) fields[key] = issue.message;
        }
        next(ApiError.badRequest("Please check the highlighted fields.", fields));
      } else {
        next(err);
      }
    }
  };
}

/** Shared primitives reused by several module schemas. */
export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address.");
export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters.")
  .regex(/[A-Za-z]/, "Include at least one letter.")
  .regex(/[0-9]/, "Include at least one number.");
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9][0-9\s-]{6,19}$/, "Enter a valid phone number.")
  .optional()
  .or(z.literal(""));
export const idSchema = z.string().min(1);
export const pageSchema = z.coerce.number().int().min(1).default(1);
export const pageSizeSchema = z.coerce.number().int().min(1).max(50).default(12);
