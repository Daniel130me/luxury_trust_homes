"use client";

/** Contact page — office details and a message form posting to the backend. */
import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { Alert, Button, Card, Field, Input, Textarea, TrustPanel } from "@/components/platform/ui-bits";

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiFetch<{ message: string }>("/contact", { body: form });
      setSent(true);
      setForm({ name: "", email: "", subject: "", message: "" });
      void res;
    } catch (err) {
      const fields = (err as { fields?: Record<string, string> }).fields;
      if (fields) setErrors(fields);
      setError(err instanceof Error ? err.message : "Could not send your message. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-gold-600">Contact</p>
          <h1 className="mt-2 font-serif text-4xl text-ink-strong">Talk to the legal team.</h1>
          <p className="mt-3 leading-relaxed text-ink-soft">
            Questions about a listing, a payment or the platform? Send a message and a member of our
            legal team will review it shortly.
          </p>

          {sent ? (
            <Alert tone="success">
              Thank you. A member of our legal team will review your message shortly.
            </Alert>
          ) : (
            <Card className="mt-6 p-5 sm:p-6">
              <form onSubmit={submit} className="space-y-4" noValidate>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Your name" required error={errors.name}>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      required
                      autoComplete="name"
                    />
                  </Field>
                  <Field label="Email address" required error={errors.email}>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      required
                      autoComplete="email"
                    />
                  </Field>
                </div>
                <Field label="Subject" required error={errors.subject}>
                  <Input
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    required
                  />
                </Field>
                <Field label="Message" required error={errors.message}>
                  <Textarea
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    required
                    rows={5}
                  />
                </Field>
                {error && <Alert tone="error">{error}</Alert>}
                <Button type="submit" loading={submitting}>
                  Send message
                </Button>
              </form>
            </Card>
          )}
        </div>

        <aside className="space-y-4">
          <Card className="p-5">
            <h2 className="font-semibold text-ink-strong">Our office</h2>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink-muted">
              <li>14B Ademola Adetokunbo Crescent, Victoria Island, Lagos</li>
              <li>+234 201 330 4410</li>
              <li>hello@elvictoria.example</li>
              <li>Monday – Friday, 8:30am – 5:30pm (WAT)</li>
            </ul>
          </Card>
          <TrustPanel />
        </aside>
      </div>
    </main>
  );
}
