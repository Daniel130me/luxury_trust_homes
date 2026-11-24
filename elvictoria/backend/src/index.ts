import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { purgeExpiredArchives, ARCHIVE_RETENTION_DAYS } from "./modules/properties/service.js";

/**
 * Server entry point.
 *
 * The Express backend is an independent application: it can run and deploy
 * on its own (npm run dev / npm run build && npm start). In the development
 * sandbox it is started as a companion service on port 3030 next to the
 * Next.js frontend.
 */
const app = createApp();

const server = app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(
    `[elvictoria-backend] listening on port ${env.PORT} (${env.NODE_ENV}, flutterwave: ${env.FLW_ENVIRONMENT})`,
  );
});

// Archived listings are permanently deleted once their retention window
// (ARCHIVE_RETENTION_DAYS) has passed. Run the sweep at boot and then every
// 6 hours — the schedule needs no precision, only regular coverage.
const PURGE_INTERVAL_MS = 6 * 60 * 60 * 1000;
void purgeExpiredArchives()
  .then((r) => {
    if (r.checked > 0) {
      // eslint-disable-next-line no-console
      console.log(`[elvictoria-backend] archive purge: ${r.purged} deleted, ${r.kept} kept (legal history)`);
    }
  })
  .catch((err: Error) => {
    // eslint-disable-next-line no-console
    console.warn(`[elvictoria-backend] archive purge failed: ${err.message}`);
  });
const purgeTimer = setInterval(() => {
  void purgeExpiredArchives().catch(() => undefined);
}, PURGE_INTERVAL_MS);
purgeTimer.unref(); // never keep the process alive just for the sweep
// eslint-disable-next-line no-console
console.log(`[elvictoria-backend] archive purge every 6h — retention ${ARCHIVE_RETENTION_DAYS} days`);

// Graceful shutdown so in-flight requests finish when the container stops.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
