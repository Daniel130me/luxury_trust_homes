"use client";

/**
 * Sign-in page — matches the prototype: email + password, show/hide toggle,
 * forgot-password link, and redirect back to the original target (?next=).
 */
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch, ApiRequestError } from "@/lib/api";
import { useAuth, workspaceHome, type SessionUser } from "@/lib/auth";
import { Button, Card, Field, Input, Alert, EyeIcon, EyeOffIcon } from "@/components/platform/ui-bits";

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
    if (next && next.startsWith("/") && !next.startsWith("//")) return next;
    return "";
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
      const target = safeNext() || workspaceHome(data.user.role);
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
    <main className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl items-center gap-10 px-4 py-10 sm:px-6 lg:grid-cols-2">
      <Card className="mx-auto w-full max-w-md p-6 sm:p-8">
        <h1 className="font-serif text-3xl text-ink-strong">Welcome back</h1>
        <p className="mt-1.5 text-sm text-ink-muted">
          New to ELVICTORIA?{" "}
          <Link href="/register" className="font-semibold text-brand-700 hover:text-brand-800">
            Create an account
          </Link>
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
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
                className="pr-11"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-ink-muted hover:text-ink-strong"
              >
                {showPassword ? <EyeOffIcon className="h-4.5 w-4.5" /> : <EyeIcon className="h-4.5 w-4.5" />}
              </button>
            </div>
          </Field>

          {errors.form && <Alert tone="error">{errors.form}</Alert>}

          <div className="flex items-center justify-between text-sm">
            <Link href="/forgot-password" className="font-medium text-brand-700 hover:text-brand-800">
              Forgot password?
            </Link>
          </div>

          <Button type="submit" loading={submitting} className="w-full">
            Sign in
          </Button>
        </form>
      </Card>

      <aside className="hidden lg:block">
        <div
          className="overflow-hidden rounded-2xl"
          style={{
            backgroundImage:
              "linear-gradient(160deg, rgba(43,10,17,0.9) 0%, rgba(79,21,32,0.75) 55%, rgba(122,35,51,0.45) 100%), url('https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=70&auto=format&fit=crop')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="p-8 text-white">
            <h2 className="font-serif text-2xl">Lawyers handle everything — not strangers.</h2>
            <ul className="mt-4 space-y-2 text-sm text-white/85">
              {[
                "Lawyers handle every enquiry",
                "Your details stay confidential",
                "Every listing is reviewed",
                "Safer payments",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-white/15">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </aside>
    </main>
  );
}
