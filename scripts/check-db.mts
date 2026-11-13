/**
 * Quick data-count probe for the Neon database.
 * Run from elvictoria/backend so @prisma/client resolves:
 *   cd elvictoria/backend && npx tsx ../../scripts/check-db.mts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const MODELS = [
  "user",
  "property",
  "enquiry",
  "enquiryMessage",
  "transactionCase",
  "payment",
  "notification",
  "ticket",
  "platformSetting",
] as const;

const counts: Record<string, number | string> = {};
for (const model of MODELS) {
  try {
    // Dynamic access by model name — Prisma exposes each delegate on the client.
    const delegate = (prisma as unknown as Record<string, { count: () => Promise<number> }>)[model];
    counts[model] = await delegate.count();
  } catch (error) {
    counts[model] = `ERR: ${(error as Error).message.slice(0, 80)}`;
  }
}

console.log(JSON.stringify(counts, null, 2));
await prisma.$disconnect();
