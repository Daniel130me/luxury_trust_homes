-- Consolidate the individual lawyer accounts into one shared identity.
--
-- Business rule: every ELVICTORIA lawyer works from the single
-- "ELVICTORIA Legal" login, so clients and providers only ever see that
-- the legal team handles their matter — never which individual lawyer.
--
-- Steps: promote the oldest lawyer account to the shared identity,
-- reassign every row owned by the other lawyers to it, drop their
-- sessions/recovery rows, then delete the other lawyer accounts.

-- 1. Promote the oldest lawyer account to the shared identity
--    (skipped when the shared account already exists, e.g. re-run).
UPDATE "User"
SET "name"         = 'ELVICTORIA Legal',
    "email"        = 'legal@elvictoria.example',
    "organisation" = 'Property & Conveyancing Team'
WHERE "role" = 'LAWYER'
  AND "registeredAt" = (SELECT MIN("registeredAt") FROM "User" WHERE "role" = 'LAWYER')
  AND NOT EXISTS (SELECT 1 FROM "User" WHERE "email" = 'legal@elvictoria.example');

-- 2. Reassign every lawyer-owned row to the shared account.
UPDATE "Enquiry"
SET "lawyerId" = (SELECT "id" FROM "User" WHERE "email" = 'legal@elvictoria.example')
WHERE "lawyerId" IN (SELECT "id" FROM "User" WHERE "role" = 'LAWYER' AND "email" <> 'legal@elvictoria.example');

UPDATE "EnquiryEscalation"
SET "byId" = (SELECT "id" FROM "User" WHERE "email" = 'legal@elvictoria.example')
WHERE "byId" IN (SELECT "id" FROM "User" WHERE "role" = 'LAWYER' AND "email" <> 'legal@elvictoria.example');

UPDATE "Case"
SET "lawyerId" = (SELECT "id" FROM "User" WHERE "email" = 'legal@elvictoria.example')
WHERE "lawyerId" IN (SELECT "id" FROM "User" WHERE "role" = 'LAWYER' AND "email" <> 'legal@elvictoria.example');

UPDATE "CaseTimelineEntry"
SET "actorId" = (SELECT "id" FROM "User" WHERE "email" = 'legal@elvictoria.example')
WHERE "actorId" IN (SELECT "id" FROM "User" WHERE "role" = 'LAWYER' AND "email" <> 'legal@elvictoria.example');

UPDATE "CaseMessage"
SET "authorId" = (SELECT "id" FROM "User" WHERE "email" = 'legal@elvictoria.example')
WHERE "authorId" IN (SELECT "id" FROM "User" WHERE "role" = 'LAWYER' AND "email" <> 'legal@elvictoria.example');

UPDATE "PropertyHistory"
SET "actorId" = (SELECT "id" FROM "User" WHERE "email" = 'legal@elvictoria.example')
WHERE "actorId" IN (SELECT "id" FROM "User" WHERE "role" = 'LAWYER' AND "email" <> 'legal@elvictoria.example');

UPDATE "ContactDisclosure"
SET "disclosedBy" = (SELECT "id" FROM "User" WHERE "email" = 'legal@elvictoria.example')
WHERE "disclosedBy" IN (SELECT "id" FROM "User" WHERE "role" = 'LAWYER' AND "email" <> 'legal@elvictoria.example');

UPDATE "Payment"
SET "requestedById" = (SELECT "id" FROM "User" WHERE "email" = 'legal@elvictoria.example')
WHERE "requestedById" IN (SELECT "id" FROM "User" WHERE "role" = 'LAWYER' AND "email" <> 'legal@elvictoria.example');

UPDATE "TicketMessage"
SET "authorId" = (SELECT "id" FROM "User" WHERE "email" = 'legal@elvictoria.example')
WHERE "authorId" IN (SELECT "id" FROM "User" WHERE "role" = 'LAWYER' AND "email" <> 'legal@elvictoria.example');

UPDATE "Notification"
SET "userId" = (SELECT "id" FROM "User" WHERE "email" = 'legal@elvictoria.example')
WHERE "userId" IN (SELECT "id" FROM "User" WHERE "role" = 'LAWYER' AND "email" <> 'legal@elvictoria.example');

UPDATE "AuditLog"
SET "actorId" = (SELECT "id" FROM "User" WHERE "email" = 'legal@elvictoria.example')
WHERE "actorId" IN (SELECT "id" FROM "User" WHERE "role" = 'LAWYER' AND "email" <> 'legal@elvictoria.example');

-- 3. Remove the removed accounts' sessions and recovery rows, then the
--    accounts themselves (every referencing row was reassigned above).
DELETE FROM "Session"
WHERE "userId" IN (SELECT "id" FROM "User" WHERE "role" = 'LAWYER' AND "email" <> 'legal@elvictoria.example');

DELETE FROM "PasswordReset"
WHERE "userId" IN (SELECT "id" FROM "User" WHERE "role" = 'LAWYER' AND "email" <> 'legal@elvictoria.example');

DELETE FROM "User"
WHERE "role" = 'LAWYER' AND "email" <> 'legal@elvictoria.example';
