import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

/**
 * Load the backend .env file with explicit precedence: values in the file
 * win over anything inherited from the shell. This matters in the sandbox,
 * where the parent workspace exports its own DATABASE_URL — a naive
 * process.loadEnvFile() call would silently keep the wrong value.
 * In production the process environment supplies these values instead.
 */
try {
  const envPath = join(__dirname, "../../.env"); // <backend>/.env
  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split("\n")) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    const key = match[1];
    let value = match[2];
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (value !== "") process.env[key] = value;
  }
} catch {
  // No .env file — fine outside local development.
}

/**
 * Central environment configuration.
 *
 * Every value the app needs from the outside world is declared here exactly
 * once, validated at boot with zod, and imported everywhere else. If a
 * variable is missing or malformed the process refuses to start instead of
 * failing later at request time.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3030),

  // Neon PostgreSQL
  DATABASE_URL: z.string().min(1),
  DATABASE_DIRECT_URL: z.string().min(1),

  // Cloudflare R2 (S3-compatible)
  R2_BUCKET: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_S3_ENDPOINT: z.string().url(),
  R2_PUBLIC_BASE_URL: z.string().url(),

  // Flutterwave v3
  FLW_SECRET_KEY: z.string().min(1),
  FLW_PUBLIC_KEY: z.string().optional().default(""),
  FLW_WEBHOOK_SECRET: z.string().optional().default(""),
  FLW_ENVIRONMENT: z.enum(["test", "live"]).default("test"),

  // Auth
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  JWT_ACCESS_TTL: z.coerce.number().int().positive().default(900), // seconds
  REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),

  // CORS
  CORS_ORIGINS: z.string().default("http://localhost:3000"),
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // Print a readable list of problems instead of a stack trace.
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  // eslint-disable-next-line no-console
  console.error(`Invalid environment configuration:\n${issues}`);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";
export const corsOrigins = env.CORS_ORIGINS.split(",")
  .map((o) => o.trim())
  .filter(Boolean);
