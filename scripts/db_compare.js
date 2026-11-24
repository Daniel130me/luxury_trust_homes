/**
 * DB identity check — compares the dataset in Neon (from backend/.env)
 * against the local sandbox Postgres, printing only counts (no secrets).
 * Run: node /home/z/my-project/scripts/db_compare.js
 */
const fs = require("fs");
const path = require("path");
const { Client } = require(path.join("/home/z/my-project", "node_modules", "pg"));

function readEnvUrl(file, key) {
  const txt = fs.readFileSync(file, "utf8");
  const m = txt.match(new RegExp(`^${key}\\s*=\\s*"?([^"\\n\\r]+)"?`, "m"));
  return m ? m[1].trim() : null;
}

const ENV = "/home/z/my-project/elvictoria/backend/.env";

async function describe(label, url) {
  const u = new URL(url);
  const needsSsl = u.hostname !== "127.0.0.1" && u.hostname !== "localhost";
  const c = new Client({
    host: u.hostname,
    port: u.port || 5432,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace("/", ""),
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
  });
  await c.connect();
  const dbName = (await c.query("SELECT current_database() AS d")).rows[0].d;
  const serverHost = (await c.query("SELECT inet_server_addr()::text AS a")).rows[0].a;
  const counts = (await c.query(
    "SELECT (SELECT count(*) FROM \"Enquiry\")::int AS enquiries, " +
    "(SELECT count(*) FROM \"Case\")::int AS cases, " +
    "(SELECT count(*) FROM \"User\")::int AS users, " +
    "(SELECT count(*) FROM \"Property\")::int AS properties",
  )).rows[0];
  const enquiryStatuses = (await c.query(
    "SELECT status, count(*)::int AS n FROM \"Enquiry\" GROUP BY status ORDER BY status",
  )).rows;
  console.log(`--- ${label} ---`);
  console.log(`host=${u.hostname} db=${dbName} serverAddr=${serverHost}`);
  console.log(`counts=${JSON.stringify(counts)}`);
  console.log(`enquiryStatuses=${JSON.stringify(enquiryStatuses)}`);
  await c.end();
}

(async () => {
  const neonUrl = readEnvUrl(ENV, "DATABASE_URL");
  const directUrl = readEnvUrl(ENV, "DATABASE_DIRECT_URL");
  console.log(`env keys present: DATABASE_URL=${!!neonUrl} DATABASE_DIRECT_URL=${!!directUrl}`);
  if (directUrl) {
    const du = new URL(directUrl);
    console.log(`directUrl host (masked): ${du.hostname}`);
  }
  await describe("NEON (DATABASE_URL from .env)", neonUrl);
  await describe("LOCAL 127.0.0.1:5432/elvictoria", "postgresql://elvictoria@127.0.0.1:5432/elvictoria");
})().catch((e) => { console.error("ERR:", e.message); process.exit(1); });
