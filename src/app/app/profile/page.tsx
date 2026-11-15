"use client";

/**
 * Profile page — personal details, password change (all roles), and the
 * alert preference for clients. Matches the prototype's Account & profile.
 */
import { useEffect, useState } from "react";
import { apiFetch, ApiRequestError } from "@/lib/api";
import { useAuth, roleLabel } from "@/lib/auth";
import {
  Alert, Button, Card, Field, Input, PageLoader, SectionHeader, Select,
} from "@/components/platform/ui-bits";

type ProfileForm = {
  name: string;
  email: string;
  phone: string;
  organisation: string;
  city: string;
  preferredState: string;
  preferredRegion: string;
  alertsEnabled: boolean;
};

export default function ProfilePage() {
  const { user, loading, refreshUser } = useAuth();
  const [form, setForm] = useState<ProfileForm | null>(null);
  const [profileStatus, setProfileStatus] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  // Password change form
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwErrors, setPwErrors] = useState<Record<string, string>>({});
  const [pwStatus, setPwStatus] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [changingPw, setChangingPw] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name ?? "",
        email: user.email ?? "",
        phone: user.phone ?? "",
        organisation: user.organisation ?? "",
        city: user.city ?? "",
        preferredState: user.preferredState ?? "Lagos",
        preferredRegion: user.preferredRegion ?? "",
        alertsEnabled: user.alertsEnabled ?? false,
      });
    }
  }, [user]);

  if (loading || !form) return <PageLoader />;

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    if (!form) return;
    setSavingProfile(true);
    setProfileStatus(null);
    try {
      await apiFetch("/users/me", {
        method: "PATCH",
        body: {
          name: form.name,
          phone: form.phone,
          organisation: form.organisation || undefined,
          city: form.city || undefined,
          preferredState: form.preferredState || undefined,
          preferredRegion: form.preferredRegion || undefined,
          alertsEnabled: form.alertsEnabled,
        },
      });
      await refreshUser();
      setProfileStatus({ tone: "success", message: "Your details have been updated." });
    } catch (err) {
      setProfileStatus({
        tone: "error",
        message: err instanceof ApiRequestError ? err.message : "Could not save your details. Please try again.",
      });
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword(event: React.FormEvent) {
    event.preventDefault();
    const local: Record<string, string> = {};
    if (!current) local.current = "Enter your current password.";
    if (next.length < 8 || !/[A-Za-z]/.test(next) || !/[0-9]/.test(next)) {
      local.next = "Use at least 8 characters, with a letter and a number.";
    }
    if (confirm !== next) local.confirm = "Passwords do not match.";
    setPwErrors(local);
    if (Object.keys(local).length > 0) return;

    setChangingPw(true);
    setPwStatus(null);
    try {
      await apiFetch("/auth/change-password", {
        method: "POST",
        body: { current, password: next },
      });
      setPwStatus({ tone: "success", message: "Your password has been changed. Other sessions have been signed out." });
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      setPwStatus({
        tone: "error",
        message: err instanceof ApiRequestError ? (Object.values(err.fields ?? {})[0] ?? err.message) : "Could not change your password.",
      });
    } finally {
      setChangingPw(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <SectionHeader title="Account & profile" description="Manage your personal details and password." />

      <Card className="p-5 sm:p-6">
        <div className="flex items-center gap-4 border-b border-brand-50 pb-4">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-brand-700 text-sm font-bold text-white">
            {form.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
          </span>
          <div>
            <p className="font-semibold text-ink-strong">{form.name}</p>
            <p className="text-sm text-ink-muted">
              {roleLabel(user!.role, user!.providerKind)} · {form.email}
            </p>
          </div>
        </div>

        <form onSubmit={saveProfile} className="mt-5 space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" htmlFor="pf-name" required>
              <Input id="pf-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Email address" htmlFor="pf-email" hint="Contact support to change your sign-in email.">
              <Input id="pf-email" value={form.email} disabled />
            </Field>
            <Field label="Phone number" htmlFor="pf-phone">
              <Input id="pf-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            {(user!.role === "PROVIDER") && (
              <Field label="Company name" htmlFor="pf-org">
                <Input id="pf-org" value={form.organisation} onChange={(e) => setForm({ ...form, organisation: e.target.value })} />
              </Field>
            )}
            <Field label="City" htmlFor="pf-city">
              <Input id="pf-city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </Field>
            {user!.role === "CLIENT" && (
              <>
                <Field label="Preferred state" htmlFor="pf-state">
                  <Select id="pf-state" value={form.preferredState} onChange={(e) => setForm({ ...form, preferredState: e.target.value, preferredRegion: "" })}>
                    <option value="Lagos">Lagos</option>
                    <option value="Enugu">Enugu</option>
                  </Select>
                </Field>
                {form.preferredState === "Lagos" && (
                  <Field label="Preferred area" htmlFor="pf-region">
                    <Select id="pf-region" value={form.preferredRegion} onChange={(e) => setForm({ ...form, preferredRegion: e.target.value })}>
                      <option value="">No preference</option>
                      <option value="Island">Island</option>
                      <option value="Mainland">Mainland</option>
                    </Select>
                  </Field>
                )}
                <label className="flex items-center gap-3 text-sm text-ink-soft sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={form.alertsEnabled}
                    onChange={(e) => setForm({ ...form, alertsEnabled: e.target.checked })}
                    className="h-4 w-4 rounded border-brand-200 text-brand-700"
                  />
                  Alert me when new listings match my preferences
                </label>
              </>
            )}
          </div>
          {profileStatus && <Alert tone={profileStatus.tone}>{profileStatus.message}</Alert>}
          <Button type="submit" loading={savingProfile}>
            Save changes
          </Button>
        </form>
      </Card>

      <Card className="p-5 sm:p-6">
        <SectionHeader title="Change password" description="Use a strong password you do not use elsewhere." />
        <form onSubmit={changePassword} className="space-y-4" noValidate>
          <Field label="Current password" htmlFor="pw-current" error={pwErrors.current} required>
            <Input id="pw-current" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="New password" htmlFor="pw-next" error={pwErrors.next} required>
              <Input id="pw-next" type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
            </Field>
            <Field label="Confirm new password" htmlFor="pw-confirm" error={pwErrors.confirm} required>
              <Input id="pw-confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
            </Field>
          </div>
          {pwStatus && <Alert tone={pwStatus.tone}>{pwStatus.message}</Alert>}
          <Button type="submit" loading={changingPw}>
            Update password
          </Button>
        </form>
      </Card>
    </div>
  );
}
