"use client";

/** Privacy policy page (prototype structure). */
export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="font-serif text-4xl text-ink-strong">Privacy Policy</h1>
      <div className="mt-6 space-y-6 leading-relaxed text-ink-soft">
        <section>
          <h2 className="text-lg font-semibold text-ink-strong">1. Data we collect</h2>
          <p className="mt-2">
            We collect the details you provide when you register (name, email address, phone number and
            preferences), the content you create on the platform (enquiries, messages, listings and
            photographs), and technical records needed to keep the service secure (sign-in history and
            audit logs).
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-ink-strong">2. How your details are used</h2>
          <p className="mt-2">
            Your contact details are never published on a listing. They are shared with another party
            only when your lawyer authorises it for your transaction, and every disclosure is recorded.
            Payment information is processed by Flutterwave; ELVICTORIA does not store card details.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-ink-strong">3. Storage and security</h2>
          <p className="mt-2">
            Data is stored in a managed PostgreSQL database with encrypted connections. Passwords are
            stored only as salted hashes, sessions use HTTP-only cookies, and administrative and
            financial actions are written to an audit log.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-ink-strong">4. Your rights</h2>
          <p className="mt-2">
            You can review and update your personal details under Account &amp; profile. To request
            deletion of your account or its data, contact our office — see the{" "}
            <a className="font-semibold text-brand-700" href="/contact">contact page</a>.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-ink-strong">5. Contact</h2>
          <p className="mt-2">
            14B Ademola Adetokunbo Crescent, Victoria Island, Lagos · hello@elvictoria.example · +234 201
            330 4410
          </p>
        </section>
      </div>
    </main>
  );
}
