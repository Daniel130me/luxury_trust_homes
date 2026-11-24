/**
 * One-off probe: find transaction cases with contact disclosures and print
 * the receiving parties' emails (seeded password works for demo accounts)
 * plus case/enquiry ids for the UI check.
 *
 * NOTE (NON-STANDARD): the workspace root and elvictoria/backend each have a
 * @prisma/client; we must load the BACKEND's generated client, so we create
 * a require scoped to the backend package instead of a plain import.
 */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const backendDir = "/home/z/my-project/elvictoria/backend";

// Load DATABASE_URL from the backend .env without printing it.
const envFile = readFileSync(`${backendDir}/.env`, "utf8");
for (const line of envFile.split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const require = createRequire(`${backendDir}/package.json`);
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const disclosures = await prisma.contactDisclosure.findMany({
  take: 5,
  orderBy: { at: "desc" },
  select: { caseId: true, party: true, disclosedTo: true, at: true },
});

console.log("disclosure rows:", disclosures.length);
for (const d of disclosures) {
  const kase = await prisma.case.findUnique({
    where: { id: d.caseId },
    select: {
      id: true,
      reference: true,
      enquiryId: true,
      client: { select: { email: true, name: true } },
      provider: { select: { email: true, name: true } },
    },
  });
  console.log(JSON.stringify({ party: d.party, at: d.at, case: kase }));
}

await prisma.$disconnect();
