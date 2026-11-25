"use client";

/**
 * Sign-in page — matches the prototype: full-screen split with the form
 * on the left (logo top, centered max-w-md column) and the dark photo
 * panel with trust bullets on the right. Redirects back to ?next=.
 */
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch, ApiRequestError } from "@/lib/api";
import { useAuth, resolvePostAuthTarget, safeInternalPath, type SessionUser } from "@/lib/auth";
import { AuthShell, Button, Field, Input, Alert, EyeIcon, EyeOffIcon } from "@/components/platform/ui-bits";

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { setUser } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const next = params.get("next");

  function safeNext(): string {
    // Only allow internal redirects (never an off-site target).
    return safeInternalPath(next) ?? "";
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const localErrors: Record<string, string> = {};
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) localErrors.email = "Enter a valid email address.";
    if (!password) localErrors.password = "Enter your password.";
    setErrors(localErrors);
    if (Object.keys(localErrors).length > 0) return;

    setSubmitting(true);
    try {
      const data = await apiFetch<{ user: SessionUser }>("/auth/login", {
        method: "POST",
        body: { email, password },
      });
      setUser(data.user);
      // An old ?next= captured under the previous account must not land a
      // different role on a page it cannot open.
      const target = resolvePostAuthTarget(data.user.role, safeNext());
      router.push(target);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setErrors(err.fields ?? { form: err.message });
      } else {
        setErrors({ form: "Could not sign in. Please try again." });
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      heading="Welcome back"
      intro={
        <>
          New to Luxury Trust Homes?{" "}
          <Link href="/register" className="font-semibold text-brand-700 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Email address" htmlFor="login-email" error={errors.email} required>
          <Input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </Field>
        <Field label="Password" htmlFor="login-password" error={errors.password} required>
          <div className="relative">
            <Input
              id="login-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="pr-10"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-muted hover:text-ink-strong"
            >
              {showPassword ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
            </button>
          </div>
        </Field>

        {errors.form && <Alert tone="error">{errors.form}</Alert>}

        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-sm font-medium text-brand-700 hover:underline">
            Forgot password?
          </Link>
        </div>

        <Button type="submit" loading={submitting} size="lg" className="w-full">
          Sign in
        </Button>
      </form>
    </AuthShell>
  );
}
