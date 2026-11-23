"use client";

/**
 * Registration wizard — three steps on ONE page, every completed step
 * persisted to the database (SignupDraft, keyed by an httpOnly cookie) so a
 * refresh or a closed tab resumes exactly where the visitor stopped, with
 * no redundant data written. The password is never persisted.
 *
 * Steps:
 *   1. What brings you here?  (account type + interest / provider kind)
 *   2. About you              (name, email, phone)
 *   3. Location & security    (preferred state/area, password, terms)
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch, ApiRequestError } from "@/lib/api";
import { useAuth, resolvePostAuthTarget, workspaceHome, type SessionUser } from "@/lib/auth";
import { AuthShell, Button, Field, Input, Select, Alert, EyeIcon, EyeOffIcon } from "@/components/platform/ui-bits";

type DraftResponse = {
  draft: {
    step: number;
    role: "client" | "provider" | null;
    data: Partial<Record<"interest" | "clientKind" | "providerKind" | "organisation" | "name" | "email" | "phone" | "preferredState" | "preferredRegion", string>>;
  } | null;
};

const STEPS = [
  { number: 1, label: "What brings you here" },
  { number: 2, label: "About you" },
  { number: 3, label: "Location & password" },
] as const;

export default function RegisterPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, setUser } = useAuth();

  const isProviderDefault = params.get("as") === "provider";
  const next = params.get("next");

  const [step, setStep] = useState(1);
  const [resumed, setResumed] = useState(false);
  const [accountType, setAccountType] = useState<"client" | "provider">(
    isProviderDefault ? "provider" : "client",
  );
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirm: "",
    interest: "BUYING",
    preferredState: "Lagos",
    preferredRegion: "",
    providerKind: "OWNER",
    organisation: "",
  });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [busy, setBusy] = useState(false);

  // Already signed in? Nothing to onboard — go straight to the workspace.
  useEffect(() => {
    if (user) router.replace(workspaceHome(user.role));
  }, [user, router]);

  // Resume a saved draft (survives refreshes and closed tabs).
  useEffect(() => {
    apiFetch<DraftResponse>("/auth/signup-draft")
      .then((data) => {
        const draft = data.draft;
        if (!draft) return;
        setForm((f) => ({
          ...f,
          ...(draft.data.interest ? { interest: draft.data.interest } : {}),
          ...(draft.data.providerKind ? { providerKind: draft.data.providerKind } : {}),
          ...(draft.data.organisation ? { organisation: draft.data.organisation } : {}),
          ...(draft.data.name ? { name: draft.data.name } : {}),
          ...(draft.data.email ? { email: draft.data.email } : {}),
          ...(draft.data.phone ? { phone: draft.data.phone } : {}),
          ...(draft.data.preferredState ? { preferredState: draft.data.preferredState } : {}),
          ...(draft.data.preferredRegion ? { preferredRegion: draft.data.preferredRegion } : {}),
        }));
        if (draft.role) setAccountType(draft.role);
        if (draft.step >= 1 && draft.step <= 3) setStep(draft.step);
        setResumed(true);
      })
      .catch(() => undefined); // no draft / backend unreachable — start clean
  }, []);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  /** Persist the wizard progress to the database. Non-secret fields only. */
  async function saveDraft(stepNumber: number): Promise<void> {
    const data =
      stepNumber === 1
        ? accountType === "provider"
          ? { providerKind: form.providerKind, organisation: form.organisation }
          : { interest: form.interest, clientKind: form.interest === "RENTING" ? "RENTER" : form.interest === "BROWSING" ? "BROWSING" : "BUYER" }
        : stepNumber === 2
          ? { name: form.name, email: form.email, phone: form.phone }
          : { preferredState: form.preferredState, preferredRegion: form.preferredRegion };
    try {
      await apiFetch("/auth/signup-draft", {
        method: "PUT",
        body: { step: stepNumber, role: accountType, data },
      });
    } catch {
      // Progress saving is best-effort — never block the wizard on it.
      setErrors((e) => ({ ...e, form: "Could not save your progress right now — you can still continue." }));
    }
  }

  function validateStep(stepNumber: number): boolean {
    const local: Record<string, string> = {};
    if (stepNumber === 2) {
      if (form.name.trim().length < 2) local.name = "Enter your full name.";
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) local.email = "Enter a valid email address.";
      if (!/^(\+?[0-9][0-9\s-]{6,19})?$/.test(form.phone.replace(/\s/g, "")) || form.phone.trim() === "") {
        local.phone = "Enter a valid phone number.";
      }
    }
    if (stepNumber === 3) {
      if (form.password.length < 8 || !/[A-Za-z]/.test(form.password) || !/[0-9]/.test(form.password)) {
        local.password = "At least 8 characters, with a letter and a number.";
      }
      if (form.confirm !== form.password) local.confirm = "Passwords do not match.";
      if (!acceptedTerms) local.terms = "Please accept the Terms and Conditions to continue.";
    }
    setErrors(local);
    return Object.keys(local).length === 0;
  }

  async function goNext(current: number) {
    setErrors({});
    if (current === 1) {
      setBusy(true);
      await saveDraft(1);
      setBusy(false);
      setStep(2);
      return;
    }
    if (!validateStep(current)) return;
    if (current === 2) {
      setBusy(true);
      await saveDraft(2);
      setBusy(false);
      setStep(3);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!validateStep(3)) return;
    setSubmitting(true);
    try {
      const body = {
        name: form.name,
        email: form.email,
        phone: form.phone,
        password: form.password,
        accountType,
        ...(accountType === "provider"
          ? { providerKind: form.providerKind, organisation: form.organisation || undefined, city: form.preferredState }
          : {
              interest: form.interest,
              clientKind: form.interest === "RENTING" ? "RENTER" : form.interest === "BROWSING" ? "BROWSING" : "BUYER",
              preferredState: form.preferredState,
              preferredRegion: form.preferredRegion || undefined,
              city: form.preferredState,
            }),
      };
      const data = await apiFetch<{ user: SessionUser }>("/auth/register", {
        method: "POST",
        body,
      });
      setUser(data.user);
      // Onboarding complete — the backend already deleted the draft row and
      // its cookie; this keeps the client in sync regardless.
      void apiFetch("/auth/signup-draft", { method: "DELETE" }).catch(() => undefined);
      router.push(resolvePostAuthTarget(data.user.role, next));
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setErrors(err.fields ?? { form: err.message });
      } else {
        setErrors({ form: "Could not create your account. Please try again." });
      }
    } finally {
      setSubmitting(false);
    }
  }

  const canGoBack = step > 1;

  return (
    <AuthShell
      heading="Create an account"
      intro={
        <>
          Already registered?{" "}
          <Link href="/login" className="font-semibold text-brand-700 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      {/* Step indicator — completed steps are clickable to go back. */}
      <ol className="mt-5 grid grid-cols-3 gap-2" aria-label="Registration steps">
        {STEPS.map((entry) => {
          const state = step === entry.number ? "current" : step > entry.number ? "done" : "todo";
          return (
            <li key={entry.number}>
              <button
                type="button"
                disabled={state !== "done" || busy || submitting}
                onClick={() => setStep(entry.number)}
                aria-current={state === "current" ? "step" : undefined}
                className={`w-full rounded-lg px-2 py-2 text-center text-xs font-semibold transition-colors ${
                  state === "current"
                    ? "bg-brand-800 text-white"
                    : state === "done"
                      ? "bg-brand-100 text-brand-800 hover:bg-brand-200"
                      : "bg-brand-50 text-ink-muted"
                }`}
              >
                <span className="block">{state === "done" ? "✓" : entry.number}</span>
                <span className="mt-0.5 block leading-tight">{entry.label}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-center text-xs text-ink-muted">
        Your progress is saved automatically — refresh or leave and pick up where you stopped.
        {resumed && " (Progress restored.)"}
      </p>

      <form
        onSubmit={step === 3 ? submit : (e) => { e.preventDefault(); void goNext(step); }}
        className="mt-6 space-y-4"
        noValidate
      >
        {step === 1 && (
          <>
            {/* Account type selector */}
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-brand-50 p-1" role="group" aria-label="Account type">
              {(["client", "provider"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setAccountType(option)}
                  aria-pressed={accountType === option}
                  className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
                    accountType === option ? "bg-brand-800 text-white shadow" : "text-ink-soft"
                  }`}
                >
                  {option === "client" ? "Buy or rent" : "List a property"}
                </button>
              ))}
            </div>

            {accountType === "client" ? (
              <Field label="I am looking to" htmlFor="reg-interest">
                <Select id="reg-interest" value={form.interest} onChange={(e) => set("interest", e.target.value)}>
                  <option value="BUYING">Buy</option>
                  <option value="RENTING">Rent</option>
                  <option value="BROWSING">Just browsing</option>
                </Select>
              </Field>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="I am a" htmlFor="reg-kind">
                  <Select id="reg-kind" value={form.providerKind} onChange={(e) => set("providerKind", e.target.value)}>
                    <option value="OWNER">Property owner</option>
                    <option value="DEVELOPER">Property developer</option>
                    <option value="AGENT">Estate agent</option>
                  </Select>
                </Field>
                <Field label="Company name" htmlFor="reg-org" hint="Optional for individual owners">
                  <Input id="reg-org" value={form.organisation} onChange={(e) => set("organisation", e.target.value)} />
                </Field>
              </div>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <Field label="Full name" htmlFor="reg-name" error={errors.name} required>
              <Input id="reg-name" value={form.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" required />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Email address" htmlFor="reg-email" error={errors.email} required>
                <Input id="reg-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" required />
              </Field>
              <Field label="Phone number" htmlFor="reg-phone" error={errors.phone} required>
                <Input id="reg-phone" type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+234..." autoComplete="tel" required />
              </Field>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Preferred state" htmlFor="reg-state">
                <Select id="reg-state" value={form.preferredState} onChange={(e) => { set("preferredState", e.target.value); set("preferredRegion", ""); }}>
                  <option value="Lagos">Lagos</option>
                  <option value="Enugu">Enugu</option>
                </Select>
              </Field>
              {form.preferredState === "Lagos" && (
                <Field label="Preferred area of Lagos" htmlFor="reg-region">
                  <Select id="reg-region" value={form.preferredRegion} onChange={(e) => set("preferredRegion", e.target.value)}>
                    <option value="">No preference</option>
                    <option value="Island">Island</option>
                    <option value="Mainland">Mainland</option>
                  </Select>
                </Field>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Password" htmlFor="reg-pw" error={errors.password} hint="At least 8 characters, with a letter and a number." required>
                <div className="relative">
                  <Input
                    id="reg-pw"
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => set("password", e.target.value)}
                    autoComplete="new-password"
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
              <Field label="Confirm password" htmlFor="reg-confirm" error={errors.confirm} required>
                <Input id="reg-confirm" type={showPassword ? "text" : "password"} value={form.confirm} onChange={(e) => set("confirm", e.target.value)} autoComplete="new-password" required />
              </Field>
            </div>
            <p className="text-xs text-ink-muted">
              For security your password is never saved in the draft — if you leave, you simply type it again.
            </p>

            <label className="flex items-start gap-3 text-sm text-ink-soft">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-brand-200 text-brand-700 focus:ring-brand-500/40"
              />
              <span>
                I accept the{" "}
                <Link href="/terms" className="font-semibold text-brand-700" target="_blank">
                  Terms and Conditions
                </Link>{" "}
                and the{" "}
                <Link href="/privacy" className="font-semibold text-brand-700" target="_blank">
                  Privacy Policy
                </Link>
                .
              </span>
            </label>
            {errors.terms && <p className="text-xs font-medium text-red-600">{errors.terms}</p>}
          </>
        )}

        {errors.form && <Alert tone="error">{errors.form}</Alert>}

        <div className={canGoBack ? "flex gap-3" : ""}>
          {canGoBack && (
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={busy || submitting}
              onClick={() => setStep(step - 1)}
            >
              Back
            </Button>
          )}
          <Button type="submit" loading={busy || submitting} size="lg" className="flex-1">
            {step === 3 ? "Create account" : "Continue"}
          </Button>
        </div>
      </form>
    </AuthShell>
  );
}
