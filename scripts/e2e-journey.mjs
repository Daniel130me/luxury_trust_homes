/**
 * ELVICTORIA end-to-end journey verification.
 *
 * Walks the full lawyer-managed transaction through the same origin the
 * browser uses (preview gateway on :81, XTransformPort=3030 → Express):
 *
 *   1. Client discovers a property, saves it, submits an enquiry.
 *   2. RBAC negatives: clients/anonymous accounts must not reach staff APIs.
 *   3. Lawyer triages the enquiry, opens a case, communicates, updates the
 *      status, discloses contact, raises a payment request.
 *   4. Provider sees the case, replies in the provider thread, stays
 *      contact-masked, is blocked from staff-only actions.
 *   5. Client receives notifications, opens the Flutterwave checkout,
 *      reports a bank transfer (wrong amount must be rejected), and the
 *      lawyer confirms the transfer to settle the payment.
 *
 * Run: node scripts/e2e-journey.mjs     (backend + frontend must be running)
 */
import { request as httpRequest } from "node:http";

const GATEWAY_PORT = 3030; // Express behind the preview gateway
const BASE = `http://localhost:81`;
const DEMO_PASSWORD = "Elvictoria123";

const results = [];
let step = 0;

function record(name, pass, detail = "") {
  step += 1;
  results.push({ step, name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${String(step).padStart(2, "0")}  ${name}${detail ? ` — ${detail}` : ""}`);
}

/** Minimal cookie-jar HTTP client speaking the API envelope protocol. */
class Session {
  #cookies = new Map();

  #storeCookies(res) {
    const setCookies = res.headers["set-cookie"] ?? [];
    for (const line of setCookies) {
      const [pair] = line.split(";");
      const idx = pair.indexOf("=");
      if (idx > 0) this.#cookies.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
    }
  }

  #csrf() {
    return this.#cookies.get("ev_csrf") ?? "";
  }

  call(method, path, body) {
    // The gateway picks the backend with the XTransformPort query parameter.
    // GETs may already carry a query string, so join with the right separator.
    const sep = path.includes("?") ? "&" : "?";
    const query = `${sep}XTransformPort=${GATEWAY_PORT}`;
    const payload = body === undefined ? null : JSON.stringify(body);
    return new Promise((resolve, reject) => {
      const req = httpRequest(
        `${BASE}${path}${query}`,
        {
          method,
          headers: {
            "Content-Type": "application/json",
            Cookie: [...this.#cookies].map(([k, v]) => `${k}=${v}`).join("; "),
            // Every mutation carries the CSRF token, even body-less posts.
            ...(method !== "GET" ? { "X-CSRF-Token": this.#csrf() } : {}),
          },
        },
        (res) => {
          this.#storeCookies(res);
          let raw = "";
          res.on("data", (chunk) => (raw += chunk));
          res.on("end", () => {
            let parsed = null;
            try {
              parsed = JSON.parse(raw);
            } catch {
              /* HTML error pages stay unparsed */
            }
            resolve({ status: res.statusCode, json: parsed, raw });
          });
        },
      );
      req.on("error", reject);
      if (payload) req.write(payload);
      req.end();
    });
  }
}

const must = (cond, name, detail = "") => record(name, Boolean(cond), detail);
const expectStatus = (res, status, name) =>
  record(name, res.status === status, `got HTTP ${res.status}${res.json?.error ? ` (${res.json.error.code})` : ""}`);

function expectEnvelope(res, name) {
  const okShape = Boolean(res.json && (res.json.ok === true || (res.json.ok === false && res.json.error?.code)));
  record(name, okShape, `HTTP ${res.status}`);
  return res.json?.data ?? {};
}

const client = new Session();
const lawyer = new Session();
const provider = new Session();
const anon = new Session();

/** Hard stop when a prerequisite object is missing (prevents confusing TypeErrors). */
function requireObj(value, label) {
  if (!value) {
    record(`prerequisite: ${label}`, false, "missing — aborting remaining steps");
    summarize();
    process.exit(1);
  }
  return value;
}

function summarize() {
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.log("FAILED:");
    for (const f of failed) console.log(`  - #${f.step} ${f.name}: ${f.detail}`);
  }
}

// ─────────────────────────────────────────────── Act 1 — client discovers

let res = await client.call("POST", "/api/auth/login", {
  email: "daniel.johnson@mail.example",
  password: DEMO_PASSWORD,
});
expectStatus(res, 200, "Client login");
must(res.json?.data?.user?.role === "CLIENT", "Client role is CLIENT");

res = expectEnvelope(await client.call("GET", "/api/properties?pageSize=12&availability=AVAILABLE"), "Public property catalogue returns seeded listings");
const properties = res.properties ?? [];
must(properties.length >= 5, "Catalogue has listings", `${properties.length} properties`);
// The backend rejects duplicate enquiries (409) — pick a property this client
// has not enquired on yet, mirroring what a first-time user journey needs.
const mine = expectEnvelope(await client.call("GET", "/api/enquiries/mine"), "Client's existing enquiries load");
const enquiredPropertyIds = new Set((mine.enquiries ?? []).map((e) => e.propertyId ?? e.property?.id));
const target = properties.find((p) => p.listingType === "RENT" && !enquiredPropertyIds.has(p.id))
  ?? properties.find((p) => !enquiredPropertyIds.has(p.id));
must(Boolean(target?.id), "Target property chosen (no prior enquiry)", `${target?.reference} ${target?.title}`);

res = expectEnvelope(await client.call("GET", `/api/properties/${target.reference}`), "Property detail loads");
const detailText = JSON.stringify(res.property ?? res);
const providerLeak = /crestfieldhomes\.example|@.*provider|providerPhone|"phone":"/.test(detailText);
must(!providerLeak, "Property detail hides provider contact details", providerLeak ? "LEAKED" : "no contact fields");

res = await client.call("POST", "/api/saved", { propertyId: target.id });
record(res.status === 200 || res.status === 201, "Client saves the property", `HTTP ${res.status}`);
res = expectEnvelope(await client.call("GET", "/api/saved"), "Saved list reflects the new save");
must(JSON.stringify(res).includes(target.id), "Saved list contains target");

res = await client.call("POST", "/api/enquiries", {
  propertyId: target.id,
  purpose: target.listingType === "RENT" ? "RENT" : "PURCHASE",
  contactMethod: "PLATFORM",
  message:
    "I am interested in this property and would like ELVICTORIA to handle the legal verification and the transaction on my behalf.",
});
expectStatus(res, 201, "Client submits enquiry");
const enquiry = requireObj(res.json?.data?.enquiry, "enquiry created");
must(Boolean(enquiry?.id), "Enquiry created with reference", enquiry?.reference ?? "");

// ─────────────────────────────────────────────── Act 2 — RBAC negatives

res = await client.call("GET", "/api/staff/enquiries");
expectStatus(res, 403, "Client blocked from staff enquiry queue");
res = await client.call("POST", "/api/staff/payments", { caseId: "x", amount: 1, description: "nope" });
expectStatus(res, 403, "Client blocked from creating payments");
res = await client.call("GET", "/api/staff/summary");
expectStatus(res, 403, "Client blocked from staff dashboard summary");
res = await anon.call("GET", "/api/users/me");
expectStatus(res, 401, "Anonymous blocked from profile endpoint");
res = await anon.call("POST", "/api/enquiries", { propertyId: target.id, purpose: "RENT", contactMethod: "PLATFORM", message: "Anonymous enquiry attempt that should be rejected outright." });
// CSRF runs before authentication by design — anonymous mutations may hit
// either guard. Both are rejections, so accept 401 or 403 here.
record(res.status === 401 || res.status === 403, "Anonymous blocked from creating enquiries", `got HTTP ${res.status}`);

// ─────────────────────────────────────────────── Act 3 — lawyer manages

res = await lawyer.call("POST", "/api/auth/login", {
  email: "adaeze.okonkwo@elvictoria.example",
  password: DEMO_PASSWORD,
});
expectStatus(res, 200, "Lawyer login");
must(res.json?.data?.user?.role === "LAWYER", "Lawyer role is LAWYER");

res = expectEnvelope(await lawyer.call("GET", `/api/staff/enquiries?search=${encodeURIComponent(enquiry.reference)}`), "Staff enquiry queue searchable");
const found = (res.enquiries ?? []).find((e) => e.id === enquiry.id);
must(Boolean(found), "New enquiry visible to staff");

res = await lawyer.call("POST", `/api/staff/enquiries/${enquiry.id}/assign`, {});
expectStatus(res, 200, "Lawyer assignment accepted");

res = await lawyer.call("POST", `/api/staff/enquiries/${enquiry.id}/open-case`);
expectStatus(res, 201, "Transaction case opened");
const kase = requireObj(res.json?.data?.case, "case opened");
must(Boolean(kase?.id), "Case has id", kase?.reference ?? "");

res = await lawyer.call("POST", `/api/cases/${kase.id}/messages`, { thread: "CLIENT", body: "Welcome — I will run the title verification first and keep you updated here." });
expectStatus(res, 201, "Lawyer posts in client thread");

res = await lawyer.call("PATCH", `/api/cases/${kase.id}/status`, { status: "NEGOTIATION", note: "Terms agreed in principle." });
expectStatus(res, 200, "Case status advanced to NEGOTIATION");

res = await lawyer.call("POST", "/api/staff/payments", {
  caseId: kase.id,
  amount: 250000,
  description: "First year rent + agency fee (E2E verification)",
  dueDate: new Date(Date.now() + 7 * 864e5).toISOString(),
});
expectStatus(res, 201, "Payment request raised");
const payment = requireObj(res.json?.data?.payment, "payment created");
must(Boolean(payment?.id), "Payment has id", payment?.reference ?? "");

res = await lawyer.call("POST", `/api/cases/${kase.id}/disclose`, { party: "provider", note: "Client approved sharing provider details." });
expectStatus(res, 200, "Contact disclosure recorded (provider → client)");

// ─────────────────────────────────────────────── Act 4 — provider side

// Resolve the property's provider from the lawyer's case bundle (staff see
// full contact details), then sign in as that provider.
res = expectEnvelope(await lawyer.call("GET", `/api/cases/${kase.id}`), "Lawyer case bundle loads");
const providerEmail = res.case?.provider?.email;
requireObj(providerEmail, "provider identity resolved from case");
record(true, "Provider identity resolved from case", providerEmail);

res = await provider.call("POST", "/api/auth/login", { email: providerEmail, password: DEMO_PASSWORD });
expectStatus(res, 200, "Provider login");
must(res.json?.data?.user?.role === "PROVIDER", "Provider role is PROVIDER");

res = expectEnvelope(await provider.call("GET", "/api/provider/cases"), "Provider case list loads");
must(JSON.stringify(res).includes(kase.id), "Provider sees the new case");

res = expectEnvelope(await provider.call("GET", `/api/cases/${kase.id}`), "Provider case bundle loads");
const c = res.case ?? {};
must(c.client?.email == null && c.client?.phone == null, "Provider cannot see client contact (masked)");
must(Boolean(c.provider?.email), "Provider sees own contact");

res = await provider.call("POST", `/api/cases/${kase.id}/messages`, { thread: "PROVIDER", body: "Property is still available; inspection can be scheduled this week." });
expectStatus(res, 201, "Provider posts in provider thread");

res = await provider.call("PATCH", `/api/cases/${kase.id}/status`, { status: "COMPLETED" });
expectStatus(res, 403, "Provider blocked from case status changes");

res = expectEnvelope(await provider.call("GET", "/api/notifications"), "Provider notifications load");
must(JSON.stringify(res).includes("Contact details shared with you"), "Disclosure notification delivered to provider");

res = await provider.call("GET", `/api/staff/payments`);
expectStatus(res, 403, "Provider blocked from staff payments");

// ─────────────────────────────────────────────── Act 5 — client pays

res = expectEnvelope(await client.call("GET", "/api/notifications"), "Client notifications load");
const notifText = JSON.stringify(res);
must(notifText.includes(enquiry.id) || notifText.includes("case"), "Client sees case notifications");
must(notifText.includes("payment") || notifText.includes("Payment"), "Client sees payment notification");

res = expectEnvelope(await client.call("GET", "/api/client/payments"), "Client payment list loads");
const myPayment = (res.payments ?? []).find((p) => p.id === payment.id);
must(Boolean(myPayment), "New payment request visible to client", myPayment?.status ?? "");

res = await client.call("POST", `/api/client/payments/${payment.id}/pay`);
record(res.status === 200 && Boolean(res.json?.data?.link), "Flutterwave test checkout link issued", res.json?.data?.link ? "hosted link" : `HTTP ${res.status}`);

res = await client.call("POST", `/api/client/payments/${payment.id}/transfer`, { amount: 999, note: "wrong amount" });
expectStatus(res, 400, "Transfer amount guard rejects wrong amount");

res = await client.call("POST", `/api/client/payments/${payment.id}/transfer`, { note: "Transfer sent from GTB ****4321." });
expectStatus(res, 200, "Client reports bank transfer");
must(res.json?.data?.status === "PENDING_CONFIRMATION", "Payment awaits lawyer confirmation", res.json?.data?.status ?? "");

// A client must not be able to confirm their own transfer — the confirm
// endpoint lives under /staff/payments and requires payment.manage.
res = await client.call("POST", `/api/staff/payments/${payment.id}/confirm-transfer`);
expectStatus(res, 403, "Client cannot self-confirm the transfer");

res = await lawyer.call("POST", `/api/staff/payments/${payment.id}/confirm-transfer`);
expectStatus(res, 200, "Lawyer confirms the transfer");
const finalStatus = res.json?.data?.status ?? res.json?.data?.payment?.status;
must(finalStatus === "SUCCESSFUL", "Payment settled as SUCCESSFUL", finalStatus ?? "");

res = expectEnvelope(await client.call("GET", `/api/client/payments/${payment.id}`), "Client sees settled payment");
must((res.payment?.status ?? "") === "SUCCESSFUL", "Payment status is SUCCESSFUL for client");

// ─────────────────────────────────────────────── summary

summarize();
if (results.some((r) => !r.pass)) process.exit(1);
