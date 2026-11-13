import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { env, corsOrigins } from "./config/env.js";
import apiRouter from "./routes/index.js";
import { attachUser } from "./middleware/auth.js";
import { requireCsrf } from "./middleware/csrf.js";
import { errorHandler } from "./middleware/error.js";
import { generalLimiter } from "./middleware/rateLimit.js";

/**
 * Express application factory.
 *
 * Middleware order matters:
 *   security headers -> CORS -> cookies -> body parsing -> rate limiting ->
 *   auth/CSRF -> routes -> error handler (last).
 */
export function createApp() {
  const app = express();

  // Behind the sandbox gateway the real client IP arrives via the proxy.
  app.set("trust proxy", 1);

  app.use(
    helmet({
      // The frontend is a different origin in production; allow it to load
      // property images served from the R2 public base URL.
      crossOriginResourcePolicy: { policy: "cross-origin" },
      contentSecurityPolicy: false, // API only — HTML headers are the SPA's job
    }),
  );

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true); // same-origin / curl / webhook
        if (corsOrigins.includes(origin)) return callback(null, true);
        callback(new Error("Not allowed by CORS"));
      },
      credentials: true, // cookies ride along on cross-origin API calls
    }),
  );

  app.use(express.json({ limit: "1mb" })); // uploads use multipart, not JSON
  app.use(cookieParser());
  app.use(generalLimiter);

  app.use(attachUser);
  app.use(requireCsrf);

  // Simple health probe used by the sandbox and deploy checks.
  app.get("/health", (_req, res) => {
    res.json({ ok: true, data: { status: "up", env: env.NODE_ENV } });
  });

  app.use("/api", apiRouter);

  // Unknown API path -> 404 (kept JSON-shaped for the SPA).
  app.use("/api", (_req, res) => {
    res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: "Endpoint not found." } });
  });

  app.use(errorHandler);
  return app;
}
