"use client";

/** Staff settings — platform office details (lawyers edit, support reads). */
import { useCallback, useEffect, useState } from "react";
import { apiFetch, ApiRequestError } from "@/lib/api";
import { toast } from "@/lib/toast";
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
  bankName: string;
  bankAccountName: string;
  bankAccountNumber: string;
  videoMaxMb: string;
  videoMaxDurationSec: string;
};

const EMPTY: Settings = {
  officeAddress: "",
  officePhone: "",
  officeEmail: "",
  officeHours: "",
  enquiryAcknowledgement: "",
  paymentDueDays: "7",
  bankName: "",
  bankAccountName: "",
  bankAccountNumber: "",
  videoMaxMb: "50",
  videoMaxDurationSec: "120",
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
            bankName: settings.bankName,
            bankAccountName: settings.bankAccountName,
            bankAccountNumber: settings.bankAccountNumber,
            videoMaxMb: Number(settings.videoMaxMb) || 50,
            videoMaxDurationSec: Number(settings.videoMaxDurationSec) || 120,
          },
        },
      });
      setNotice("Settings saved. Public pages reflect the new details immediately.");
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Could not save the settings.");
      toast.error(err instanceof ApiRequestError ? err.message : "Could not save the settings.");
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

          {/* Primary manual payment method — the platform's own account. */}
          <div className="rounded-xl border border-brand-100 bg-brand-50/40 p-4">
            <p className="text-sm font-semibold text-ink-strong">Bank transfer account</p>
            <p className="mt-1 text-xs text-ink-muted">
              The Elvictoria Attorneys and Solicitors account shown to a payer at the payment stage. Bank transfer is the
              primary method; card checkout remains available as the alternative.
            </p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <Field label="Bank name">
                <Input value={settings.bankName} onChange={(e) => set("bankName", e.target.value)} disabled={!canManage} />
              </Field>
              <Field label="Account name">
                <Input value={settings.bankAccountName} onChange={(e) => set("bankAccountName", e.target.value)} disabled={!canManage} />
              </Field>
            </div>
            <Field label="Account number">
              <Input
                inputMode="numeric"
                value={settings.bankAccountNumber}
                onChange={(e) => set("bankAccountNumber", e.target.value.replace(/[^0-9 ]/g, ""))}
                disabled={!canManage}
                className="w-56"
              />
            </Field>
          </div>

          {/* Listing media limits — applied to every lister's uploads. */}
          <div className="rounded-xl border border-brand-100 bg-brand-50/40 p-4">
            <p className="text-sm font-semibold text-ink-strong">Listing media limits</p>
            <p className="mt-1 text-xs text-ink-muted">
              Applied to the optional walkthrough video every lister can attach to a listing. Photos keep a fixed
              5 MB per-file limit.
            </p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <Field label="Max video size (MB)">
                <Input
                  inputMode="numeric"
                  value={settings.videoMaxMb}
                  onChange={(e) => set("videoMaxMb", e.target.value.replace(/[^0-9]/g, ""))}
                  disabled={!canManage}
                />
              </Field>
              <Field label="Max video duration (seconds)">
                <Input
                  inputMode="numeric"
                  value={settings.videoMaxDurationSec}
                  onChange={(e) => set("videoMaxDurationSec", e.target.value.replace(/[^0-9]/g, ""))}
                  disabled={!canManage}
                />
              </Field>
            </div>
          </div>

          {notice && <Alert tone="success">{notice}</Alert>}
          {error && <Alert tone="error">{error}</Alert>}

          {canManage && (
            <Button type="submit" loading={saving}>
              Save settings
            </Button>
          )}
        </form>
      </Card>

      {/* Admin-managed listing taxonomy — lawyers can add new types without a deploy. */}
      {canManage && <PropertyTypesManager />}
    </div>
  );
}

type PropertyTypeRow = { id: string; name: string; active: boolean; sortOrder: number };

function PropertyTypesManager() {
  const [types, setTypes] = useState<PropertyTypeRow[] | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await apiFetch<{ types: PropertyTypeRow[] }>("/properties/types/all").catch(() => null);
    setTypes(data?.types ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function addType(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await apiFetch("/properties/types", { method: "POST", body: { name: name.trim() } });
      setNotice(`"${name.trim()}" added. It now appears in listing forms and search filters.`);
      setName("");
      await load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Could not add the property type.");
      toast.error(err instanceof ApiRequestError ? err.message : "Could not add the property type.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(type: PropertyTypeRow) {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/properties/types/${type.id}`, { method: "PATCH", body: { active: !type.active } });
      await load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Could not update the property type.");
      toast.error(err instanceof ApiRequestError ? err.message : "Could not update the property type.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mt-6 p-5 sm:p-6">
      <SectionHeader
        title="Property types"
        description="The listing taxonomy used in provider forms and public search filters."
      />

      <form onSubmit={addType} className="mt-4 flex flex-wrap items-end gap-3" noValidate>
        <Field label="New property type">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Serviced Apartment" className="w-64" />
        </Field>
        <Button type="submit" loading={busy} disabled={!name.trim()}>Add type</Button>
      </form>

      {notice && <div className="mt-3"><Alert tone="success">{notice}</Alert></div>}
      {error && <div className="mt-3"><Alert tone="error">{error}</Alert></div>}

      {types === null ? (
        <PageLoader />
      ) : (
        <ul className="mt-4 divide-y divide-brand-50">
          {types.map((type) => (
            <li key={type.id} className="flex items-center justify-between gap-3 py-2.5">
              <span className="text-sm font-medium text-ink-strong">{type.name}</span>
              <Button variant="outline" size="sm" onClick={() => void toggleActive(type)} disabled={busy}>
                {type.active ? "Deactivate" : "Activate"}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-ink-muted">
        Deactivating a type hides it from new forms and filters. Existing listings keep their type.
      </p>
    </Card>
  );
}
