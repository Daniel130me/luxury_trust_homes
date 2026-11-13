"use client";

/** Forgot password — requests a reset link (always-generic response). */
import { useState } from "react";
import Link from "next/link";
import { apiFetch, ApiRequestError } from "@/lib/api";
import { Alert, Button, Card, Field, Input } from "@/components/platform/ui-bits";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setErrors({ email: "Enter a valid email address." });
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      await apiFetch("/auth/forgot-password", { method: "POST", body: { email } });
      setSent(true);
    } catch (err) {
      setErrors(err instanceof ApiRequestError ? (err.fields ?? { form: err.message }) : { form: "Something went wrong. Please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-md px-4 py-16 sm:px-6">
      <Card className="p-6 sm:p-8">
        <h1 className="font-serif text-3xl text-ink-strong">Reset your password</h1>
        {sent ? (
          <div className="mt-4 space-y-4">
            <Alert tone="success">
              If an account exists for that email, a password reset link has been sent. The link is
              valid for one hour.
            </Alert>
            <Link href="/login" className="block">
              <Button variant="outline" className="w-full">Back to sign in</Button>
            </Link>
          </div>
        ) : (
          <>
            <p className="mt-1.5 text-sm text-ink-muted">
              Enter the email address on your account and we will send a password reset link.
            </p>
            <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
              <Field label="Email address" htmlFor="forgot-email" error={errors.email} required>
                <Input
                  id="forgot-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </Field>
              {errors.form && <Alert tone="error">{errors.form}</Alert>}
              <Button type="submit" loading={submitting} className="w-full">
                Send reset link
              </Button>
            </form>
            <p className="mt-4 text-sm text-ink-muted">
              Remembered it?{" "}
              <Link href="/login" className="font-semibold text-brand-700">
                Sign in
              </Link>
            </p>
          </>
        )}
      </Card>
    </main>
  );
}
