/**
 * Restore the platform's bank-transfer details (shown to payers at the
 * manual-transfer stage). Staff-safe: fills only BLANK or stale-branded
 * values, never overwrites re-entered data. Run: node scripts/seed_bank_settings.js
 */
const { Client } = require("/home/z/my-project/node_modules/pg");

const SETTINGS = [
  { key: "bankName", value: "GTBank" },
  { key: "bankAccountName", value: "Elvictoria Attorneys and Solicitors" },
  { key: "bankAccountNumber", value: "0123456789" },
];

(async () => {
  const c = new Client({
    host: "127.0.0.1",
    port: 5432,
    user: "elvictoria",
    database: "elvictoria",
  });
  await c.connect();
  for (const s of SETTINGS) {
    // Fill blanks, and refresh the pre-rebrand "ELVICTORIA …" account name.
    const stale = s.key === "bankAccountName" ? ' OR "Setting"."value" ILIKE \'ELVICTORIA%\'' : "";
    await c.query(
      'INSERT INTO "Setting" ("key","value","updatedAt") VALUES ($1,$2,NOW()) ' +
        `ON CONFLICT ("key") DO UPDATE SET "value"=$2, "updatedAt"=NOW() ` +
        `WHERE "Setting"."value"=''${stale}`,
      [s.key, s.value],
    );
    const r = await c.query('SELECT "value" FROM "Setting" WHERE "key"=$1', [s.key]);
    console.log(`${s.key} = ${JSON.stringify(r.rows[0]?.value)}`);
  }
  await c.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
