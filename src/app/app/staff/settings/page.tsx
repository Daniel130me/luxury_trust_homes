"use client";

/** Staff settings — platform office details (lawyers edit, support reads). */
import { useEffect, useState } from "react";
import { apiFetch, ApiRequestError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  Alert, Button, Card, Field, Input, PageLoader, SectionHeader, Textarea,
} from "@/components/platform/ui-bits";

type Settings = {
  officeAddress: string;
  officePhone: string;
  officeEmail: string;
  officeHours: string;
  enquiryAcknowledgement: string;
  paymentDueDays: string;
};

const EMPTY: Settings = {
  officeAddress: "",
  officePhone: "",
  officeEmail: "",
  officeHours: "",
  enquiryAcknowledgement: "",
  paymentDueDays: "7",
};

export default function StaffSettingsPage() {
  const { user } = useAuth();
  const canManage = user?.role === "LAWYER";

  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ settings: Record<string, string> }>("/settings")
      .then((d) => setSettings({ ...EMPTY, ...d.settings }))
      .catch(() => setSettings(EMPTY));
  }, []);

  if (!settings) return <PageLoader />;

  function set<K extends keyof Settings>(key: K, value: string) {
    setSettings((s) => (s ? ({ ...s, [key]: value } as Settings) : s));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!canManage || !settings) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await apiFetch("/settings", {
        method: "PUT",
        body: {
          settings: {
            officeAddress: settings.officeAddress,
            officePhone: settings.officePhone,
            officeEmail: settings.officeEmail,
            officeHours: settings.officeHours,
            enquiryAcknowledgement: settings.enquiryAcknowledgement,
            paymentDueDays: Number(settings.paymentDueDays) || 7,
          },
        },
      });
      setNotice("Settings saved. Public pages reflect the new details immediately.");
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Could not save the settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <SectionHeader
        title="Settings"
        description={
          canManage
            ? "Platform-wide details shown on the public site and used in workflows."
            : "Platform-wide details (read-only for support staff)."
        }
      />

      <Card className="p-5 sm:p-6">
        <form onSubmit={save} className="space-y-4" noValidate>
          <Field label="Office address">
            <Input value={settings.officeAddress} onChange={(e) => set("officeAddress", e.target.value)} disabled={!canManage} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Office phone">
              <Input value={settings.officePhone} onChange={(e) => set("officePhone", e.target.value)} disabled={!canManage} />
            </Field>
            <Field label="Office email">
              <Input type="email" value={settings.officeEmail} onChange={(e) => set("officeEmail", e.target.value)} disabled={!canManage} />
            </Field>
          </div>
          <Field label="Office hours">
            <Input value={settings.officeHours} onChange={(e) => set("officeHours", e.target.value)} disabled={!canManage} />
          </Field>
          <Field label="Enquiry acknowledgement" hint="Shown to clients right after they submit an enquiry.">
            <Textarea rows={2} value={settings.enquiryAcknowledgement} onChange={(e) => set("enquiryAcknowledgement", e.target.value)} disabled={!canManage} />
          </Field>
          <Field label="Payment due days" hint="Default window lawyers apply when raising a payment request.">
            <Input
              inputMode="numeric"
              value={settings.paymentDueDays}
              onChange={(e) => set("paymentDueDays", e.target.value.replace(/[^0-9]/g, ""))}
              disabled={!canManage}
              className="w-28"
            />
          </Field>

          {notice && <Alert tone="success">{notice}</Alert>}
          {error && <Alert tone="error">{error}</Alert>}

          {canManage && (
            <Button type="submit" loading={saving}>
              Save settings
            </Button>
          )}
        </form>
      </Card>
    </div>
  );
}
