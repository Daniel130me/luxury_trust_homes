/**
 * Fill the bankAccountName setting shown to payers at the manual-transfer
 * stage. Idempotent and staff-safe: only overwrites a BLANK value, never one
 * a staff member has already entered. Run: node scripts/seed_bank_name.js
 */
const { Client } = require("/home/z/my-project/node_modules/pg");

const FIRM = "Elvictoria Attorneys and Solicitors";

(async () => {
  const c = new Client({
    host: "127.0.0.1",
    port: 5432,
    user: "elvictoria",
    database: "elvictoria",
  });
  await c.connect();
  await c.query(
    'INSERT INTO "Setting" ("key","value","updatedAt") VALUES ($1,$2,NOW()) ' +
      'ON CONFLICT ("key") DO UPDATE SET "value"=$2, "updatedAt"=NOW() ' +
      "WHERE \"Setting\".\"value\"=''",
    ["bankAccountName", FIRM],
  );
  const r = await c.query('SELECT "key","value" FROM "Setting" WHERE "key"=$1', [
    "bankAccountName",
  ]);
  console.log("bankAccountName =", JSON.stringify(r.rows[0]?.value));
  await c.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
