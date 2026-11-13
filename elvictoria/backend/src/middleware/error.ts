import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { ApiError } from "../lib/errors.js";
import { env } from "../config/env.js";

/**
 * Central error handling.
 *
 * - ApiError            -> intentional, safe messages
 * - Zod / Prisma errors -> mapped to safe messages (never leak SQL)
 * - everything else     -> logged server-side, generic message to the client
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ApiError) {
    res.status(err.status).json({
      ok: false,
      error: { code: err.code, message: err.message, fields: err.fields },
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // Unique constraint violations surface as friendly conflicts.
    if (err.code === "P2002") {
      res.status(409).json({
        ok: false,
        error: { code: "CONFLICT", message: "That record already exists." },
      });
      return;
    }
    if (err.code === "P2025") {
      res.status(404).json({
        ok: false,
        error: { code: "NOT_FOUND", message: "Resource not found." },
      });
      return;
    }
  }

  if (err instanceof SyntaxError && "body" in (err as object)) {
    res.status(400).json({
      ok: false,
      error: { code: "BAD_REQUEST", message: "Malformed request body." },
    });
    return;
  }

  // Unexpected error: log server-side, return a generic message.
  // eslint-disable-next-line no-console
  console.error(
    `[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`,
    err,
  );
  res.status(500).json({
    ok: false,
    error: {
      code: "INTERNAL",
      message:
        env.NODE_ENV === "production"
          ? "Something went wrong. Please try again."
          : String((err as Error)?.message ?? err),
    },
  });
}
