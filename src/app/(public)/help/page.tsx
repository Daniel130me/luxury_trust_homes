"use client";

/** Public help page — answers plus a route into the signed-in Help Desk. */
import Link from "next/link";
import { useAuth, workspaceHome } from "@/lib/auth";
import { Button, Card } from "@/components/platform/ui-bits";

const FAQS = [
  {
    q: "How are enquiries handled?",
    a: "Every enquiry is submitted through the platform and assigned to an ELVICTORIA lawyer. Your lawyer reviews it, contacts the property provider, and keeps you updated inside your account. You never deal with unknown agents or middlemen.",
  },
  {
    q: "Who can see my contact details?",
    a: "Your phone number and email are never published on a listing. They are shared with the other party only when your lawyer authorises it for your transaction, and every disclosure is recorded against the case.",
  },
  {
    q: "How do payments work?",
    a: "Payment requests are raised by your lawyer inside your account and linked to your case. You can pay by debit card through Flutterwave's secure checkout, or by bank transfer which your lawyer confirms. We will never ask you to pay into a personal account.",
  },
  {
    q: "Are listings verified?",
    a: "Yes. Every listing is reviewed by our legal team before it appears publicly, and listings that do not meet our standards are rejected or withdrawn.",
  },
  {
    q: "I am a property owner — how do I list?",
    a: "Register as a provider, add your listing with photos and location details, and submit it for review. Once approved it appears in the public catalogue and enquiries arrive through the legal team.",
  },
];

export default function HelpPage() {
  const { user } = useAuth();

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-gold-600">Help Desk</p>
      <h1 className="mt-2 font-serif text-4xl text-ink-strong">How can we help?</h1>
      <p className="mt-3 leading-relaxed text-ink-soft">
        Answers to the questions we hear most. For anything else, open a ticket in the Help Desk and
        our support team will respond.
      </p>

      <div className="mt-8 space-y-3">
        {FAQS.map((faq) => (
          <details key={faq.q} className="group rounded-xl border border-zinc-200 bg-white p-5 open:shadow-sm">
            <summary className="cursor-pointer list-none font-semibold text-ink-strong marker:hidden">
              <span className="flex items-center justify-between gap-3">
                {faq.q}
                <span className="text-brand-700 transition-transform group-open:rotate-45" aria-hidden>＋</span>
              </span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">{faq.a}</p>
          </details>
        ))}
      </div>

      <Card className="mt-8 flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p className="font-semibold text-ink-strong">Still need help?</p>
          <p className="text-sm text-ink-muted">
            {user ? "Open a ticket and our support team will respond." : "Sign in to open a support ticket."}
          </p>
        </div>
        {user ? (
          <Link href="/app/help">
            <Button>Open the Help Desk</Button>
          </Link>
        ) : (
          <Link href="/login">
            <Button>Sign in</Button>
          </Link>
        )}
      </Card>
    </main>
  );
}
