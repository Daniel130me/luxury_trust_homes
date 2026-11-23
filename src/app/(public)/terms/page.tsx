"use client";

/** Terms and conditions page (prototype structure). */
export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="font-serif text-4xl text-ink-strong">Terms and Conditions</h1>
      <div className="mt-6 space-y-6 leading-relaxed text-ink-soft">
        <section>
          <h2 className="text-lg font-semibold text-ink-strong">1. About Luxury Trust Homes</h2>
          <p className="mt-2">
            Luxury Trust Homes is a property platform operated by Elvictoria Attorneys and Solicitors that facilitates property
            discovery, listings, enquiries and lawyer-managed property transactions. By creating an
            account you agree to these terms.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-ink-strong">2. Accounts and roles</h2>
          <p className="mt-2">
            Buyers and renters submit enquiries through the platform. Property providers list
            properties, which are reviewed by our legal team before publication. Lawyers and authorised
            staff manage enquiries, transaction cases, payments and the help desk. You must provide
            accurate information and keep your credentials secure.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-ink-strong">3. Enquiries and transactions</h2>
          <p className="mt-2">
            All communication between buyers, renters and property providers runs through the
            Elvictoria legal team. Contact details are shared only when a lawyer authorises it for a
            live transaction. Opening an enquiry does not by itself reserve a property or create a
            contract.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-ink-strong">4. Payments</h2>
          <p className="mt-2">
            Payment requests are raised through the platform against a transaction case and processed
            through Flutterwave. Luxury Trust Homes will never ask you to pay into a personal account, or to
            pay anyone by phone or message. Payment requests appear only in your account.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-ink-strong">5. Listings</h2>
          <p className="mt-2">
            Providers are responsible for the accuracy of the details and photographs they submit.
            Listings that do not meet our standards may be rejected or withdrawn. Only approved
            listings appear publicly.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-ink-strong">6. Liability</h2>
          <p className="mt-2">
            The platform coordinates transactions and records their progress, but does not guarantee
            the outcome of any negotiation. Nothing here limits liabilities that cannot be limited
            under Nigerian law.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-ink-strong">7. Governing law</h2>
          <p className="mt-2">These terms are governed by the laws of the Federal Republic of Nigeria.</p>
        </section>
      </div>
    </main>
  );
}
