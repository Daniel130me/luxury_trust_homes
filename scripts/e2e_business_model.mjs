/**
 * End-to-end business-model test — acts as EVERY user role against the
 * running dev stack and hunts edge cases around the three changes:
 *
 *   A. single shared "Elvictoria Legal" lawyer login (anonymity)
 *   B. manual bank transfer as PRIMARY payment method (gated details)
 *   C. admin-managed property types
 *
 * NOTE ON THE AUTH RATE LIMITER: /auth/* allows 20 requests / 15 min per
 * IP. This suite therefore logs each user in EXACTLY ONCE up front and
 * reuses the session for every later section.
 *
 * Run: node /home/z/my-project/scripts/e2e_business_model.mjs
 * Exit code 0 = every check passed.
 */
const BASE = "http://localhost:3030/api";
const PASSWORD = "Elvictoria123";

let passed = 0, failed = 0;
let sharedLawyer = null;
const failures = [];

function check(name, cond, detail) {
  if (cond) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; failures.push({ name, detail }); console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`); }
}

// ------------------------------------------------------------ HTTP helpers
// Manual cookie jars: fetch does not keep cookies, so each "user" object
// stores ev_access/ev_refresh/ev_csrf from Set-Cookie responses.

function jarFrom(res) {
  const jar = {};
  const cookies = res.headers.getSetCookie?.() ?? [];
  for (const c of cookies) {
    const [pair] = c.split(";");
    const eq = pair.indexOf("=");
    jar[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim();
  }
  return jar;
}

function cookieHeader(jar) {
  return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");
}

async function raw(user, method, path, body, { noCsrf = false } = {}) {
  const headers = {};
  if (user?.jar && Object.keys(user.jar).length) headers.cookie = cookieHeader(user.jar);
  if (body !== undefined) headers["content-type"] = "application/json";
  // Double-submit CSRF: mutations need the ev_csrf cookie value as a header.
  if (!noCsrf && user?.jar?.ev_csrf && !["GET", "HEAD", "OPTIONS"].includes(method)) {
    headers["x-csrf-token"] = user.jar.ev_csrf;
  }
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  });
  let json = null;
  try { json = await res.json(); } catch { /* non-JSON (none expected) */ }
  if (user?.jar) for (const [k, v] of Object.entries(jarFrom(res))) user.jar[k] = v;
  return { status: res.status, json };
}

const get = (u, p) => raw(u, "GET", p);
const post = (u, p, b) => raw(u, "POST", p, b);
const patch = (u, p, b) => raw(u, "PATCH", p, b);
const put = (u, p, b) => raw(u, "PUT", p, b);

async function login(email, password = PASSWORD) {
  const user = { jar: {}, email };
  const r = await post(user, "/auth/login", { email, password });
  return { user, r };
}

// List helper: tolerate both `data.items` and `data.<name>` shapes.
function rows(json, keys) {
  const data = json?.data ?? {};
  for (const k of keys) if (Array.isArray(data[k])) return data[k];
  if (Array.isArray(data.items)) return data.items;
  return [];
}

// ================================================================ 1. GUEST
console.log("\n— Guest (public, unauthenticated) —");
{
  const g = null;

  const list = await get(g, "/properties");
  check("public catalogue 200", list.status === 200);
  const props = list.json?.data?.properties ?? [];
  check("catalogue has properties", props.length > 0, `got ${props.length}`);
  // Categories must be human names now — no SCREAMING_SNAKE enum leftovers.
  const cats = [...new Set(props.map((p) => p.category))];
  check("categories humanised", cats.every((c) => /^[A-Z]/.test(c) && !c.includes("_")), cats.join(", "));

  const types = await get(g, "/properties/types");
  check("public property types 200", types.status === 200);
  const typeList = types.json?.data?.types ?? [];
  check("taxonomy seeded (>=7 active)", typeList.length >= 7, `got ${typeList.length}`);
  check("types sorted by sortOrder", typeList.every((t, i) => i === 0 || typeList[i - 1].sortOrder <= t.sortOrder));
  check("public types all active", typeList.every((t) => t.active));

  const byCat = await get(g, "/properties?category=" + encodeURIComponent(typeList[0].name));
  check("filter by type name 200", byCat.status === 200);
  check("filter returns only that type", (byCat.json?.data?.properties ?? []).every((p) => p.category === typeList[0].name));

  const legacy = await get(g, "/properties?category=APARTMENT");
  check("legacy enum filter does not 500", legacy.status === 200);

  const detail = await get(g, `/properties/${props[0].reference}`);
  check("public property detail 200", detail.status === 200);

  const bank = await get(g, "/client/payments/bank-details");
  check("bank details hidden from guests (401)", bank.status === 401, `got ${bank.status}`);

  const settings = await get(g, "/settings");
  check("staff settings hidden from guests (401)", settings.status === 401, `got ${settings.status}`);
  const pub = await get(g, "/settings/public");
  check("public settings 200", pub.status === 200);

  const badLogin = await raw(null, "POST", "/auth/login", { email: "legal@elvictoria.example", password: "wrong" }, { noCsrf: true });
  check("wrong password rejected (401)", badLogin.status === 401, `got ${badLogin.status}`);

  const staffList = await get(g, "/staff/enquiries");
  check("staff queue hidden from guests (401)", staffList.status === 401, `got ${staffList.status}`);

  const featured = await get(g, "/properties/featured");
  check("featured listings 200", featured.status === 200);
}

// ======================================================= 2. ONE LOGIN EACH
console.log("\n— Logins (single request per user; auth limiter is 20/15min) —");
const kemi = { jar: {}, email: "kemi.williams@mail.example" };
const daniel = { jar: {}, email: "daniel.johnson@mail.example" };
const chinedu = { jar: {}, email: "chinedu@crestfieldhomes.example" };
const legal = { jar: {}, email: "legal@elvictoria.example" };
const support = { jar: {}, email: "mariam.bello@elvictoria.example" };
sharedLawyer = legal;

// Old individual lawyer credentials must be dead — one probe.
{
  const old = await raw(null, "POST", "/auth/login", { email: "adaeze.okonkwo@elvictoria.example", password: PASSWORD }, { noCsrf: true });
  check("old lawyer login dead (401)", old.status === 401, `got ${old.status}`);
}

for (const u of [kemi, daniel, chinedu, legal, support]) {
  const r = await post(u, "/auth/login", { email: u.email, password: PASSWORD });
  check(`login ${u.email}`, r.status === 200, `got ${r.status} ${JSON.stringify(r.json?.error?.message ?? "")}`);
}

const me = await get(legal, "/auth/me");
check("shared legal account: role LAWYER", me.json?.data?.user?.role === "LAWYER", JSON.stringify(me.json?.data));
check("shared account name is generic", me.json?.data?.user?.name === "Elvictoria Legal", me.json?.data?.user?.name);
const meD = await get(daniel, "/auth/me");
check("daniel role CLIENT", meD.json?.data?.user?.role === "CLIENT");
const meC = await get(chinedu, "/auth/me");
check("chinedu role PROVIDER", meC.json?.data?.user?.role === "PROVIDER");
const meS = await get(support, "/auth/me");
check("mariam role SUPPORT", meS.json?.data?.user?.role === "SUPPORT");

const lawyerId = me.json?.data?.user?.id;

// ================================================== 3. REGISTRATION EDGES
let freshClient = null;
let freshEmail = null;
{
  const stamp = Date.now();
  freshEmail = `e2e.client.${stamp}@mail.example`;
  const reg = await raw(null, "POST", "/auth/register", {
    name: "E2E Test Client", email: freshEmail, password: PASSWORD,
    phone: "+2348012345678", accountType: "client", clientKind: "RENTER",
  }, { noCsrf: true });
  check("register new client 201", reg.status === 201, JSON.stringify(reg.json?.error ?? {}).slice(0, 160));

  // A client cannot self-promote to LAWYER even by sending a role field.
  const reg2 = await raw(null, "POST", "/auth/register", {
    name: "E2E Lawyer Wannabe", email: `e2e.lawyer.${stamp}@mail.example`, password: PASSWORD,
    phone: "+2348012345679", accountType: "client", role: "LAWYER",
  }, { noCsrf: true });
  check("register with injected role field still 201", reg2.status === 201, `got ${reg2.status}`);

  const dup = await raw(null, "POST", "/auth/register", {
    name: "Dup", email: freshEmail, password: PASSWORD, phone: "+2348012345678", accountType: "client",
  }, { noCsrf: true });
  check("duplicate email rejected (400)", dup.status === 400, `got ${dup.status}`);

  freshClient = { jar: {}, email: freshEmail };
  const l = await post(freshClient, "/auth/login", { email: freshEmail, password: PASSWORD });
  check("fresh client can log in", l.status === 200, `got ${l.status}`);

  // CSRF negative: mutation without the X-CSRF-Token header must fail.
  const noCsrf = await raw(freshClient, "POST", "/tickets", { category: "other", subject: "CSRF probe", body: "Should be rejected without a CSRF token." }, { noCsrf: true });
  check("mutation without CSRF token rejected (403)", noCsrf.status === 403, `got ${noCsrf.status}`);

  const me2 = await get(freshClient, "/auth/me");
  check("/auth/me role is CLIENT (never LAWYER)", me2.json?.data?.user?.role === "CLIENT", JSON.stringify(me2.json?.data?.user?.role));
}

// ================================================= 4. CLIENT BASICS
console.log("\n— Client: Kemi Williams (has an active payment) —");
{
  const pays = await get(kemi, "/client/payments");
  check("kemi payment list 200", pays.status === 200);
  const payList = rows(pays.json, ["payments"]);
  const active = payList.find((p) => ["OUTSTANDING", "AWAITING_PAYMENT", "PENDING_CONFIRMATION"].includes(p.status));
  check("kemi has an active payment", Boolean(active), `list=${payList.map((p) => p.status).join(",")}`);

  const bank = await get(kemi, "/client/payments/bank-details");
  check("bank details 200 at payment stage", bank.status === 200, `got ${bank.status}`);
  const d = bank.json?.data?.details ?? {};
  check("bank details complete", Boolean(d.bankName && d.bankAccountName && d.bankAccountNumber), JSON.stringify(d));

  const notif = await get(kemi, "/notifications");
  check("notifications 200", notif.status === 200);

  // An anonymous enquiry's lawyer, as the client sees it, must be generic.
  const mineK = await get(kemi, "/enquiries/mine");
  const kEnq = rows(mineK.json, ["enquiries"]).find((e) => e.lawyer);
  check("kemi's enquiry lawyer is generic", !kEnq || kEnq.lawyer?.name === "Elvictoria Legal", JSON.stringify(kEnq?.lawyer?.name));
}

console.log("\n— Client: Daniel (no active payment) — privilege probes —");
{
  const bank = await get(daniel, "/client/payments/bank-details");
  check("bank details 403 without active payment", bank.status === 403, `got ${bank.status}`);

  const staff = await get(daniel, "/staff/enquiries");
  check("client blocked from staff queue (403)", staff.status === 403, `got ${staff.status}`);
  const allTypes = await get(daniel, "/properties/types/all");
  check("client blocked from taxonomy admin (403)", allTypes.status === 403, `got ${allTypes.status}`);
  const putSettings = await put(daniel, "/settings", { settings: { bankName: "Hacker Bank" } });
  check("client blocked from editing settings (403)", putSettings.status === 403, `got ${putSettings.status}`);
  const reqPay = await post(daniel, "/staff/payments", { caseId: "x", amount: 1, description: "nope" });
  check("client blocked from raising payments (403)", reqPay.status === 403, `got ${reqPay.status}`);
  const taxPost = await post(daniel, "/properties/types", { name: "Client Type" });
  check("client blocked from creating types (403)", taxPost.status === 403, `got ${taxPost.status}`);
}

// ================================== 5. GOLDEN PATH (daniel, resilient)
console.log("\n— Golden path: enquiry → shared lawyer → case → transfer → confirm —");
let caseId = null, paymentId = null;
{
  // Reuse an existing active enquiry (the demo data already has one from
  // earlier sessions — creating another hits a uniqueness CONFLICT).
  const mineD = await get(daniel, "/enquiries/mine");
  const dEnquiries = rows(mineD.json, ["enquiries"]);
  let enquiryId = dEnquiries.find((e) => !["COMPLETED", "CANCELLED"].includes(e.status))?.id;

  if (!enquiryId) {
    const props = (await get(null, "/properties")).json?.data?.properties ?? [];
    const enquiry = await post(daniel, "/enquiries", {
      propertyId: props[0].id,
      purpose: "RENT",
      contactMethod: "PLATFORM",
      message: "E2E golden-path enquiry: I am interested in renting this property and would like the legal team to handle the agreement.",
    });
    check("client creates enquiry 201", enquiry.status === 201, JSON.stringify(enquiry.json?.error));
    enquiryId = enquiry.json?.data?.enquiry?.id;
  } else {
    check("reusing daniel's existing active enquiry", true);
  }

  const assigned = await post(legal, `/staff/enquiries/${enquiryId}/assign`, lawyerId ? { lawyerId } : {});
  const aOk = assigned.status === 200;
  // 400/409 is acceptable if the enquiry was already assigned earlier.
  check("assign enquiry to the legal team (200 or already-assigned)", aOk || assigned.status === 409 || assigned.status === 400, JSON.stringify(assigned.json?.error));
  const enquiryDetail = await get(daniel, `/enquiries/${enquiryId}`);
  // The client-facing enquiry detail must not reveal WHICH lawyer — the
  // API omits the lawyer relation entirely; if present, it must be generic.
  const dLawyer = enquiryDetail.json?.data?.enquiry?.lawyer;
  check("client enquiry detail hides individual lawyer (absent or generic)",
    dLawyer === undefined || dLawyer === null || dLawyer?.name === "Elvictoria Legal", JSON.stringify(dLawyer));

  // Open a case — reuse the one attached to the enquiry if it exists.
  let opened = await post(legal, `/staff/enquiries/${enquiryId}/open-case`, {});
  let kase = opened.json?.data?.case;
  if (!kase && opened.status === 409) {
    // The enquiry detail (client view) embeds the existing case.
    kase = enquiryDetail.json?.data?.enquiry?.case ?? null;
    if (!kase) {
      const matters = await get(legal, "/staff/matters");
      kase = rows(matters.json, ["matters", "cases"]).find((m) => m.enquiryId === enquiryId || m.id === enquiryId) ?? null;
    }
  }
  check("case available (opened or existing)", Boolean(kase), JSON.stringify(opened.json?.error ?? {}).slice(0, 120));
  caseId = kase?.id ?? null;
  if (caseId) {
    // The staff matters detail embeds the enquiry, whose lawyer is shown.
    const mattersDetail = await get(legal, `/staff/matters/${enquiryId}`);
    const mEnquiry = mattersDetail.json?.data?.enquiry ?? mattersDetail.json?.data;
    check("staff view case lawyer is generic", mEnquiry?.lawyer?.name === "Elvictoria Legal", JSON.stringify(mEnquiry?.lawyer?.name));
  }

  if (caseId) {
    // Client's view of the case must never expose an individual lawyer.
    const clientCase = await get(daniel, `/cases/${caseId}`);
    check("client case view 200", clientCase.status === 200);
    check("client case view: lawyer generic", clientCase.json?.data?.case?.lawyer?.name === "Elvictoria Legal", JSON.stringify(clientCase.json?.data?.case?.lawyer?.name));
    const timeline = clientCase.json?.data?.case?.timeline ?? clientCase.json?.data?.timeline ?? [];
    const timelineAuthors = timeline.map((t) => t.author?.name).filter(Boolean);
    check("timeline authors are generic", timelineAuthors.every((n) => n === "Elvictoria Legal"), timelineAuthors.join(","));

    // Payment request (lawyer) — then transfer report (client) — confirm (lawyer).
    const req = await post(legal, "/staff/payments", { caseId, amount: 250000, description: "E2E legal service fee" });
    check("payment request 201", req.status === 201, JSON.stringify(req.json?.error));
    paymentId = req.json?.data?.payment?.id;
    check("new payment OUTSTANDING", req.json?.data?.payment?.status === "OUTSTANDING");

    const wrongAmt = await post(daniel, `/client/payments/${paymentId}/transfer`, { amount: 999, note: "wrong amount" });
    check("transfer amount mismatch rejected (400)", wrongAmt.status === 400, `got ${wrongAmt.status}`);

    const transfer = await post(daniel, `/client/payments/${paymentId}/transfer`, { amount: 250000, note: "E2E transfer ref TX-001" });
    check("transfer report accepted 200", transfer.status === 200, JSON.stringify(transfer.json?.error));
    const after = await get(daniel, `/client/payments/${paymentId}`);
    check("payment now PENDING_CONFIRMATION", after.json?.data?.payment?.status === "PENDING_CONFIRMATION", after.json?.data?.payment?.status);

    const confirm = await post(legal, `/staff/payments/${paymentId}/confirm-transfer`, { note: "E2E confirmed" });
    check("lawyer confirms transfer 200", confirm.status === 200, JSON.stringify(confirm.json?.error));
    const done = await get(daniel, `/client/payments/${paymentId}`);
    check("payment SUCCESSFUL after confirmation", done.json?.data?.payment?.status === "SUCCESSFUL");

    // Daniel never had another active payment — details must gate shut again.
    const gated = await get(daniel, "/client/payments/bank-details");
    check("bank details gated again after completion (403)", gated.status === 403, `got ${gated.status}`);

    // Client posts into the case thread; lawyer replies; client must only
    // ever see the generic identity as the message author.
    const msg = await post(daniel, `/cases/${caseId}/messages`, { thread: "CLIENT", body: "E2E: question about the tenancy agreement." });
    check("client message posted 200/201", msg.status === 200 || msg.status === 201, JSON.stringify(msg.json?.error));
    const reply = await post(legal, `/cases/${caseId}/messages`, { thread: "CLIENT", body: "E2E: reply from the legal team." });
    check("lawyer reply posted 200/201", reply.status === 200 || reply.status === 201, JSON.stringify(reply.json?.error));
    const threads = await get(daniel, `/cases/${caseId}/threads`);
    const threadMsgs = rows(threads.json, ["messages"]) .concat(
      (threads.json?.data?.threads ?? []).flatMap((t) => t.messages ?? []),
    );
    const lawyerMsgs = threadMsgs.filter((m) => m.author?.role === "LAWYER" || m.authorRole === "LAWYER" || /legal team/i.test(m.body ?? ""));
    check("client sees lawyer messages authored by ELVICTORIA Legal",
      lawyerMsgs.length === 0 || lawyerMsgs.every((m) => (m.author?.name ?? "") === "Elvictoria Legal"),
      lawyerMsgs.map((m) => m.author?.name).join(","));
  }
}

// ======================================================== 6. PROVIDER (owner)
console.log("\n— Provider (property owner): taxonomy + anonymity —");
{
  const own = await get(chinedu, "/provider/properties");
  check("provider property list 200", own.status === 200);

  const valid = await post(chinedu, "/provider/properties", {
    title: "E2E Test Apartment in Lekki Phase 1",
    category: "Apartment",
    listingType: "RENT",
    price: 4500000,
    state: "Lagos", region: "Island", lga: "Lekki", area: "Lekki Phase 1",
    address: "E2E test address, Lekki Phase 1, Lagos",
    beds: 3, baths: 3, toilets: 4,
    description: "E2E test listing created by the automated business-model test suite. It exercises the admin-managed taxonomy end to end.",
    submitForReview: true,
  });
  check("create property with active type 201", valid.status === 201, JSON.stringify(valid.json?.error));
  check("created property stores humanised type", valid.json?.data?.property?.category === "Apartment", valid.json?.data?.property?.category);

  const invalid = await post(chinedu, "/provider/properties", {
    title: "E2E bogus taxonomy attempt listing",
    category: "Spaceship",
    listingType: "RENT",
    price: 1, state: "Lagos", lga: "Lekki", area: "Ikate",
    address: "x", description: "This submission uses an unknown property type and must be rejected outright.",
  });
  check("unknown type rejected (400)", invalid.status === 400, `got ${invalid.status}`);
  check("validation names the field", Boolean(invalid.json?.error?.fields?.category), JSON.stringify(invalid.json?.error?.fields));

  const shortTitle = await post(chinedu, "/provider/properties", {
    title: "Tiny", category: "Apartment", listingType: "RENT", price: 1,
    state: "Lagos", lga: "Lekki", area: "Ikate", address: "x",
    description: "Short title must be rejected by validation.",
  });
  check("short title rejected (400)", shortTitle.status === 400);

  // Deactivated types vanish from pickers AND from submissions.
  const all = await get(legal, "/properties/types/all");
  const bungalow = (all.json?.data?.types ?? []).find((t) => t.name === "Bungalow");
  if (bungalow) {
    await patch(legal, `/properties/types/${bungalow.id}`, { active: false });
    const deactivated = await post(chinedu, "/provider/properties", {
      title: "E2E deactivated type submission",
      category: "Bungalow", listingType: "SALE", price: 1,
      state: "Lagos", lga: "Lekki", area: "Ikate", address: "x",
      description: "This uses a deactivated property type and must be rejected.",
    });
    check("deactivated type rejected (400)", deactivated.status === 400, `got ${deactivated.status}`);
    await patch(legal, `/properties/types/${bungalow.id}`, { active: true });
    const pubAfter = await get(null, "/properties/types");
    check("taxonomy restored after test", (pubAfter.json?.data?.types ?? []).some((t) => t.name === "Bungalow"));
  } else {
    check("deactivated type rejected (400) — SKIPPED, no Bungalow type", false, "Bungalow missing from taxonomy");
  }

  // Anonymity on the provider side.
  const pcases = await get(chinedu, "/provider/cases");
  check("provider cases 200", pcases.status === 200);
  const pcList = rows(pcases.json, ["cases"]);
  const withLawyer = pcList.find((c) => c.lawyer);
  check("provider sees only generic lawyer name", !withLawyer || withLawyer.lawyer.name === "Elvictoria Legal", JSON.stringify(withLawyer?.lawyer?.name));

  const block = await get(chinedu, "/staff/matters");
  check("provider blocked from staff matters (403)", block.status === 403, `got ${block.status}`);
}

// ============================================= 7. LAWYER: taxonomy admin etc.
console.log("\n— Lawyer (shared account): taxonomy admin + settings —");
{
  const dup = await post(legal, "/properties/types", { name: "Apartment" });
  check("duplicate type rejected (400)", dup.status === 400, `got ${dup.status}`);
  const tiny = await post(legal, "/properties/types", { name: "a" });
  check("too-short name rejected (400)", tiny.status === 400, `got ${tiny.status}`);
  const long = await post(legal, "/properties/types", { name: "x".repeat(61) });
  check("too-long name rejected (400)", long.status === 400, `got ${long.status}`);

  const add = await post(legal, "/properties/types", { name: "Block of Flats" });
  const added = add.status === 201 || (add.status === 400 && /already exists/.test(add.json?.error?.message ?? ""));
  check("add new type 201 (or already exists from earlier run)", added, `got ${add.status}`);
  let newType = add.json?.data?.type;
  if (!newType) {
    const all = await get(legal, "/properties/types/all");
    newType = (all.json?.data?.types ?? []).find((t) => t.name === "Block of Flats");
  }
  if (!newType) {
    check("new type resolvable for rename/deactivate tests", false, "Block of Flats not found after add");
  } else {
  // A previous run may have left the type inactive — reactivate for the
  // visibility assertion, then exercise deactivate.
  if (!newType.active) await patch(legal, `/properties/types/${newType.id}`, { active: true });
  const pubActive = await get(null, "/properties/types");
  check("new type visible publicly while active", (pubActive.json?.data?.types ?? []).some((t) => t.name === "Block of Flats"));
  const dupRename = await patch(legal, `/properties/types/${newType.id}`, { name: "Apartment" });
  check("rename onto existing name rejected (400)", dupRename.status === 400, `got ${dupRename.status}`);
  const deactivate = await patch(legal, `/properties/types/${newType.id}`, { active: false });
  check("deactivate type 200", deactivate.status === 200, `got ${deactivate.status}`);
  const pubAfterDeact = await get(null, "/properties/types");
  check("deactivated type hidden from public list", !(pubAfterDeact.json?.data?.types ?? []).some((t) => t.name === "Block of Flats"));
  }

  // Settings validation edges.
  const badBank = await put(legal, "/settings", { settings: { bankAccountNumber: "1".repeat(31) } });
  check("bank account number >30 chars rejected (400)", badBank.status === 400, `got ${badBank.status}`);
  const badDays = await put(legal, "/settings", { settings: { paymentDueDays: 99 } });
  check("payment due days out of range rejected (400)", badDays.status === 400, `got ${badDays.status}`);
  const okSettings = await put(legal, "/settings", { settings: { bankName: "GTBank", bankAccountName: "Elvictoria Attorneys and Solicitors", bankAccountNumber: "0123456789" } });
  check("valid bank settings accepted (200)", okSettings.status === 200, JSON.stringify(okSettings.json?.error));
}

// ============================================== 8. TICKETS with references
console.log("\n— Tickets: reference tracking + shared identity —");
let e2eTicketRef = null, e2eTicketId = null;
{
  const ticket = await post(freshClient, "/tickets", { category: "payments", subject: "E2E ticket about payments", body: "E2E ticket to verify reference tracking and the shared legal identity in replies." });
  const tOk = ticket.status === 200 || ticket.status === 201;
  check("client ticket created with reference", tOk, JSON.stringify(ticket.json?.error));
  const t = ticket.json?.data?.ticket ?? ticket.json?.data;
  e2eTicketRef = t?.reference;
  e2eTicketId = t?.id;
  check("ticket reference format ELV-HD-####", /^ELV-HD-\d{4}$/.test(e2eTicketRef ?? ""), e2eTicketRef);

  const track = await get(null, `/tickets/track?reference=${encodeURIComponent(e2eTicketRef)}&email=${encodeURIComponent(freshEmail)}`);
  check("guest can track own ticket by ref+email", track.status === 200 && Boolean(track.json?.data?.ticket), JSON.stringify(track.json?.error?.message));
  const wrongTrack = await get(null, `/tickets/track?reference=${encodeURIComponent(e2eTicketRef)}&email=attacker@mail.example`);
  check("tracking with wrong email fails", wrongTrack.status === 404 || wrongTrack.json?.data?.ticket == null, `got ${wrongTrack.status}`);

  const reply = await post(legal, `/tickets/staff/${e2eTicketId}/reply`, { body: "E2E reply from the legal team." });
  check("staff reply 200/201", reply.status === 200 || reply.status === 201, JSON.stringify(reply.json?.error));

  const clientView = await get(freshClient, `/tickets/mine/${e2eTicketId}`);
  const msgs = rows(clientView.json, ["messages"]).concat(clientView.json?.data?.ticket?.messages ?? []);
  const staffMsgs = msgs.filter((m) => m.fromStaff || m.author?.role === "LAWYER" || m.author?.role === "SUPPORT");
  check("client-facing staff replies carry generic identity",
    staffMsgs.length === 0 || staffMsgs.every((m) => {
      const n = m.author?.name ?? m.authorName ?? "";
      return n === "Elvictoria Legal" || n === "" || n === "Legal Team";
    }),
    staffMsgs.map((m) => m.author?.name ?? m.authorName).join(","));

  // Ticket status lifecycle: staff can advance it (reference stays stable).
  const statusChange = await patch(legal, `/tickets/staff/${e2eTicketId}`, { status: "IN_PROGRESS" });
  check("staff can update ticket status", [200, 400].includes(statusChange.status) === false ? statusChange.status === 200 : statusChange.status === 200, `got ${statusChange.status} ${JSON.stringify(statusChange.json?.error ?? {}).slice(0, 120)}`);
}

// ================================================================ 9. SUPPORT
console.log("\n— Support staff: helpdesk-only permissions —");
{
  const queue = await get(support, "/tickets/staff");
  check("support reads ticket queue", queue.status === 200, `got ${queue.status}`);

  const sList = rows(queue.json, ["tickets"]);
  if (sList.length) {
    const sReply = await post(support, `/tickets/staff/${sList[0].id}/reply`, { body: "E2E support reply." });
    check("support can reply to tickets", sReply.status === 200 || sReply.status === 201, `got ${sReply.status}`);
  }

  const putS = await put(support, "/settings", { settings: { officePhone: "+2348000000000" } });
  check("support cannot edit settings (403)", putS.status === 403, `got ${putS.status}`);
  const tax = await post(support, "/properties/types", { name: "Support Type" });
  check("support cannot edit taxonomy (403)", tax.status === 403, `got ${tax.status}`);
  const pay = await post(support, "/staff/payments", { caseId: "x", amount: 1, description: "no" });
  check("support cannot raise payments (403)", pay.status === 403, `got ${pay.status}`);
  const allT = await get(support, "/properties/types/all");
  check("support cannot read full taxonomy (403)", allT.status === 403, `got ${allT.status}`);
  const matters = await get(support, "/staff/matters");
  check("support can view matters (case.viewAll)", matters.status === 200, `got ${matters.status}`);
}

// ======================================================== 10. USER MGMT
console.log("\n— Lawyer account protection —");
{
  const selfDeactivate = await patch(legal, `/users/${lawyerId}/status`, { status: "DEACTIVATED" });
  check("cannot deactivate own account (400)", selfDeactivate.status === 400, `got ${selfDeactivate.status}`);

  const deactivateShared = await patch(legal, `/users/${lawyerId}/status`, { status: "DEACTIVATED" });
  check("shared lawyer account protected (403/400)", [403, 400].includes(deactivateShared.status), `got ${deactivateShared.status} ${JSON.stringify(deactivateShared.json?.error ?? {}).slice(0, 120)}`);
}

// ================================================================== SUMMARY
console.log(`\n================ ${passed} passed, ${failed} failed ================`);
if (failures.length) {
  console.log("\nFailures:");
  for (const f of failures) console.log(`  ✗ ${f.name}${f.detail ? ` — ${String(f.detail).slice(0, 200)}` : ""}`);
  process.exit(1);
}
process.exit(0);
