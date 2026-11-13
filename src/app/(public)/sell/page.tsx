"use client";

/** Sell / list a property page — provider pitch and CTA (prototype copy). */
import Link from "next/link";
import { useAuth, workspaceHome } from "@/lib/auth";
import { Button, Card, TrustPanel } from "@/components/platform/ui-bits";

export default function SellPage() {
  const { user } = useAuth();

  return (
    <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-gold-600">For property owners</p>
          <h1 className="mt-2 font-serif text-4xl text-ink-strong">List your property with legal confidence.</h1>
          <p className="mt-3 max-w-3xl leading-relaxed text-ink-soft">
            ELVICTORIA connects your property with serious, verified buyers and renters. Every enquiry
            arrives through our lawyers, so you never share your contact details with strangers — and
            every listing is reviewed before it goes live.
          </p>

          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {[
              {
                title: "Your details stay private",
                body: "Your phone number and email are never shown publicly. They are shared only when your lawyer authorises it for a live transaction, and every disclosure is recorded.",
              },
              {
                title: "Qualified buyers and renters",
                body: "Enquiries arrive with context — timing, budget and questions — gathered by the legal team before they reach you.",
              },
              {
                title: "Reviewed, then published",
                body: "Our lawyers review each listing before it appears in the catalogue, keeping the platform free of scams and duplicates.",
              },
              {
                title: "Payments handled properly",
                body: "Payment requests are raised through the platform against the transaction case — never through personal accounts or informal channels.",
              },
            ].map((item) => (
              <Card key={item.title} className="p-5">
                <h2 className="font-semibold text-ink-strong">{item.title}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{item.body}</p>
              </Card>
            ))}
          </div>

          <div className="mt-8">
            <TrustPanel />
          </div>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card className="p-5">
            <h2 className="font-serif text-xl text-ink-strong">Ready to list?</h2>
            <p className="mt-1.5 text-sm text-ink-muted">
              Create a provider account to add your first listing. Registration takes about a minute.
            </p>
            <div className="mt-4 space-y-3">
              {user?.role === "PROVIDER" ? (
                <Link href="/app/provider/properties/new" className="block">
                  <Button className="w-full">Add a property</Button>
                </Link>
              ) : user ? (
                <Link href={workspaceHome(user.role)} className="block">
                  <Button className="w-full">Go to my workspace</Button>
                </Link>
              ) : (
                <>
                  <Link href="/register?as=provider" className="block">
                    <Button className="w-full">Register as a provider</Button>
                  </Link>
                  <Link href="/login" className="block">
                    <Button variant="outline" className="w-full">
                      I already have an account
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </Card>
          <Card className="p-5 text-sm leading-relaxed text-ink-muted">
            <p className="font-semibold text-ink-strong">How it works</p>
            <ol className="mt-2 list-decimal space-y-1.5 pl-4">
              <li>Submit your listing with photos and location details.</li>
              <li>Our legal team reviews it — usually within two working days.</li>
              <li>Approved listings go live in the public catalogue.</li>
              <li>Enquiries are handled end-to-end by your assigned lawyer.</li>
            </ol>
          </Card>
        </aside>
      </div>
    </main>
  );
}
