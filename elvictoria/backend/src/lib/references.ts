
/**
 * Human-readable reference numbers (ELV-PR-1001, ELV-EQ-4001, ...).
 *
 * Counters live in a dedicated table so several app instances can allocate
 * numbers without collisions: the UPDATE ... RETURNING inside a transaction
 * is atomic in PostgreSQL.
 */

const PREFIXES: Record<string, string> = {
  property: "ELV-PR",
  enquiry: "ELV-EQ",
  case: "ELV-CS",
  payment: "ELV-PY",
  ticket: "ELV-HD",
};

export type CounterName = keyof typeof PREFIXES;

/** Allocate the next number for a counter and return a formatted reference. */
export async function nextReference(
  tx: { $queryRaw: Function },
  name: CounterName,
): Promise<string> {
  const rows = (await tx.$queryRaw`
    INSERT INTO "ReferenceCounter" ("name", "value")
    VALUES (${name}, 1)
    ON CONFLICT ("name")
    DO UPDATE SET "value" = "ReferenceCounter"."value" + 1
    RETURNING "value"
  `) as Array<{ value: number | bigint }>;

  const value = Number(rows[0].value);
  // Zero-pad to 4 digits so references read and sort as ELV-HD-0007;
  // values above 9999 pass through unchanged.
  return `${PREFIXES[name]}-${String(value).padStart(4, "0")}`;
}
