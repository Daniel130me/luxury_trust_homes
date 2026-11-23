/**
 * One-off rebrand fixups in the live database:
 *  - shared lawyer account display name -> "Elvictoria Legal"
 *  - bankAccountName setting -> the full firm name (only blanks/stale
 *    pre-rebrand values are overwritten)
 * Run: node scripts/rebrand_db_fixups.js
 */
const { Client } = require("/home/z/my-project/node_modules/pg");

(async () => {
  const c = new Client({
    host: "127.0.0.1",
    port: 5432,
    user: "elvictoria",
    database: "elvictoria",
  });
  await c.connect();
  await c.query('UPDATE "User" SET name=$1 WHERE email=$2', [
    "Elvictoria Legal",
    "legal@elvictoria.example",
  ]);
  await c.query(
    'INSERT INTO "Setting" ("key","value","updatedAt") VALUES ($1,$2,NOW()) ' +
      'ON CONFLICT ("key") DO UPDATE SET "value"=$2, "updatedAt"=NOW() ' +
      "WHERE \"Setting\".\"value\"='' OR \"Setting\".\"value\" ILIKE 'ELVICTORIA%'",
    ["bankAccountName", "Elvictoria Attorneys and Solicitors"],
  );
  const u = await c.query('SELECT name FROM "User" WHERE email=$1', [
    "legal@elvictoria.example",
  ]);
  const s = await c.query('SELECT "value" FROM "Setting" WHERE "key"=$1', [
    "bankAccountName",
  ]);
  console.log("lawyer name:", u.rows[0].name, "| bankAccountName:", s.rows[0].value);
  await c.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
