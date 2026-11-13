# ELVICTORIA Prototype Analysis (authoritative build reference)

Source: upload/elvictoria_with_photos.html (Vite React 18 + react-router SPA, minified).
Sample DB extracted to scripts/out/prototype_db.json (users 22, properties 26, cases 20, payments 12, notifications 56, saved 11, tickets 5, accessRequests 1).

## 1. Design system (exact tokens from compiled CSS)

Fonts: "DM Serif Display" (serif headings), "DM Sans" (body). Body bg rgb(250 248 247) #faf8f7, body text rgb(34 37 43) #22252b.

brand: 50 #fbf4f5, 100 #f5e3e6, 200 #eac4ca, 300 #d899a3, 400 #bf6474, 500 #a33d50, 600 #8a2c3e, 700 #7a2333, 800 #6b1d2c, 900 #4f1520
gold: 50 #fbf7ee, 200 #e9d4a3, 300 #dcb96f, 400 #cfa04a, 500 #b8863a, 600 #9a6b2f
ink: strong #16181d, soft #4b4f58, muted #6e727b
Radii: .25/.375/.5/.75/1rem/9999px (rounded-sm/md/lg/xl/2xl/full)

## 2. Roles & permissions (from prototype C1 map)

Roles: lawyer (Lawyer / Administrator), support (staff), provider (owner|developer), client (buyer|renter).
Permissions:
- lawyer: workspace.staff, listing.moderate, listing.viewAll, case.viewAll, case.manage, case.observe, contact.disclose, user.viewAll, user.manage, payment.manage, reports.view, settings.manage, helpdesk.manage
- support: workspace.staff, listing.viewAll, case.viewAll, case.observe, user.viewAll, helpdesk.manage
- provider/client: [] (role-scoped access only)

Property visibility: public if status==approved && availability!=unavailable. Provider sees own; staff sees all.
Provider cannot view own listing details when rejected/pending_review in public context.

## 3. Reference formats

Property ELV-PR-1001..1026 (ref counter 1027), Enquiry ELV-EQ-4001..4019 (next 4020), Case ELV-CS-2001..2015 (next 2016), Payment ELV-PY-3001..3011 (next 3012), Ticket ELV-HD-5001..5002. Processor attempt ref: TXN{ref}{A..}{checksum}. TZ: Africa/Lagos (+01:00).

## 4. Routes (all pages)

Public: / (home), /properties?type=sale|rent (+search/state/lga/type/price/beds/sort/view), /properties/:reference, /sell, /about, /contact, /help, /privacy, /terms, /login (?next=), /register (?as=provider), /forgot-password.
Workspace shared: /app/profile, /app/notifications, /app/help (+/:id), /app/saved (client).
Client (/app/client): dashboard, enquiries (tabs Active/Closed), enquiries/:id (stepper, messages, progress, payments), payments (Requests | All payments), payments/:id ("Make a payment" — Debit card | Bank transfer + summary).
Provider (/app/provider): dashboard, properties (status filter tabs), properties/new, properties/:id, properties/:id/edit, cases (Enquiries & Cases), cases/:id.
Staff (/app/staff): dashboard (stats cards), listings (tabs by status, review actions), listings/:id, enquiries (tabs All/Needs attention/Unassigned/Escalated), matters = cases (tabs Open/Closed/All, filters status+lawyer), matters/:id (stepper, Update status, Request payment, Communication tabs Client/Provider/Internal, Activity history), payments (summary cards Received/Awaiting/Transfers to confirm/Failed + tabs incl. Pending Confirmation), payments?focus=:id, users (+/:id), reports, settings, helpdesk (+/:id).

## 5. Domain model

users: id, name, email, phone, role, providerKind (owner|developer), organisation, city, registeredAt, status active|deactivated, interest (buying|renting|selling|browsing), preferredLocation {state, region}, alerts {enabled, here}, clientKind (buyer|renter), passwordHash (prototype: sha256("elvictoria:"+pw); REAL: bcrypt).
properties: ref, providerId, title, category (detached_duplex|semi_detached_duplex|apartment|terrace|bungalow|land|commercial), listingType sale|rent, price (naira), state (Lagos|Enugu), region (Island|Mainland), lga, area, address, beds, baths, toilets, sqm, parking, furnishing, description, features[], status (draft|pending_review|approved|changes_requested|rejected|unavailable), availability (available|under_offer|unavailable), featured, cautionDeposit?, serviceCharge?, feedback, created, history [at, action, actorNote].
photos per property: 3-5 named views (Front elevation, Living room, Kitchen, Bedroom, Plot overview...). Prototype uses Unsplash ids via elvictoriaPhotoLibrary by category.
enquiries+cases: one record in prototype (id c_*, eq 4001+, cs 2001+ once opened): property, client, provider, lawyer, status (new_enquiry→lawyer_assigned→under_review→in_progress→negotiation→payment_pending→completed | cancelled), purpose (purchase|rent|inspection|more_information), contact (phone|email|platform), message, submitted, opened, closed, closingNote, escalations [at, by, note], disclosures, timeline [at, actorId, label, visibility(participants|internal), note?], messages [at, thread(client|provider|internal), authorId, body].
payments: ref (3001+), caseId, payerId, requestedById, amount, description, status (outstanding|awaiting_payment|pending_confirmation|successful|failed), createdAt, dueDate, paidAt, attempts [at, method(card|transfer), outcome(successful|failed), message, processorReference TXN...].
notifications: userId, category (new_enquiry, payment_success, payment_failure, property_submission, admin_alert, case_update, account), title, body, link, at, read. Fan-out to all lawyers for new_enquiry/property_submission/admin_alert.
tickets: ref 5001+, userId, name, email, phone, category (enquiries, payments, fraud, listings, account...), subject, status open|resolved, messages [at, authorId, fromStaff, body].
settings: officeAddress, officePhone, officeEmail, officeHours, enquiryAcknowledgement, paymentDueDays:7.
accessRequests: provider access requests (email, at, userId).
savedProperties: userId+propertyId+savedAt.

## 6. Key workflows

- Client submits enquiry on property → all lawyers notified; enquiry status new_enquiry; provider NOT told client identity beyond need; client/provider contact details hidden until lawyer discloses (contact.disclose).
- Lawyer assigns self (or support escalates), opens case → case number issued; threads: client thread, provider thread, internal notes (participants never see internal; client & provider never see each other).
- Lawyer raises payment request (amount, description e.g. "10% commitment deposit", dueDate = paymentDueDays).
- Client pays: Debit card (REAL: Flutterwave checkout, backend verify) or Bank transfer (offline; status pending_confirmation until lawyer confirms "Payment received — update stage").
- Successful payment → case payment_pending resolved, timeline entry, notifications to lawyer/provider.
- Providers submit listings (draft → pending_review); lawyer approves / requests changes (feedback) / rejects; history recorded.
- Helpdesk: clients create tickets; staff reply/resolve; fraud category flagged on staff dashboard.
- Admin settings editable by lawyer (settings.manage); support read-only.

## 7. Copy tone

British English, legal-professional. Headings DM Serif. Trust bullets: "Lawyers handle every enquiry", "Your details stay confidential", "Every listing is reviewed", "Safer payments".

## 8. Prototype-only artefacts (MUST NOT ship)

- "Choose a reviewer account" button on login; simulated payment outcomes copy; localStorage persistence; client-side password hashing; "Message to Client" label bug in client enquiry composer (should read "Message to the legal team").
