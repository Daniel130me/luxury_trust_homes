"use client";

/**
 * Public property detail — photo gallery with thumbnails, details table,
 * features, and the enquiry panel. Signed-in clients get the enquiry form;
 * visitors are invited to sign in (prototype behaviour).
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { apiFetch, ApiRequestError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  AVAILABILITY_LABELS, categoryLabel, PURPOSE_LABELS, formatDateTime, formatNaira,
} from "@/lib/format";
import {
  Alert, Button, Card, EmptyState, Field, Input, PageLoader, Select, Textarea,
  Badge, ChevronLeftIcon, ChevronRightIcon, HeartIcon, TrustPanel,
} from "@/components/platform/ui-bits";

type Property = {
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
  availability: string;
  cautionDeposit?: number | null;
  serviceCharge?: number | null;
  images: Array<{ id: string; url: string; label: string }>;
  videoUrl?: string | null;
  videoBytes?: number | null;
  videoDurationSec?: number | null;
  createdAt: string;
};

export default function PropertyDetailPage() {
  const { reference } = useParams<{ reference: string }>();
  const router = useRouter();
  const params = useSearchParams();
  const { user } = useAuth();

  const [property, setProperty] = useState<Property | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedChecked, setSavedChecked] = useState(false);

  // Enquiry form state
  const [enquiryOpen, setEnquiryOpen] = useState(params.get("enquire") === "1");
  const [purpose, setPurpose] = useState("PURCHASE");
  const [contactMethod, setContactMethod] = useState("PHONE");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [enquiryError, setEnquiryError] = useState<string | null>(null);
  const [enquiryDone, setEnquiryDone] = useState(false);

  useEffect(() => {
    apiFetch<{ property: Property }>(`/properties/${reference}`)
      .then((d) => setProperty(d.property))
      .catch(() => setNotFound(true));
  }, [reference]);

  // Saved state (only meaningful for signed-in users).
  useEffect(() => {
    if (!user) {
      setSavedChecked(true);
      return;
    }
    apiFetch<{ properties: Array<{ id: string }> }>("/saved")
      .then((d) => {
        setSaved(d.properties.some((p) => p.id === property?.id));
        setSavedChecked(true);
      })
      .catch(() => setSavedChecked(true));
  }, [user, property?.id]);

  if (notFound) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <EmptyState
          title="Property not found"
          description="The page you are looking for does not exist, has moved, or the listing is no longer available."
          action={
            <Link href="/properties">
              <Button>Return to properties</Button>
            </Link>
          }
        />
      </main>
    );
  }

  if (!property) return <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6"><PageLoader label="Loading property…" /></main>;

  const photos = property.images;

  // Big overlay button (TikTok/YouTube style): tap to start, fades away
  // while playing and comes back when paused. The native controls remain
  // for seeking, volume and fullscreen.
  async function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (video.paused) await video.play();
      else video.pause();
    } catch {
      // play() can reject if the browser blocks it; the native controls
      // still work, so there is nothing to recover here.
    }
  }

  async function toggleSave() {
    if (!user) {
      router.push(`/login?next=/properties/${property!.reference}`);
      return;
    }
    if (saved) {
      await apiFetch(`/saved/${property!.id}`, { method: "DELETE" }).catch(() => undefined);
      setSaved(false);
      return;
    }
    await apiFetch("/saved", { method: "POST", body: { propertyId: property!.id } }).catch(() => undefined);
    setSaved(true);
  }

  async function submitEnquiry(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setEnquiryError(null);
    try {
      await apiFetch("/enquiries", {
        method: "POST",
        body: { propertyId: property!.id, purpose, contactMethod, message },
      });
      setEnquiryDone(true);
    } catch (err) {
      setEnquiryError(
        err instanceof ApiRequestError
          ? (Object.values(err.fields ?? {})[0] ?? err.message)
          : "Could not submit the enquiry. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <Link href="/properties" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-brand-700">
        <ChevronLeftIcon className="h-4 w-4" />
        All properties
      </Link>

      <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_360px]">
        {/* ------------------------------------------------------ gallery */}
        <div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-100">
            {photos[photoIndex] ? (
               
              <img
                src={photos[photoIndex].url}
                alt={photos[photoIndex].label}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="grid h-full place-items-center text-sm text-ink-muted">No photograph yet</div>
            )}
            {photos.length > 1 && (
              <>
                <button
                  onClick={() => setPhotoIndex((photoIndex - 1 + photos.length) % photos.length)}
                  aria-label="Previous photo"
                  className="absolute left-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink-soft shadow hover:bg-white"
                >
                  <ChevronLeftIcon className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setPhotoIndex((photoIndex + 1) % photos.length)}
                  aria-label="Next photo"
                  className="absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink-soft shadow hover:bg-white"
                >
                  <ChevronRightIcon className="h-5 w-5" />
                </button>
                <span className="absolute bottom-3 right-3 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white">
                  {photos[photoIndex]?.label} · {photoIndex + 1}/{photos.length}
                </span>
              </>
            )}
          </div>
          {photos.length > 1 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {photos.map((photo, index) => (
                <button
                  key={photo.id}
                  onClick={() => setPhotoIndex(index)}
                  aria-label={`Show ${photo.label}`}
                  className={`h-16 w-24 overflow-hidden rounded-lg border-2 transition-colors ${
                    index === photoIndex ? "border-brand-700" : "border-transparent hover:border-brand-200"
                  }`}
                >
                  { }
                  <img src={photo.url} alt={photo.label} className="h-full w-full object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          )}

          {/* Video walkthrough — optional, uploaded by the lister */}
          {property.videoUrl && (
            <section className="mt-8">
              <h2 className="text-lg font-semibold text-ink-strong">Video walkthrough</h2>
              <div className="relative mt-3">
                <video
                  ref={videoRef}
                  src={property.videoUrl}
                  controls
                  preload="metadata"
                  playsInline
                  className="aspect-video w-full rounded-xl bg-black"
                  data-testid="public-listing-video"
                  onPlay={() => setPlaying(true)}
                  onPause={() => setPlaying(false)}
                  onEnded={() => setPlaying(false)}
                />
                <button
                  type="button"
                  onClick={togglePlay}
                  aria-label={playing ? "Pause video" : "Play video"}
                  className={`absolute left-1/2 top-1/2 z-10 grid h-20 w-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/60 text-white shadow-lg backdrop-blur transition-all duration-200 hover:bg-black/75 sm:h-24 sm:w-24 ${
                    playing ? "scale-75 opacity-0" : "scale-100 opacity-100"
                  }`}
                >
                  {playing ? (
                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-9 w-9 sm:h-10 sm:w-10" aria-hidden>
                      <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="currentColor" className="-ml-1 h-9 w-9 sm:h-10 sm:w-10" aria-hidden>
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </section>
          )}

          {/* ------------------------------------------------------ body */}
          <div className="mt-6 grid gap-8 md:grid-cols-[1fr_1fr]">
            <section>
              <h2 className="text-lg font-semibold text-ink-strong">About this property</h2>
              <p className="mt-2 whitespace-pre-line leading-relaxed text-ink-soft">{property.description}</p>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-ink-strong">Features</h2>
              <ul className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {property.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm text-ink-soft">
                    <span className="h-1.5 w-1.5 rounded-full bg-brand-500" aria-hidden />
                    {feature}
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <section className="mt-8">
            <h2 className="text-lg font-semibold text-ink-strong">Property details</h2>
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl border border-brand-100/80 bg-white p-5 sm:grid-cols-3">
              <Detail term="Reference" value={property.reference} />
              <Detail term="Type" value={categoryLabel(property.category)} />
              <Detail term="Listing" value={property.listingType === "SALE" ? "For sale" : "For rent"} />
              <Detail term="Availability" value={AVAILABILITY_LABELS[property.availability] ?? property.availability} />
              {property.beds != null && <Detail term="Bedrooms" value={String(property.beds)} />}
              {property.baths != null && <Detail term="Bathrooms" value={String(property.baths)} />}
              {property.toilets != null && <Detail term="Toilets" value={String(property.toilets)} />}
              {property.sqm != null && <Detail term="Size" value={`${property.sqm.toLocaleString("en-NG")} sqm`} />}
              {property.parking != null && <Detail term="Parking" value={`${property.parking} spaces`} />}
              {property.furnishing && <Detail term="Furnishing" value={property.furnishing} />}
              <Detail term="State" value={property.region ? `${property.state} · ${property.region}` : property.state} />
              <Detail term="LGA" value={property.lga} />
              <Detail term="Area" value={property.area} />
              <Detail term="Listed" value={formatDateTime(property.createdAt).split(",")[0]} />
              {property.serviceCharge != null && <Detail term="Service charge" value={formatNaira(property.serviceCharge)} />}
              {property.cautionDeposit != null && <Detail term="Caution deposit" value={formatNaira(property.cautionDeposit)} />}
            </dl>
          </section>
        </div>

        {/* ------------------------------------------------------ sidebar */}
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card className="p-5">
            <p className="text-sm text-ink-muted">Asking price</p>
            <p className="mt-1 text-2xl font-bold text-ink-strong">
              {formatNaira(property.price)}
              {property.listingType === "RENT" && <span className="text-sm font-medium text-ink-muted"> / year</span>}
            </p>
            <p className="mt-1 text-xs text-ink-muted">Ref. {property.reference}</p>

            <button
              onClick={() => (user ? setEnquiryOpen(true) : router.push(`/login?next=/properties/${property.reference}`))}
              className="mt-4 w-full rounded-lg bg-brand-700 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-800"
            >
              Enquire About This Property
            </button>
            {!user && (
              <p className="mt-2.5 text-center text-sm text-ink-muted">
                Sign in or{" "}
                <Link href={`/register?next=/properties/${property.reference}`} className="font-semibold text-brand-700">
                  create a free account
                </Link>{" "}
                to submit your enquiry.
              </p>
            )}

            <button
              onClick={toggleSave}
              className={`mt-3 flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                saved ? "border-brand-700 bg-brand-50 text-brand-700" : savedChecked ? "border-brand-100 text-ink-soft hover:border-brand-300 hover:text-brand-700" : "border-brand-100 text-ink-soft"
              }`}
            >
              <HeartIcon className="h-4 w-4" filled={saved} />
              {saved ? "Saved" : "Save Property"}
            </button>
          </Card>
          <TrustPanel />
        </aside>
      </div>

      {/* ------------------------------------------------- enquiry modal */}
      {enquiryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal aria-label="Enquire about this property">
          <Card className="w-full max-w-lg p-6">
            {enquiryDone ? (
              <div className="space-y-3 text-center">
                <Badge tone="bg-emerald-50 text-emerald-700">Enquiry submitted</Badge>
                <h3 className="font-serif text-xl text-ink-strong">Thank you.</h3>
                <p className="text-sm leading-relaxed text-ink-soft">
                  A member of our legal team will review it shortly. You can follow every step under{" "}
                  <Link href="/app/client/enquiries" className="font-semibold text-brand-700">My Enquiries</Link>.
                </p>
                <Button onClick={() => router.push("/app/client/enquiries")}>Go to my enquiries</Button>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-serif text-xl text-ink-strong">Enquire about this property</h3>
                    <p className="mt-0.5 text-sm text-ink-muted">
                      {property.title} · {property.reference}
                    </p>
                  </div>
                  <button onClick={() => setEnquiryOpen(false)} aria-label="Close" className="text-ink-muted hover:text-ink-strong">
                    ✕
                  </button>
                </div>
                <form onSubmit={submitEnquiry} className="mt-4 space-y-4">
                  <Field label="Purpose" required>
                    <Select value={purpose} onChange={(e) => setPurpose(e.target.value)} aria-label="Purpose">
                      {Object.entries(PURPOSE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Preferred contact method" required>
                    <Select value={contactMethod} onChange={(e) => setContactMethod(e.target.value)} aria-label="Preferred contact method">
                      <option value="PHONE">Phone call</option>
                      <option value="EMAIL">Email</option>
                      <option value="PLATFORM">Messages in the platform</option>
                    </Select>
                  </Field>
                  <Field
                    label="Message"
                    required
                    hint="Share your timing, budget or questions for the legal team."
                  >
                    <Textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      required
                      minLength={20}
                      aria-label="Message"
                    />
                  </Field>
                  {enquiryError && <Alert tone="error">{enquiryError}</Alert>}
                  <div className="flex justify-end gap-3">
                    <Button type="button" variant="outline" onClick={() => setEnquiryOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" loading={submitting}>
                      Submit enquiry
                    </Button>
                  </div>
                </form>
              </>
            )}
          </Card>
        </div>
      )}
    </main>
  );
}

function Detail({ term, value }: { term: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">{term}</dt>
      <dd className="mt-0.5 text-sm font-medium text-ink-strong">{value}</dd>
    </div>
  );
}
