/**
 * ELVICTORIA development seed.
 *
 * Populates Neon PostgreSQL with realistic data modelled on the reviewed
 * prototype: users for every role, property listings with real photos
 * uploaded to Cloudflare R2, enquiries, transaction cases with threads and
 * timelines, payment requests in every state, notifications, helpdesk
 * tickets and platform settings.
 *
 * Run: npm run db:seed   (repeatable — clears previous seed data first)
 *
 * Demo sign-in (development only, safe because it only exists in seeded
 * environments — change before production):
 *   lawyer  adaeze.okonkwo@elvictoria.example
 *   support mariam.bello@elvictoria.example
 *   provider chinedu@crestfieldhomes.example
 *   client  daniel.johnson@mail.example
 *   password for all: Elvictoria123
 */
import { PrismaClient, PropertyCategory, PropertyStatus, Availability } from "@prisma/client";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import bcrypt from "bcryptjs";
import { buildImageKey, publicUrl, putObject } from "../src/lib/r2.js";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "Elvictoria123";

type Db = Record<string, unknown>;
const seedDir = join(__dirname, "..", "prisma", "seed-data");
const db = JSON.parse(readFileSync(join(seedDir, "prototype_db.json"), "utf8")) as Db;
const photoLibrary = JSON.parse(
  readFileSync(join(seedDir, "photo_library.json"), "utf8"),
) as Record<string, string[]>;
const geography = JSON.parse(readFileSync(join(seedDir, "geography.json"), "utf8")) as Array<{
  state: string;
  region: string;
  lga: string;
  areas: string[];
}>;

/** Derive the Island/Mainland region for an LGA from the prototype geography. */
function regionFor(state: string, lga: string): string | null {
  const entry = geography.find((g) => g.state === state && g.lga === lga);
  return entry?.region ?? null;
}

const PROVIDER_KIND_MAP: Record<string, string> = {
  developer: "DEVELOPER",
  owner: "OWNER",
  agent: "AGENT",
  agency: "AGENT",
  landlord: "OWNER",
};

const CATEGORY_MAP: Record<string, PropertyCategory> = {
  detached_duplex: "DETACHED_DUPLEX",
  semi_detached_duplex: "SEMI_DETACHED_DUPLEX",
  apartment: "APARTMENT",
  terrace: "TERRACE",
  bungalow: "BUNGALOW",
  land: "LAND",
  commercial: "COMMERCIAL",
};

const STATUS_MAP: Record<string, PropertyStatus> = {
  draft: "DRAFT",
  pending_review: "PENDING_REVIEW",
  approved: "APPROVED",
  changes_requested: "CHANGES_REQUESTED",
  rejected: "REJECTED",
  unavailable: "UNAVAILABLE",
};

const PAYMENT_STATUS_MAP: Record<string, string> = {
  outstanding: "OUTSTANDING",
  awaiting_payment: "AWAITING_PAYMENT",
  initiated: "AWAITING_PAYMENT",
  pending: "AWAITING_PAYMENT",
  pending_confirmation: "PENDING_CONFIRMATION",
  successful: "SUCCESSFUL",
  failed: "FAILED",
};

const ENQUIRY_STATUS_MAP: Record<string, string> = {
  new_enquiry: "NEW_ENQUIRY",
  under_review: "UNDER_REVIEW",
  lawyer_assigned: "LAWYER_ASSIGNED",
  in_progress: "IN_PROGRESS",
  negotiation: "NEGOTIATION",
  payment_pending: "PAYMENT_PENDING",
  completed: "COMPLETED",
  cancelled: "CANCELLED",
};

function parseLagosDate(value: string): Date {
  // Prototype dates look like "2026-11-03 09:12" in Africa/Lagos time.
  return new Date(`${value.replace(" ", "T")}:00+01:00`);
}

/** Download one prototype photo and store it in R2. Returns the public URL. */
async function uploadPhoto(
  propertyId: string,
  photoId: string,
  label: string,
  index: number,
): Promise<{ objectKey: string; url: string } | null> {
  const imageUrl = `https://images.unsplash.com/${photoId}?w=1200&q=75&auto=format&fit=crop`;
  try {
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    const key = buildImageKey(propertyId, "jpg");
    await putObject(key, buffer, "image/jpeg");
    return { objectKey: key, url: publicUrl(key) };
  } catch {
    // Keep the seed going even if a single photo download fails.
    // eslint-disable-next-line no-console
    console.warn(`  photo skipped: ${photoId} (${label} #${index})`);
    return null;
  }
}

// Interior photo labels cycled through for every listing.
const VIEW_LABELS: Array<{ label: string; library: string }> = [
  { label: "Front elevation", library: "__main" },
  { label: "Living room", library: "living" },
  { label: "Kitchen", library: "kitchen" },
  { label: "Bedroom", library: "bedroom" },
];

async function main() {
  // eslint-disable-next-line no-console
  console.log("Seeding ELVICTORIA development data...");

  // ----------------------------------------------------------- cleanup
  // Delete in FK-safe order (children first). ReferenceCounter is re-set
  // below so reference numbers continue after the seed.
  await prisma.$transaction([
    prisma.paymentAttempt.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.caseTimelineEntry.deleteMany(),
    prisma.caseMessage.deleteMany(),
    prisma.contactDisclosure.deleteMany(),
    prisma.case.deleteMany(),
    prisma.enquiryEscalation.deleteMany(),
    prisma.enquiry.deleteMany(),
    prisma.ticketMessage.deleteMany(),
    prisma.ticket.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.savedProperty.deleteMany(),
    prisma.propertyImage.deleteMany(),
    prisma.propertyHistory.deleteMany(),
    prisma.property.deleteMany(),
    prisma.passwordReset.deleteMany(),
    prisma.session.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.setting.deleteMany(),
    prisma.user.deleteMany(),
    prisma.referenceCounter.deleteMany(),
  ]);

  // ------------------------------------------------------------- users
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const userIds = new Map<string, string>();

  for (const u of db.users as Array<Record<string, string | null>>) {
    const role = (u.role as string).toUpperCase() as "LAWYER" | "SUPPORT" | "PROVIDER" | "CLIENT";
    const interest = u.interest ? (u.interest.toUpperCase() as never) : null;
    const created = await prisma.user.create({
      data: {
        name: u.name as string,
        email: u.email as string,
        phone: (u.phone as string) || null,
        passwordHash,
        role,
        status: "ACTIVE",
        providerKind: role === "PROVIDER"
          ? (PROVIDER_KIND_MAP[u.providerKind as string] ?? "OWNER") as never
          : null,
        clientKind: role === "CLIENT" ? ((u.interest === "renting" ? "RENTER" : u.interest === "browsing" ? "BROWSING" : "BUYER") as never) : null,
        interest,
        organisation: (u.organisation as string) || null,
        city: (u.city as string) || null,
        registeredAt: parseLagosDate(u.registeredAt as string),
        lastActiveAt: new Date(),
      },
    });
    userIds.set(u.id as string, created.id);
  }
  // eslint-disable-next-line no-console
  console.log(`  users: ${userIds.size}`);

  // -------------------------------------------------------- properties
  const propertyIds = new Map<string, string>();
  let photoCount = 0;

  for (const p of db.properties as Array<Record<string, unknown>>) {
    const protoRef = String(p.ref);
    const providerId = userIds.get(p.provider as string)!;
    const state = p.state as string;
    const lga = p.lga as string;
    const category = CATEGORY_MAP[p.category as string] ?? "APARTMENT";
    const status = STATUS_MAP[p.status as string] ?? "PENDING_REVIEW";
    const createdAt = parseLagosDate(p.created as string);

    const created = await prisma.property.create({
      data: {
        reference: `ELV-PR-${protoRef}`,
        providerId,
        title: p.title as string,
        category,
        listingType: (p.listingType as string).toUpperCase() as never,
        price: Number(p.price),
        state,
        region: regionFor(state, lga),
        lga,
        area: p.area as string,
        address: p.address as string,
        beds: (p.beds as number) ?? null,
        baths: (p.baths as number) ?? null,
        toilets: (p.toilets as number) ?? null,
        sqm: (p.sqm as number) ?? null,
        parking: (p.parking as number) ?? null,
        furnishing: (p.furnishing as string) || null,
        description: p.description as string,
        features: (p.features as string[]) ?? [],
        status,
        availability: (p.availability === "under_offer"
          ? "UNDER_OFFER"
          : p.availability === "unavailable"
            ? "UNAVAILABLE"
            : "AVAILABLE") as Availability,
        featured: Boolean(p.featured),
        cautionDeposit: (p.cautionDeposit as number) ?? null,
        serviceCharge: (p.serviceCharge as number) ?? null,
        feedback: (p.feedback as string) || null,
        createdAt,
        updatedAt: createdAt,
        history: {
          create: ((p.history as Array<[string, string, string | null]>) ?? []).map(([at, action, note]) => ({
            at: parseLagosDate(at),
            action,
            note: note || null,
          })),
        },
      },
    });
    propertyIds.set(protoRef, created.id);

    // Photos: the prototype's library picks per-category exteriors plus
    // shared interior views. Upload real files to R2.
    const exterior = photoLibrary[p.category as string] ?? photoLibrary.apartment;
    const views: Array<{ photoId: string; label: string }> = [
      { photoId: exterior[Number(protoRef) % exterior.length], label: "Front elevation" },
      { photoId: photoLibrary.living[Number(protoRef) % photoLibrary.living.length], label: "Living room" },
      { photoId: photoLibrary.kitchen[Number(protoRef) % photoLibrary.kitchen.length], label: "Kitchen" },
      { photoId: photoLibrary.bedroom[Number(protoRef) % photoLibrary.bedroom.length], label: "Bedroom" },
    ];
    for (let i = 0; i < views.length; i++) {
      const view = views[i];
      const uploaded = await uploadPhoto(created.id, view.photoId, view.label, i);
      if (!uploaded) continue;
      await prisma.propertyImage.create({
        data: {
          propertyId: created.id,
          objectKey: uploaded.objectKey,
          url: uploaded.url,
          label: view.label,
          sortOrder: i,
          isCover: i === 0,
        },
      });
      photoCount++;
    }
  }
  // eslint-disable-next-line no-console
  console.log(`  properties: ${propertyIds.size}, photos uploaded to R2: ${photoCount}`);

  // ------------------------------------------ enquiries, cases, messages
  const caseIds = new Map<string, string>(); // prototype cs -> Case.id
  const protoCaseToEnquiry = new Map<string, string>(); // c_2001 -> enquiry.id
  let enquiryCount = 0;

  for (const c of db.cases as Array<Record<string, unknown>>) {
    const propertyId = propertyIds.get(String(c.property).replace("p_", ""))!;
    const status = ENQUIRY_STATUS_MAP[c.status as string];
    const submittedAt = parseLagosDate(c.submitted as string);
    const openedAt = c.opened ? parseLagosDate(c.opened as string) : null;
    const cs = c.cs as number | null;

    const enquiry = await prisma.enquiry.create({
      data: {
        reference: `ELV-EQ-${c.eq}`,
        propertyId,
        clientId: userIds.get(c.client as string)!,
        lawyerId: c.lawyer ? userIds.get(c.lawyer as string)! : null,
        status: status as never,
        purpose: (c.purpose as string).toUpperCase() as never,
        contactMethod: (c.contact as string).toUpperCase() as never,
        message: c.message as string,
        submittedAt,
        openedAt,
      },
    });
    enquiryCount++;
    protoCaseToEnquiry.set(c.id as string, enquiry.id);

    if (cs) {
      const kase = await prisma.case.create({
        data: {
          reference: `ELV-CS-${cs}`,
          enquiryId: enquiry.id,
          propertyId,
          clientId: userIds.get(c.client as string)!,
          providerId: userIds.get(c.provider as string)!,
          lawyerId: c.lawyer ? userIds.get(c.lawyer as string)! : null,
          status: status as never,
          openedAt,
          closedAt: c.closed ? parseLagosDate(c.closed as string) : null,
          closingNote: (c.closingNote as string) || null,
        },
      });
      caseIds.set(String(cs), kase.id);

      // Timeline: [at, actorId, label, visibility, note?]
      for (const t of (c.timeline as Array<[string, string, string, string, string?]>) ?? []) {
        await prisma.caseTimelineEntry.create({
          data: {
            caseId: kase.id,
            at: parseLagosDate(t[0]),
            actorId: userIds.get(t[1]) ?? null,
            label: t[2],
            visibility: t[3] === "internal" ? "INTERNAL" : "PARTICIPANTS",
            note: t[4] || null,
          },
        });
      }
      // Threads: [at, thread, authorId, body]
      for (const m of (c.messages as Array<[string, string, string, string]>) ?? []) {
        await prisma.caseMessage.create({
          data: {
            caseId: kase.id,
            at: parseLagosDate(m[0]),
            thread: m[1].toUpperCase() as never,
            authorId: userIds.get(m[2])!,
            body: m[3],
          },
        });
      }
      // Escalations: [at, byId, note]
      for (const e of (c.escalations as Array<[string, string, string]>) ?? []) {
        await prisma.enquiryEscalation.create({
          data: {
            enquiryId: enquiry.id,
            at: parseLagosDate(e[0]),
            byId: userIds.get(e[1])!,
            note: e[2],
          },
        });
      }
    }
  }
  // eslint-disable-next-line no-console
  console.log(`  enquiries: ${enquiryCount}, cases: ${caseIds.size}`);

  // ------------------------------------------------------------
  // Payments reference prototype case ids (c_2004); resolve via cs.
  for (const p of db.payments as Array<Record<string, unknown>>) {
    const protoCaseId = p.caseId as string; // e.g. "c_2004"
    const caseNumber = protoCaseId.replace("c_", "");
    const targetCaseId = caseIds.get(caseNumber);
    if (!targetCaseId) continue;

    const createdAt = parseLagosDate(p.created as string);
    const attempts = ((p.attempts as Array<[string, string, string, string]>) ?? []).map(
      ([at, method, outcome, message], index) => ({
        at: parseLagosDate(at),
        method: (method === "bank_transfer" ? "TRANSFER" : "CARD") as never,
        outcome: (outcome === "pending" ? "INITIATED" : outcome.toUpperCase()) as never,
        message: message || null,
        // Seed processor references mirror the prototype's TXN format.
        processorReference: `TXN${p.ref}${String.fromCharCode(65 + index)}${(Number(p.amount) % 9973).toString(36).toUpperCase()}`,
        processorTxId: outcome === "successful" ? `FLWTEST-${p.ref}-${index + 1}` : null,
      }),
    );
    const paidAt = attempts.find((a) => a.outcome === "SUCCESSFUL")?.at ?? null;

    await prisma.payment.create({
      data: {
        reference: `ELV-PY-${p.ref}`,
        caseId: targetCaseId,
        payerId: userIds.get(p.payer as string)!,
        requestedById: userIds.get(p.by as string)!,
        amount: Number(p.amount),
        description: p.description as string,
        status: (PAYMENT_STATUS_MAP[p.status as string] ??
          (p.status === "pending" ? "AWAITING_PAYMENT" : "OUTSTANDING") ??
          "OUTSTANDING") as never,
        createdAt,
        updatedAt: attempts.at(-1)?.at ?? createdAt,
        dueDate: parseLagosDate(p.due as string),
        paidAt,
        attempts: { create: attempts },
      },
    });
  }
  // eslint-disable-next-line no-console
  console.log(`  payments: ${(db.payments as unknown[]).length}`);

  // ------------------------------------------------------- notifications
  // The prototype stores notification links as prototype ids (c_2006,
  // p_1025). Translate them to the real app routes; leave any link that
  // already looks like an app route untouched.
  const translateLink = (link: string | null): string | null => {
    if (!link) return null;
    if (link.startsWith("/")) return link;
    if (link.startsWith("c_")) {
      const enquiryId = protoCaseToEnquiry.get(link);
      return enquiryId ? `/app/staff/matters/${enquiryId}` : null;
    }
    if (link.startsWith("p_")) {
      const propertyId = propertyIds.get(link.replace("p_", ""));
      return propertyId ? `/app/staff/listings/${propertyId}` : null;
    }
    return null;
  };

  for (const n of db.notifications as Array<Record<string, unknown>>) {
    await prisma.notification.create({
      data: {
        userId: userIds.get(n.userId as string)!,
        category: n.category as string,
        title: n.title as string,
        body: n.body as string,
        link: translateLink((n.link as string) || null),
        createdAt: parseLagosDate(n.at as string),
        readAt: n.read ? parseLagosDate(n.at as string) : null,
      },
    });
  }

  // ----------------------------------------------------- saved properties
  for (const s of db.savedProperties as Array<Record<string, string>>) {
    const propertyId = propertyIds.get(String(s.propertyId).replace("p_", ""))!;
    await prisma.savedProperty.create({
      data: { userId: userIds.get(s.userId as string)!, propertyId, savedAt: parseLagosDate(s.savedAt as string) },
    });
  }

  // ------------------------------------------------------------- tickets
  const TICKET_STATUS_MAP: Record<string, "OPEN" | "RESOLVED"> = {
    open: "OPEN",
    in_progress: "OPEN",
    resolved: "RESOLVED",
  };

  for (const t of db.tickets as Array<Record<string, unknown>>) {
    const messages = (t.messages as Array<Record<string, unknown>>) ?? [];
    await prisma.ticket.create({
      data: {
        reference: `ELV-HD-${t.n}`,
        userId: t.userId ? userIds.get(t.userId as string) ?? null : null,
        name: t.name as string,
        email: t.email as string,
        phone: (t.phone as string) || null,
        category: t.category as string,
        subject: t.subject as string,
        status: TICKET_STATUS_MAP[t.status as string] ?? "OPEN",
        createdAt: messages.length
          ? parseLagosDate(messages[0].at as string)
          : new Date("2026-11-01T09:00:00+01:00"),
        messages: {
          create: messages.map((m) => ({
            at: parseLagosDate(m.at as string),
            authorId: m.authorId ? userIds.get(m.authorId as string) ?? null : null,
            fromStaff: Boolean(m.fromStaff),
            body: m.body as string,
          })),
        },
      },
    });
  }

  // ------------------------------------------------------------ settings
  const settings = (db as Record<string, Record<string, unknown>>).settings;
  for (const [key, value] of Object.entries(settings)) {
    await prisma.setting.create({ data: { key, value: String(value) } });
  }

  // ------------------------------------------------------ counters
  // Continue reference sequences after the seeded records.
  const counters: Array<[string, number]> = [
    ["property", 1027],
    ["enquiry", 4020],
    ["case", 2016],
    ["payment", 3012],
    ["ticket", 5006],
  ];
  for (const [name, value] of counters) {
    await prisma.referenceCounter.create({ data: { name, value } });
  }

  // eslint-disable-next-line no-console
  console.log("Seed complete. Demo password for all accounts: " + DEMO_PASSWORD);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
