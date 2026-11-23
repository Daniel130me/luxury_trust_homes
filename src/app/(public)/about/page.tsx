"use client";

/** About page — how ELVICTORIA works (prototype copy). */
import Link from "next/link";
import { Button, Card, TrustPanel } from "@/components/platform/ui-bits";

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-gold-600">About</p>
      <h1 className="mt-2 font-serif text-4xl text-ink-strong">Property with legal confidence.</h1>

      <div className="mt-6 space-y-8">
        <section>
          <h2 className="text-lg font-semibold text-ink-strong">1. About Luxury Trust Homes</h2>
          <p className="mt-2 leading-relaxed text-ink-soft">
            Luxury Trust Homes is a property platform operated by Elvictoria Attorneys and Solicitors that facilitates property
            discovery, listings, enquiries and lawyer-managed property transactions. Buyers and renters
            interact with property providers through the platform&apos;s authorised lawyers — never
            directly — so contact details stay confidential and every transaction leaves a proper
            record.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink-strong">2. How a transaction works</h2>
          <ol className="mt-2 space-y-3 leading-relaxed text-ink-soft">
            <li className="rounded-lg border border-brand-100 bg-white p-4">
              <strong className="text-ink-strong">1. Browse and enquire.</strong> Every listing has been
              reviewed by our legal team. Submit an enquiry with your timing, budget and questions.
            </li>
            <li className="rounded-lg border border-brand-100 bg-white p-4">
              <strong className="text-ink-strong">2. A lawyer takes over.</strong> An Elvictoria lawyer
              takes up your enquiry, opens a transaction case and becomes your single point
              of contact.
            </li>
            <li className="rounded-lg border border-brand-100 bg-white p-4">
              <strong className="text-ink-strong">3. Inspections and negotiation.</strong> Your lawyer
              coordinates with the property provider, arranges inspections and negotiates terms on your
              behalf.
            </li>
            <li className="rounded-lg border border-brand-100 bg-white p-4">
              <strong className="text-ink-strong">4. Secure payment.</strong> Payment requests are raised
              inside your account against the case and processed through Flutterwave. Luxury Trust Homes will
              never ask you to pay into a personal account.
            </li>
            <li className="rounded-lg border border-brand-100 bg-white p-4">
              <strong className="text-ink-strong">5. Completion.</strong> Your lawyer confirms the
              transaction, documents the outcome and closes the case.
            </li>
          </ol>
        </section>

        <TrustPanel />

        <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <p className="font-semibold text-ink-strong">Ready to start?</p>
            <p className="text-sm text-ink-muted">Browse the catalogue or create a free account.</p>
          </div>
          <div className="flex gap-3">
            <Link href="/properties"><Button variant="outline">Explore properties</Button></Link>
            <Link href="/register"><Button>Register</Button></Link>
          </div>
        </Card>
      </div>
    </main>
  );
}
