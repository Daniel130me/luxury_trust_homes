"use client";

/** Staff listing review — full detail with approve / request changes / reject. */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { apiFetch, ApiRequestError } from "@/lib/api";
import { toast } from "@/lib/toast";
import { useAuth } from "@/lib/auth";
import {
  AVAILABILITY_LABELS, categoryLabel, PROPERTY_STATUS_LABELS, formatDateTime, formatNaira,
} from "@/lib/format";
import {
  Alert, Button, Card, PageLoader, StatusBadge, Textarea, ChevronLeftIcon,
} from "@/components/platform/ui-bits";

type ListingDetail = {
  id: string;
  reference: string;
  title: string;
  category: string;
  listingType: string;
  price: number;
  state: string;
  region?: string | null;
  lga: string;
  area: string;
  address: string;
  beds?: number | null;
  baths?: number | null;
  toilets?: number | null;
  sqm?: number | null;
  parking?: number | null;
  furnishing?: string | null;
  description: string;
  features: string[];
  videoUrl?: string | null;
  status: string;
  availability: string;
  feedback?: string | null;
  cautionDeposit?: number | null;
  serviceCharge?: number | null;
  images: Array<{ id: string; url: string; label: string }>;
  provider: { id: string; name: string; email: string; phone?: string | null; organisation?: string | null };
  history: Array<{ id: string; at: string; action: string; note?: string | null; actor?: { name?: string } | null }>;
  createdAt: string;
};

export default function StaffListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const canModerate = user?.role === "LAWYER";

  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [missing, setMissing] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ property: ListingDetail }>(`/staff/listings/${id}`);
      setListing(data.property);
    } catch {
      setMissing(true);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function review(action: "approve" | "request_changes" | "reject") {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/staff/listings/${id}/review`, { method: "POST", body: { action, note } });
      setNote("");
      setNotice(
        action === "approve"
          ? "Listing approved and published."
          : action === "request_changes"
            ? "Changes requested — the provider has been notified."
            : "Listing rejected — the provider has been notified.",
      );
      await load();
    } catch (err) {
      const message = err instanceof ApiRequestError ? err.message : "Could not record the review.";
      toast.error(message);
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  /** Lawyers are the platform administrators: suspend / archive / restore
   *  works on any listing from any state. The note doubles as the reason. */
  async function adminStatus(action: "suspend" | "reactivate" | "archive" | "unarchive") {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/staff/listings/${id}/status`, { method: "POST", body: { action, note: note || undefined } });
      setArchiveOpen(false);
      setNote("");
      const pastTense: Record<string, string> = {
        suspend: "suspended",
        reactivate: "reactivated",
        archive: "archived",
        unarchive: "restored",
      };
      toast.success(`Listing ${pastTense[action]} — provider notified.`);
      setNotice(`Listing ${pastTense[action]} — the provider has been notified.`);
      await load();
    } catch (err) {
      const message = err instanceof ApiRequestError ? err.message : "Could not update the listing.";
      toast.error(message);
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  /** Availability (available / under offer / unavailable) applies to any
   *  listing at any time, independent of the review flow. */
  async function changeAvailability(availability: string) {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/staff/listings/${id}/availability`, { method: "POST", body: { availability } });
      toast.success(`Availability set to ${AVAILABILITY_LABELS[availability]}.`);
      await load();
    } catch (err) {
      const message = err instanceof ApiRequestError ? err.message : "Could not change availability.";
      toast.error(message);
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  if (missing) {
    return <div className="mx-auto max-w-2xl py-16 text-center"><p className="font-medium text-ink-strong">Listing not found.</p></div>;
  }
  if (!listing) return <PageLoader />;

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/app/staff/listings" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-brand-700">
        <ChevronLeftIcon className="h-4 w-4" />
        Listings
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <StatusBadge status={listing.status} label={PROPERTY_STATUS_LABELS[listing.status]} />
        <p className="text-sm text-ink-muted">{listing.reference}</p>
      </div>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{listing.title}</h1>
      <p className="mt-1 text-sm text-ink-muted">
        {listing.provider.name}
        {listing.provider.organisation ? ` · ${listing.provider.organisation}` : ""} · {listing.provider.email}
        {listing.provider.phone ? ` · ${listing.provider.phone}` : ""}
      </p>

      {notice && <div className="mt-4"><Alert tone="success">{notice}</Alert></div>}
      {error && <div className="mt-4"><Alert tone="error">{error}</Alert></div>}

      {listing.images.length > 0 && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {listing.images.map((image, index) => (
            <div key={image.id} className="relative">
              { }
              <img src={image.url} alt={image.label} className="aspect-[4/3] w-full rounded-lg object-cover" loading="lazy" />
              {index === 0 && (
                <span className="absolute left-2 top-2 rounded-full bg-brand-700 px-2 py-0.5 text-[10px] font-bold text-white">Cover</span>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="p-5">
          <h2 className="text-lg font-semibold text-ink-strong">About this property</h2>
          <p className="mt-2 whitespace-pre-line leading-relaxed text-ink-soft">{listing.description}</p>
          {listing.features.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-ink-strong">Features</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {listing.features.map((feature) => (
                  <span
                    key={feature}
                    className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-ink-soft ring-1 ring-brand-200"
                  >
                    {feature}
                  </span>
                ))}
              </div>
            </div>
          )}
          {listing.videoUrl && (
            <div className="mt-4">
              <p className="text-sm font-medium text-ink-strong">Video walkthrough</p>
              <video src={listing.videoUrl} controls className="mt-2 max-h-72 w-full rounded-lg bg-black" />
            </div>
          )}
          <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
            <Detail term="Type" value={categoryLabel(listing.category)} />
            <Detail term="Listing" value={listing.listingType === "SALE" ? "For sale" : "For rent"} />
            <Detail term="Availability" value={AVAILABILITY_LABELS[listing.availability]} />
            <Detail term="Location" value={`${listing.area}, ${listing.lga}, ${listing.state}${listing.region ? ` (${listing.region})` : ""}`} />
            <Detail term="Address" value={listing.address} />
            {listing.beds != null && <Detail term="Bedrooms" value={String(listing.beds)} />}
            {listing.baths != null && <Detail term="Bathrooms" value={String(listing.baths)} />}
            {listing.toilets != null && <Detail term="Toilets" value={String(listing.toilets)} />}
            {listing.sqm != null && <Detail term="Size" value={`${listing.sqm.toLocaleString("en-NG")} sqm`} />}
            {listing.parking != null && <Detail term="Parking" value={`${listing.parking} spaces`} />}
            {listing.furnishing && <Detail term="Furnishing" value={listing.furnishing} />}
            <Detail term="Submitted" value={formatDateTime(listing.createdAt)} />
          </dl>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <p className="text-sm text-ink-muted">Asking price</p>
            <p className="mt-1 text-xl font-bold text-ink-strong">{formatNaira(listing.price)}</p>
            {listing.serviceCharge != null && <p className="mt-1 text-xs text-ink-muted">Service charge: {formatNaira(listing.serviceCharge)}</p>}
            {listing.cautionDeposit != null && <p className="mt-1 text-xs text-ink-muted">Caution deposit: {formatNaira(listing.cautionDeposit)}</p>}
          </Card>

          {canModerate && (
            <Card className="p-5">
              <h2 className="text-sm font-semibold text-ink-strong">Review decision</h2>
              <Textarea
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Feedback for the provider (required for changes / rejection)"
                aria-label="Review note"
                className="mt-3"
              />
              <div className="mt-3 grid gap-2">
                <Button onClick={() => void review("approve")} loading={busy} disabled={listing.status === "APPROVED"}>
                  Approve and publish
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void review("request_changes")}
                  loading={busy}
                  disabled={!note.trim() || listing.status === "CHANGES_REQUESTED"}
                >
                  Request changes
                </Button>
                <Button variant="danger" onClick={() => void review("reject")} loading={busy} disabled={!note.trim() || listing.status === "REJECTED"}>
                  Reject listing
                </Button>
              </div>
            </Card>
          )}

          <Card className="p-5">
            <h2 className="text-sm font-semibold text-ink-strong">Admin controls</h2>
            <p className="mt-1 text-xs text-ink-muted">
              Full control on any listing — every change notifies the provider and is audit-logged.
            </p>
            <div className="mt-3 grid gap-2">
              <Button variant="outline" onClick={() => router.push(`/app/staff/listings/${id}/edit`)}>
                Edit listing
              </Button>
              {listing.status === "SUSPENDED" ? (
                <Button variant="outline" onClick={() => void adminStatus("reactivate")} loading={busy}>
                  Reactivate listing
                </Button>
              ) : (
                <Button variant="outline" onClick={() => void adminStatus("suspend")} loading={busy} disabled={listing.status === "ARCHIVED"}>
                  Suspend listing
                </Button>
              )}
              {listing.status === "ARCHIVED" ? (
                <Button variant="outline" onClick={() => void adminStatus("unarchive")} loading={busy}>
                  Restore listing (undo archive)
                </Button>
              ) : (
                <Button variant="danger" onClick={() => setArchiveOpen(true)} disabled={busy}>
                  Archive…
                </Button>
              )}
            </div>
            <label className="mt-3 block text-xs font-medium text-ink-muted">
              Availability
              <select
                value={listing.availability}
                onChange={(e) => void changeAvailability(e.target.value)}
                disabled={busy}
                className="mt-1 w-full rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm font-medium text-ink-strong"
              >
                {["AVAILABLE", "UNDER_OFFER", "UNAVAILABLE"].map((a) => (
                  <option key={a} value={a}>{AVAILABILITY_LABELS[a]}</option>
                ))}
              </select>
            </label>
            {listing.status === "ARCHIVED" && (
              <p className="mt-2 text-xs text-red-700">
                Archived — hidden from the marketplace and scheduled for permanent deletion 20 days after archiving.
              </p>
            )}
          </Card>

          <Card className="p-5">
            <h3 className="text-sm font-semibold text-ink-strong">History</h3>
            <ol className="mt-3 space-y-2.5">
              {listing.history.map((entry) => (
                <li key={entry.id} className="text-xs text-ink-muted">
                  <p className="font-medium capitalize text-ink-strong">{entry.action.replace(/_/g, " ")}</p>
                  <p>{formatDateTime(entry.at)}{entry.actor?.name ? ` · ${entry.actor.name}` : ""}</p>
                  {entry.note && <p className="italic">&ldquo;{entry.note}&rdquo;</p>}
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>

      {/* ---------------------------------------- archive confirmation */}
      {archiveOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal aria-label="Confirm archive">
          <Card className="w-full max-w-md p-6">
            <h2 className="font-display text-xl text-ink-strong">Archive this listing?</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              {listing.reference} — {listing.title} will be hidden from the marketplace immediately and permanently
              deleted 20 days from now unless restored. Listings tied to enquiries or transaction cases are kept
              archived for the legal record instead of being deleted.
            </p>
            <div className="mt-4 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setArchiveOpen(false)}>Cancel</Button>
              <Button variant="danger" onClick={() => void adminStatus("archive")} loading={busy}>
                Archive listing
              </Button>
            </div>
          </Card>
        </div>
      )}
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
