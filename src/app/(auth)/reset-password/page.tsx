"use client";

/** Reset password — consumes the emailed token and sets a new password. */
import { useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { apiFetch, ApiRequestError } from "@/lib/api";
import { Alert, Button, Card, Field, Input } from "@/components/platform/ui-bits";

export default function ResetPasswordPage() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const local: Record<string, string> = {};
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      local.password = "At least 8 characters, with a letter and a number.";
    }
    if (confirm !== password) local.confirm = "Passwords do not match.";
    setErrors(local);
    if (Object.keys(local).length > 0) return;

    setSubmitting(true);
    try {
      await apiFetch("/auth/reset-password", { method: "POST", body: { token, password } });
      setDone(true);
    } catch (err) {
      setErrors(err instanceof ApiRequestError ? (err.fields ?? { form: err.message }) : { form: "Something went wrong. Please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-16 sm:px-6">
        <Card className="p-6 sm:p-8">
          <h1 className="font-serif text-2xl text-ink-strong">Invalid reset link</h1>
          <p className="mt-2 text-sm text-ink-muted">
            This password reset link is missing its token. Please request a new one.
          </p>
          <Link href="/forgot-password" className="mt-4 block">
            <Button className="w-full">Request a new link</Button>
          </Link>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-md px-4 py-16 sm:px-6">
      <Card className="p-6 sm:p-8">
        <h1 className="font-serif text-3xl text-ink-strong">Choose a new password</h1>
        {done ? (
          <div className="mt-4 space-y-4">
            <Alert tone="success">Your password has been updated. You can now sign in.</Alert>
            <Button className="w-full" onClick={() => router.push("/login")}>
              Sign in
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
            <Field label="New password" htmlFor="reset-pw" error={errors.password} required>
              <Input
                id="reset-pw"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </Field>
            <Field label="Confirm new password" htmlFor="reset-confirm" error={errors.confirm} required>
              <Input
                id="reset-confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                required
              />
            </Field>
            {errors.form && <Alert tone="error">{errors.form}</Alert>}
            <Button type="submit" loading={submitting} className="w-full">
              Update password
            </Button>
          </form>
        )}
      </Card>
    </main>
  );
}
