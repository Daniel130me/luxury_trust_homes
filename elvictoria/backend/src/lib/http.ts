import type { Response } from "express";
import { ApiError } from "./errors.js";

/**
 * Consistent JSON envelope helpers.
 *
 * Every success response is { ok: true, data } — clients never have to guess
 * where the payload lives. Errors are thrown as ApiError anywhere in a route
 * or service; Express 5 forwards rejected promises to the central error
 * middleware (see middleware/error.ts).
 */
export function ok<T>(res: Response, data: T, status = 200) {
  return res.status(status).json({ ok: true, data });
}

export { ApiError };
