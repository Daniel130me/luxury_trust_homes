# ELVICTORIA — lawyer-managed real-estate transactions

Full-stack platform for the Nigerian property market where **authorised
lawyers manage every buyer/tenant transaction**: clients discover listings,
submit enquiries, and work through a lawyer-led case (verification →
negotiation → payment) with the property provider. Provider contact details
stay hidden until a lawyer explicitly authorises a disclosure.

Built from the reviewed HTML prototype (`upload/elvictoria_with_photos.html`)
— UI, layout, flows and role structure are preserved 1:1; the prototype's
in-memory demo data became real PostgreSQL records.

---

## Architecture

Two independent applications, one per concern. **Express is the sole
authoritative backend** — the Next.js app contains no API routes and no
server actions; all business logic, permission checks and payment
verification live behind the Express API.

| | Backend | Frontend |
|---|---|---|
| Stack | Node.js + Express 5 + TypeScript | Next.js 16 + React 19 + TypeScript + Tailwind 4 |
| Data | Prisma ORM → **Neon PostgreSQL** | Reads/writes via the REST API only |
| Files | **Cloudflare R2** (S3 API) | Renders R2 public URLs |
| Payments | **Flutterwave v3** (test keys) | Opens hosted checkout, polls status |
| Auth | HTTP-only session cookie (JWT access + refresh) + CSRF double-submit | Sends credentials, attaches CSRF header |

```
elvictoria/
├── backend/                  ← Express API (independent npm project)
│   ├── prisma/               ← schema, migrations, seed data
│   ├── scripts/seed.ts       ← repeatable dev seed (uploads photos to R2)
│   ├── src/
│   │   ├── config/env.ts     ← zod-validated environment (fails fast at boot)
│   │   ├── middleware/       ← auth, CSRF, rate limit, validation, errors
│   │   ├── modules/          ← auth, users, properties, enquiries, payments,
│   │   │                       uploads, notifications, tickets, admin
│   │   ├── lib/              ← prisma, r2, flutterwave, permissions, notify
│   │   └── routes/index.ts   ← mounts every module under /api
│   └── tests/                ← vitest: permissions, payment guards, references
└── README.md
```

### Frontend location (documented deviation)

The requested layout is `elvictoria/frontend/` + `elvictoria/backend/`.
The backend matches it exactly. The **frontend lives at the workspace root**
(`package.json` name: `elvictoria-frontend`, sources in `src/`) because this
project is developed inside a preview sandbox whose build/deploy pipeline
(`.zscripts/build.sh`) hard-requires the Next.js app at the root — it builds
`.next/standalone` from the root `next.config.ts` and health-checks port 3000.
Moving it would break previewing and deployment.

The two apps remain fully independent: separate `package.json`, dependency
trees, environment variables and build commands; the root `db:*` scripts
merely delegate to `elvictoria/backend`. For self-hosting, move `src/`,
`public/`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`,
`tsconfig.json`, `components.json` and the frontend deps into
`elvictoria/frontend/` unchanged — nothing in the code assumes the root.

### Request flow

```
browser → Caddy :81 (preview gateway)
            ├── XTransformPort=3030  → Express API  (same-origin, cookies work)
            └── else                 → Next.js :3000
Outside the sandbox: set NEXT_PUBLIC_API_BASE_URL to the API origin and put
both apps behind one reverse proxy (cookies require same-origin).
```

---

## Getting started

### 1. Backend

```bash
cd elvictoria/backend
cp .env.example .env          # fill in Neon, R2 and Flutterwave values
npm install
npx prisma migrate deploy     # uses DATABASE_DIRECT_URL
npm run db:seed               # repeatable; uploads listing photos to R2
npm run dev                   # Express on :3030
npm test                      # vitest suite (permissions, payments, guards)
```

### 2. Frontend

```bash
# workspace root (see deviation note above)
cp .env.example .env.local    # sandbox: keep NEXT_PUBLIC_API_GATEWAY_PORT=3030
bun install                   # or npm install
npm run dev                   # Next.js on :3000
npm run build                 # standalone production build
```

### Demo accounts (seeded, development only)

Password for all: `Elvictoria123` — change before any real deployment.

| Role | Email |
|---|---|
| Lawyer | `adaeze.okonkwo@elvictoria.example`, `tunde.adebayo@…`, `nneka.eze@…` |
| Support (staff) | `mariam.bello@elvictoria.example`, `obinna.chukwu@…` |
| Provider | `chinedu@crestfieldhomes.example`, `amina.yusuf@mail.example`, `femi@balogunrealty.example` … |
| Client | `daniel.johnson@mail.example`, `grace.afolabi@mail.example` … |

Seed content: 22 users, 26 listings (104 photos uploaded to R2), 20 enquiries,
15 cases with threads/timelines, 12 payments in every state, notifications,
helpdesk tickets and platform settings.

---

## Roles & permissions

Access control is enforced **server-side** (`src/lib/permissions.ts` + per-route
guards); the UI merely hides what the API would reject.

| Capability | Client | Provider | Lawyer | Support |
|---|---|---|---|---|
| Browse/search/saved listings | ✓ | ✓ | ✓ | ✓ |
| Submit enquiries | ✓ | — | — | — |
| Create/edit/submit listings | — | ✓ (own) | — | — |
| Listing approval queue | — | — | ✓ | ✓ |
| Enquiry triage, case opening, status changes | — | — | ✓ | ✓ |
| Case threads | own CLIENT thread | own PROVIDER thread | all 3 (incl. INTERNAL) | view |
| Raise / confirm payments | — | — | ✓ | ✓ |
| Contact disclosure | — | — | ✓ | — |
| Reports, settings, user management | — | — | ✓ | ✓ |

**Contact masking** — the core business rule: property detail responses and
case bundles never include the provider's or client's phone/email for the
other party. Details are released exactly once, through an audited
`POST /api/cases/:id/disclose` that notifies the recipient and writes a
timeline entry. Providers additionally never see payer details on payments.

## Payment flow (Flutterwave v3, test mode)

1. Lawyer raises a payment request on a case (`POST /api/staff/payments`).
2. Client opens checkout: `POST /api/client/payments/:id/pay` → server-side
   call to Flutterwave creates a hosted link; payment becomes
   `AWAITING_PAYMENT`.
3. Two server-verified completion paths:
   - **Card**: on redirect back, `POST .../verify` re-checks the transaction
     with the Flutterwave API before anything is marked successful.
   - **Bank transfer**: client reports it (`.../transfer`, amount guard
     rejects mismatches) → `PENDING_CONFIRMATION` → lawyer confirms
     (`POST /api/staff/payments/:id/confirm-transfer`) → `SUCCESSFUL`.
4. `POST /api/payments/webhook` is production-ready and signature-checked
   (`verif-hash` vs `FLW_WEBHOOK_SECRET`); it always re-verifies via the API
   before confirming and is idempotent. **Pending step**: register the
   webhook URL in the Flutterwave dashboard and set `FLW_WEBHOOK_SECRET`.

## End-to-end verification

`scripts/e2e-journey.mjs` (workspace root) walks the full journey through the
same origin the browser uses: client discovery/enquiry → RBAC negatives →
lawyer triage/case/payment/disclosure → provider masking & thread → client
checkout, transfer guard, settlement. Current result: **58/58 checks pass**.

```bash
node scripts/e2e-journey.mjs   # backend (:3030) + gateway (:81) must be up
```

## Environment variables

See `elvictoria/backend/.env.example` and `.env.example` (frontend) — every
variable is declared and validated once in `src/config/env.ts`; the process
refuses to boot on missing/malformed values. The R2 and Flutterwave
credentials in the sandbox `.env` are **development credentials** — rotate
them before production.
