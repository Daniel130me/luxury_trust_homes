import { createApp } from "./app.js";
import { env } from "./config/env.js";

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

// Graceful shutdown so in-flight requests finish when the container stops.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
