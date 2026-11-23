import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { join } from "node:path";
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

  // CORS with an explicit allow-list.
  //
  // Two legitimate combinations exist:
  //  1. Same origin — the sandbox gateway serves the SPA and proxies /api to
  //     this backend, so the browser's Origin equals the request Host.
  //  2. Cross origin — a deployed SPA origin listed in CORS_ORIGINS.
  // Reflecting arbitrary origins with credentials would let any site make
  // cookie-authenticated calls, so unknown origins are rejected.
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      const host = req.headers.host ?? "";
      // The sandbox gateway forwards Host without the port, so compare
      // hostnames (and full host when a port is present).
      let sameOrigin = false;
      try {
        const originHost = new URL(origin);
        sameOrigin =
          originHost.host === host ||
          originHost.hostname === host.split(":")[0];
      } catch {
        sameOrigin = false;
      }
      if (sameOrigin || corsOrigins.includes(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Access-Control-Allow-Credentials", "true");
        res.setHeader("Vary", "Origin");
      }
    }
    if (req.method === "OPTIONS") {
      res.setHeader(
        "Access-Control-Allow-Methods",
        "GET,POST,PATCH,PUT,DELETE,OPTIONS",
      );
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type,X-CSRF-Token,Authorization",
      );
      res.setHeader("Access-Control-Max-Age", "600");
      res.status(204).end();
      return;
    }
    next();
  });

  app.use(express.json({ limit: "1mb" })); // uploads use multipart, not JSON
  app.use(cookieParser());
  app.use(generalLimiter);

  app.use(attachUser);
  app.use(requireCsrf);

  // Simple health probe used by the sandbox and deploy checks.
  app.get("/health", (_req, res) => {
    res.json({ ok: true, data: { status: "up", env: env.NODE_ENV } });
  });

  // Serve locally-stored listing media (photos/videos) when the storage
  // driver is local disk (sandbox/dev). With real R2 credentials the URLs
  // point at the CDN instead, so this route simply never matches there.
  // Public on purpose — listing media is public content (same as the old
  // public R2 delivery).
  app.use(
    "/api/media",
    express.static(join(process.cwd(), "media"), {
      maxAge: "365d",
      immutable: true,
      fallthrough: true,
    }),
  );

  app.use("/api", apiRouter);

  // Unknown API path -> 404 (kept JSON-shaped for the SPA).
  app.use("/api", (_req, res) => {
    res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: "Endpoint not found." } });
  });

  app.use(errorHandler);
  return app;
}
