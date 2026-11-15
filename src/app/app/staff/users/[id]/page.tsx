"use client";

/** Staff user detail — profile, role, activity counts and actions. */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiFetch, ApiRequestError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import {
  Alert, Badge, Button, Card, PageLoader, ChevronLeftIcon,
} from "@/components/platform/ui-bits";

type UserDetail = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  status: string;
  providerKind?: string | null;
  clientKind?: string | null;
  organisation?: string | null;
  city?: string | null;
  preferredState?: string | null;
  interest?: string | null;
  registeredAt: string;
  lastActiveAt?: string | null;
  _count: { properties: number; clientCases: number; assignedCases: number; tickets: number };
};

export default function StaffUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user: me } = useAuth();
  const canManage = me?.role === "LAWYER";

  const [user, setUser] = useState<UserDetail | null>(null);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ user: UserDetail }>(`/users/${id}`)
      .then((d) => setUser(d.user))
      .catch(() => setMissing(true));
  }, [id]);

  async function toggleStatus() {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/users/${id}/status`, {
        method: "PATCH",
        body: { status: user.status === "ACTIVE" ? "DEACTIVATED" : "ACTIVE" },
      });
      setNotice(user.status === "ACTIVE" ? "Account deactivated — all sessions revoked." : "Account reactivated.");
      const data = await apiFetch<{ user: UserDetail }>(`/users/${id}`);
      setUser(data.user);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Could not update the account.");
    } finally {
      setBusy(false);
    }
  }

  if (missing) {
    return <div className="mx-auto max-w-2xl py-16 text-center"><p className="font-medium text-ink-strong">User not found.</p></div>;
  }
  if (!user) return <PageLoader />;

  const ROLE_LABELS: Record<string, string> = {
    LAWYER: "Lawyer / Administrator",
    SUPPORT: "Support staff",
    PROVIDER: "Property provider",
    CLIENT: "Buyer / Renter",
  };

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/app/staff/users" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-brand-700">
        <ChevronLeftIcon className="h-4 w-4" />
        Users
      </Link>

      <div className="mt-3 flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-brand-700 text-sm font-bold text-white">
          {user.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{user.name}</h1>
          <p className="text-sm text-ink-muted">{ROLE_LABELS[user.role]} · {user.email}</p>
        </div>
        <Badge tone={user.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}>
          {user.status === "ACTIVE" ? "Active" : "Deactivated"}
        </Badge>
      </div>

      {notice && <div className="mt-4"><Alert tone="success">{notice}</Alert></div>}
      {error && <div className="mt-4"><Alert tone="error">{error}</Alert></div>}

      <Card className="mt-6 p-5 sm:p-6">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
          <Detail term="Phone" value={user.phone ?? "—"} />
          <Detail term="Organisation" value={user.organisation ?? "—"} />
          <Detail term="City" value={user.city ?? "—"} />
          <Detail term="Preferred state" value={user.preferredState ?? "—"} />
          <Detail term="Interest" value={user.interest ? user.interest.toLowerCase() : "—"} />
          <Detail term="Registered" value={formatDate(user.registeredAt)} />
          <Detail term="Last active" value={user.lastActiveAt ? formatDate(user.lastActiveAt) : "—"} />
        </dl>
        {canManage && user.role !== "LAWYER" && user.id !== me?.id && (
          <Button
            className="mt-5"
            variant={user.status === "ACTIVE" ? "danger" : "outline"}
            onClick={() => void toggleStatus()}
            loading={busy}
          >
            {user.status === "ACTIVE" ? "Deactivate account" : "Reactivate account"}
          </Button>
        )}
      </Card>

      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-ink-strong">{user._count.properties}</p>
          <p className="text-xs text-ink-muted">Listings</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-ink-strong">{user._count.clientCases}</p>
          <p className="text-xs text-ink-muted">Cases as client</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-ink-strong">{user._count.assignedCases}</p>
          <p className="text-xs text-ink-muted">Cases as lawyer</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-ink-strong">{user._count.tickets}</p>
          <p className="text-xs text-ink-muted">Tickets</p>
        </Card>
      </div>
    </div>
  );
}

function Detail({ term, value }: { term: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">{term}</dt>
      <dd className="mt-0.5 font-medium text-ink-strong">{value}</dd>
    </div>
  );
}
