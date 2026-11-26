"use client";

/**
 * Property listing form — used by providers to create and edit listings,
 * and by staff (lawyers) for administrative edits.
 *
 * Layout, top to bottom: the basics → photos & video → location →
 * description → optional extra details (collapsed). Only the asking price
 * is collected; no other amounts (caution deposit, service charge).
 *
 * Media is added while filling in the form. For a new listing the files
 * wait in the browser; pressing Save/Submit creates the listing as a draft,
 * uploads the files, and only then submits it for review — so the legal
 * team receives the listing complete with its photos. If an upload fails,
 * the provider stays on the page with the draft saved and can retry.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiRequestError } from "@/lib/api";
import { toast } from "@/lib/toast";
import { formatNaira } from "@/lib/format";
import { usePropertyTypes } from "@/lib/property-types";
import { STATES, lgasFor, areasFor, OTHER_OPTION } from "@/lib/nigeria-geo";
import { useVideoLimits } from "@/lib/listing-media";
import { useListingMedia, type StoredImage } from "@/lib/use-listing-media";
import { ListingMediaPicker } from "@/components/platform/listing-media-picker";
import {
  Alert, Button, Card, Field, Input, PageLoader, Select, Textarea, ChevronLeftIcon,
} from "@/components/platform/ui-bits";

export type PropertyFormValues = {
  id?: string;
  title: string;
  category: string;
  listingType: "SALE" | "RENT";
  price: string;
  availability: string;
  state: string;
  region: string;
  lga: string;
  area: string;
  address: string;
  beds: string;
  baths: string;
  toilets: string;
  sqm: string;
  parking: string;
  furnishing: string;
  description: string;
  features: string[];
  status?: string;
  feedback?: string | null;
};

export const EMPTY_FORM: PropertyFormValues = {
  title: "",
  category: "",
  listingType: "SALE",
  price: "",
  availability: "AVAILABLE",
  state: "",
  region: "",
  lga: "",
  area: "",
  address: "",
  beds: "",
  baths: "",
  toilets: "",
  sqm: "",
  parking: "",
  furnishing: "",
  description: "",
  features: [],
};

const COMMON_FEATURES = [
  "Ensuite bedrooms", "Fitted kitchen", "24-hour security", "Gated estate",
  "Standby generator", "Borehole water", "Swimming pool", "Serviced estate",
  "Interlocked compound", "Boys’ quarters", "Walk-in closet", "Balcony",
  "Air conditioning", "POP ceilings", "CCTV", "Elevator",
];

/** Minimum lengths — the backend rejects anything shorter. */
const MIN_TITLE_LENGTH = 8;
const MIN_DESCRIPTION_LENGTH = 60;
const MAX_CUSTOM_FEATURE_LENGTH = 60;

/** Provider can no longer change listings in these states (mirrors the backend). */
const LOCKED_STATUSES = ["REJECTED", "SUSPENDED", "ARCHIVED"];

/** Optional numeric details, shown in the collapsed "More details" group. */
const NUMBER_DETAILS: Array<[keyof PropertyFormValues, string]> = [
  ["beds", "Bedrooms"], ["baths", "Bathrooms"], ["toilets", "Toilets"],
  ["sqm", "Size (sqm)"], ["parking", "Parking spaces"],
];
const OPTIONAL_DETAIL_KEYS = ["beds", "baths", "toilets", "sqm", "parking", "furnishing", "availability"];

/**
 * Error keys in the order the fields appear, so the page scrolls to the
 * first problem. "files" is the media section.
 */
const FIELD_ORDER = [
  "category", "price", "title", "files", "state", "lga", "area", "address",
  "description", "features", ...OPTIONAL_DETAIL_KEYS,
];

/** The stored extra amounts the form no longer shows, kept unchanged on edit. */
type HiddenAmounts = { cautionDeposit: number | null; serviceCharge: number | null };
const NO_HIDDEN_AMOUNTS: HiddenAmounts = { cautionDeposit: null, serviceCharge: null };

const digitsOnly = (value: string) => value.replace(/[^0-9]/g, "");
const toNumberOrNull = (value: string) => (value ? Number(value) : null);

export function PropertyForm({
  mode,
  propertyId,
  staffMode = false,
}: {
  mode: "new" | "edit";
  propertyId?: string;
  /** Staff (lawyer) admin edit: loads and saves through the staff endpoints
   *  and hides photo/video management, which stays with the provider. */
  staffMode?: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = useState<PropertyFormValues>(EMPTY_FORM);
  const [hiddenAmounts, setHiddenAmounts] = useState<HiddenAmounts>(NO_HIDDEN_AMOUNTS);
  const [loaded, setLoaded] = useState(mode === "new");
  const [loadFailed, setLoadFailed] = useState(false);
  // This provider's own previously-typed custom features (private per
  // lister — never a shared global list).
  const [myFeatures, setMyFeatures] = useState<string[]>([]);
  const [customFeature, setCustomFeature] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<"draft" | "submit" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  // Admin-managed property types; the first active type is the default.
  const propertyTypes = usePropertyTypes();
  const videoLimits = useVideoLimits();
  const media = useListingMedia({ propertyId: values.id, videoLimits });
  const { initialise: initialiseMedia } = media;

  useEffect(() => {
    if (propertyTypes && propertyTypes.length > 0) {
      setValues((v) => (v.category ? v : { ...v, category: propertyTypes[0].name }));
    }
  }, [propertyTypes]);

  // Load the lister's own feature vocabulary (providers only).
  useEffect(() => {
    if (staffMode) return;
    apiFetch<{ features: string[] }>("/provider/features")
      .then((data) => setMyFeatures((prev) => Array.from(new Set([...prev, ...data.features]))))
      .catch(() => undefined);
  }, [staffMode]);

  const load = useCallback(async () => {
    if (mode !== "edit" || !propertyId) return;
    try {
      const data = await apiFetch<{ property: Record<string, unknown> }>(
        staffMode ? `/staff/listings/${propertyId}` : `/provider/properties/${propertyId}`,
      );
      const p = data.property;
      const numberText = (key: string) => (p[key] != null ? String(p[key]) : "");
      const next: PropertyFormValues = {
        id: propertyId,
        title: (p.title as string) ?? "",
        category: (p.category as string) ?? "",
        listingType: p.listingType === "RENT" ? "RENT" : "SALE",
        price: String(p.price ?? ""),
        availability: (p.availability as string) ?? "AVAILABLE",
        state: (p.state as string) ?? "",
        region: (p.region as string) ?? "",
        lga: (p.lga as string) ?? "",
        area: (p.area as string) ?? "",
        address: (p.address as string) ?? "",
        beds: numberText("beds"),
        baths: numberText("baths"),
        toilets: numberText("toilets"),
        sqm: numberText("sqm"),
        parking: numberText("parking"),
        furnishing: (p.furnishing as string) ?? "",
        description: (p.description as string) ?? "",
        features: (p.features as string[]) ?? [],
        status: p.status as string,
        feedback: (p.feedback as string) ?? null,
      };
      setValues(next);
      setHiddenAmounts({
        cautionDeposit: (p.cautionDeposit as number | null) ?? null,
        serviceCharge: (p.serviceCharge as number | null) ?? null,
      });
      // Show the optional group open when the listing already uses it.
      setDetailsOpen(OPTIONAL_DETAIL_KEYS.some((key) => key !== "availability" && next[key as keyof PropertyFormValues]));
      setMyFeatures((prev) =>
        Array.from(new Set([...prev, ...next.features.filter((f) => !COMMON_FEATURES.includes(f))])),
      );
      const videoUrl = p.videoUrl as string | null;
      initialiseMedia(
        (p.images as StoredImage[]) ?? [],
        videoUrl
          ? { url: videoUrl, bytes: p.videoBytes as number | null, durationSec: p.videoDurationSec as number | null }
          : null,
      );
    } catch {
      setLoadFailed(true);
    } finally {
      setLoaded(true);
    }
  }, [mode, propertyId, staffMode, initialiseMedia]);

  useEffect(() => {
    void load();
  }, [load]);

  // Warn before leaving while files are still uploading or not yet saved.
  const hasUnsavedMedia = !staffMode && media.unsavedCount > 0;
  useEffect(() => {
    if (!hasUnsavedMedia && !saving) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasUnsavedMedia, saving]);

  function set<K extends keyof PropertyFormValues>(key: K, value: PropertyFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    // Clear a field's error as soon as the provider edits it.
    setErrors((e) => (e[key] ? { ...e, [key]: "" } : e));
  }

  const lgaOptions = useMemo(() => lgasFor(values.state), [values.state]);
  const areaOptions = useMemo(
    () => (values.state && values.lga ? areasFor(values.state, values.lga) : []),
    [values.state, values.lga],
  );
  // When the stored LGA/area is not in the canonical list (older listings or
  // free-typed entries), the select falls back to the "Other…" sentinel and
  // a text input exposes the actual value.
  const lgaSelectValue = lgaOptions.includes(values.lga) || !values.lga ? values.lga : OTHER_OPTION;
  const areaSelectValue = areaOptions.includes(values.area) || !values.area ? values.area : OTHER_OPTION;

  // Full chip list: the shared starter set + this lister's own vocabulary +
  // anything already selected on the listing.
  const allFeatureOptions = useMemo(
    () => Array.from(new Set([...COMMON_FEATURES, ...myFeatures, ...values.features])),
    [myFeatures, values.features],
  );

  /** Add a custom feature: selects it on the listing and stores it in the
   * provider's PRIVATE vocabulary (per lister, never global). */
  async function addCustomFeature() {
    const trimmed = customFeature.replace(/\s+/g, " ").trim().slice(0, MAX_CUSTOM_FEATURE_LENGTH);
    setCustomFeature("");
    if (!trimmed) return;
    if (!values.features.includes(trimmed)) set("features", [...values.features, trimmed]);
    if (staffMode || myFeatures.some((f) => f.toLowerCase() === trimmed.toLowerCase())) return;
    try {
      const data = await apiFetch<{ feature: string }>("/provider/features", {
        method: "POST",
        body: { name: trimmed },
      });
      setMyFeatures((prev) => Array.from(new Set([...prev, data.feature])));
    } catch {
      // Vocabulary save is best-effort; the feature stays on the listing.
    }
  }

  function validateLocally(): Record<string, string> {
    const local: Record<string, string> = {};
    if (values.title.trim().length < MIN_TITLE_LENGTH) {
      local.title = `Give the property a title of at least ${MIN_TITLE_LENGTH} characters.`;
    }
    if (!values.category) local.category = "Choose a property type.";
    if (!(Number(values.price) > 0)) local.price = "Enter the price in naira.";
    if (!values.state) local.state = "Choose a state.";
    if (!values.lga.trim()) local.lga = "Choose the local government area.";
    if (!values.area.trim()) local.area = "Choose the area or neighbourhood.";
    if (!values.address.trim()) local.address = "Add the address or directions so our legal team can find it.";
    if (values.description.trim().length < MIN_DESCRIPTION_LENGTH) {
      local.description = `Write at least ${MIN_DESCRIPTION_LENGTH} characters about the property.`;
    }
    return local;
  }

  /** Show errors inline and bring the first one into view. */
  function showErrors(fields: Record<string, string>) {
    const known = Object.fromEntries(Object.entries(fields).filter(([key]) => FIELD_ORDER.includes(key) || key === "form"));
    const unknown = Object.entries(fields).filter(([key]) => !FIELD_ORDER.includes(key) && key !== "form");
    if (unknown.length > 0 && !known.form) known.form = unknown.map(([, message]) => message).join(" ");
    setErrors(known);
    if (OPTIONAL_DETAIL_KEYS.some((key) => known[key])) setDetailsOpen(true);
    const first = FIELD_ORDER.find((key) => known[key]);
    const target = first ? document.getElementById(`field-${first}`) : document.getElementById("form-top");
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
    target?.querySelector<HTMLElement>("input, select, textarea")?.focus({ preventScroll: true });
  }

  function buildBody(submitForReview: boolean) {
    return {
      title: values.title,
      category: values.category,
      listingType: values.listingType,
      price: Number(values.price),
      state: values.state,
      region: values.region || undefined,
      lga: values.lga,
      area: values.area,
      address: values.address,
      beds: toNumberOrNull(values.beds),
      baths: toNumberOrNull(values.baths),
      toilets: toNumberOrNull(values.toilets),
      sqm: toNumberOrNull(values.sqm),
      parking: toNumberOrNull(values.parking),
      furnishing: values.furnishing || undefined,
      description: values.description,
      features: values.features,
      availability: values.availability,
      // Not editable in the form any more; older listings keep their values.
      cautionDeposit: hiddenAmounts.cautionDeposit,
      serviceCharge: hiddenAmounts.serviceCharge,
      submitForReview,
    };
  }

  async function save(submitForReview: boolean) {
    if (saving) return; // ignore double taps
    setNotice(null);
    const local = validateLocally();
    if (Object.keys(local).length > 0) {
      showErrors(local);
      return;
    }
    setErrors({});
    setSaving(submitForReview ? "submit" : "draft");
    try {
      if (staffMode) {
        await apiFetch(`/staff/listings/${propertyId}`, { method: "PATCH", body: buildBody(submitForReview) });
        setNotice("Listing saved — the provider has been notified of the change.");
        toast.success("Listing saved — provider notified.");
        return;
      }

      // 1. Make sure the listing exists. A new listing is created as a
      //    draft first so its photos have somewhere to go.
      let id = values.id;
      const createdNow = !id;
      if (!id) {
        const created = await apiFetch<{ property: { id: string; status: string } }>("/provider/properties", {
          method: "POST",
          body: buildBody(false),
        });
        id = created.property.id;
        const newId = id;
        setValues((v) => ({ ...v, id: newId, status: created.property.status }));
      }

      // 2. Upload every photo/video not yet stored.
      const { failed } = await media.uploadPending(id);
      if (failed > 0) {
        const what = failed === 1 ? "1 file didn't" : `${failed} files didn't`;
        showErrors({
          files: `${what} upload. Tap Retry on ${failed === 1 ? "it" : "them"} or remove ${failed === 1 ? "it" : "them"}, then press ${submitForReview ? "Submit" : "Save"} again.`,
        });
        if (createdNow) setNotice("Your details are saved as a draft — only the files below still need attention.");
        return;
      }

      // 3. Save (and optionally submit). A just-created draft already holds
      //    these exact details, so it only needs the submit step.
      if (createdNow) {
        if (submitForReview) await apiFetch(`/provider/properties/${id}/submit`, { method: "POST" });
        router.push(`/app/provider/properties?submitted=${submitForReview ? "1" : "draft"}`);
        return;
      }
      const saved = await apiFetch<{ property: { status: string } }>(`/provider/properties/${id}`, {
        method: "PATCH",
        body: buildBody(submitForReview),
      });
      // A new listing that needed a second try (e.g. a failed upload) ends
      // where a first-time success does.
      if (mode === "new") {
        router.push(`/app/provider/properties?submitted=${submitForReview ? "1" : "draft"}`);
        return;
      }
      setValues((v) => ({ ...v, status: saved.property.status }));
      setNotice(
        submitForReview
          ? "Listing submitted for review. Our legal team will be in touch."
          : "Changes saved as a draft.",
      );
      document.getElementById("form-top")?.scrollIntoView({ behavior: "smooth" });
    } catch (err) {
      const fields =
        err instanceof ApiRequestError
          ? { ...(err.fields ?? {}), form: err.message }
          : { form: "We couldn't save the listing. Check your connection and try again." };
      toast.error(fields.form);
      showErrors(fields);
    } finally {
      setSaving(null);
    }
  }

  if (!loaded) return <PageLoader />;
  if (loadFailed) {
    return (
      <div className="mx-auto max-w-3xl py-10">
        <Alert tone="error">We couldn&apos;t load this listing. Refresh the page to try again.</Alert>
      </div>
    );
  }

  const isNew = !values.id;
  const locked = !staffMode && LOCKED_STATUSES.includes(values.status ?? "");
  const isApproved = values.status === "APPROVED";
  const blocked = locked || saving !== null;
  const priceLabel = values.listingType === "SALE" ? "Asking price (₦)" : "Rent per year (₦)";

  return (
    <div className="mx-auto max-w-3xl" id="form-top">
      <button
        type="button"
        onClick={() => router.push(staffMode ? `/app/staff/listings/${propertyId}` : "/app/provider/properties")}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-brand-700"
      >
        <ChevronLeftIcon className="h-4 w-4" />
        {staffMode ? "Back to listing" : "My properties"}
      </button>
      <h1 className="mt-3 font-serif text-3xl text-ink-strong">
        {mode === "new" ? "List a property" : staffMode ? "Edit listing" : "Edit property"}
      </h1>
      <p className="mt-1.5 text-ink-muted">
        {staffMode
          ? "Administrative edit — the provider is notified of every change."
          : "Fill in the details and add photos. Our legal team checks every listing before it goes live."}
      </p>

      {values.status === "CHANGES_REQUESTED" && values.feedback && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-semibold">Changes requested by the legal team:</p>
          <p className="mt-1">{values.feedback}</p>
        </div>
      )}
      {locked && (
        <div className="mt-4">
          <Alert tone="error">This listing can no longer be changed. Contact support if you think this is a mistake.</Alert>
        </div>
      )}
      {isApproved && !staffMode && (
        <div className="mt-4">
          <Alert tone="info">This listing is live. Submitting changes sends it back to our legal team for a quick review.</Alert>
        </div>
      )}
      {notice && <div className="mt-4"><Alert tone="success">{notice}</Alert></div>}
      {errors.form && <div className="mt-4"><Alert tone="error">{errors.form}</Alert></div>}

      <form onSubmit={(e) => { e.preventDefault(); void save(true); }} className="mt-6 space-y-5" noValidate>
        <fieldset disabled={locked} className="space-y-5">
          {/* --------------------------------------------- 1. the basics */}
          <Section step={1} title="The basics">
            <div id="field-listingType">
              <p className="label">This property is for</p>
              <div className="grid grid-cols-2 gap-2 rounded-lg bg-brand-50 p-1" role="group" aria-label="Listing for">
                {(["SALE", "RENT"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => set("listingType", option)}
                    aria-pressed={values.listingType === option}
                    className={`rounded-md px-4 py-2.5 text-sm font-semibold transition-colors ${
                      values.listingType === option ? "bg-brand-700 text-white" : "text-brand-700 hover:bg-brand-100"
                    }`}
                  >
                    {option === "SALE" ? "Sale" : "Rent"}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div id="field-category">
                <Field label="Type of property" error={errors.category} required>
                  <Select value={values.category} onChange={(e) => set("category", e.target.value)} aria-label="Type of property">
                    {(propertyTypes ?? []).length === 0 && <option value="">Loading…</option>}
                    {(propertyTypes ?? []).map((type) => (
                      <option key={type.id} value={type.name}>{type.name}</option>
                    ))}
                  </Select>
                </Field>
              </div>
              <div id="field-price">
                <Field
                  label={priceLabel}
                  error={errors.price}
                  required
                  hint={values.price ? formatNaira(Number(values.price)) : "Numbers only, e.g. 4500000"}
                >
                  <Input
                    inputMode="numeric"
                    autoComplete="off"
                    value={values.price}
                    onChange={(e) => set("price", digitsOnly(e.target.value))}
                    placeholder="e.g. 4500000"
                  />
                </Field>
              </div>
            </div>

            <div id="field-title">
              <Field
                label="Listing title"
                error={errors.title}
                required
                hint={
                  values.title.trim().length < MIN_TITLE_LENGTH
                    ? `e.g. 4-bedroom duplex with pool in Lekki · at least ${MIN_TITLE_LENGTH} characters`
                    : "Looks good."
                }
              >
                <Input value={values.title} maxLength={140} onChange={(e) => set("title", e.target.value)} />
              </Field>
            </div>
          </Section>

          {/* ------------------------------------- 2. photos and video */}
          {!staffMode ? (
            <Section
              step={2}
              title="Photos & video"
              subtitle={
                isNew
                  ? "Add them now — they upload when you save or submit."
                  : "New files upload straight away."
              }
            >
              <div id="field-files">
                <ListingMediaPicker media={media} videoLimits={videoLimits} listingSaved={!isNew} disabled={blocked} />
                {errors.files && <p className="mt-3 text-sm font-medium text-red-600">{errors.files}</p>}
              </div>
            </Section>
          ) : (
            <Section step={2} title="Photos & video">
              <p className="text-sm text-ink-muted">
                Photos and walkthrough videos are managed by the listing provider. Every other detail can be edited here.
              </p>
            </Section>
          )}

          {/* ------------------------------------------- 3. location */}
          <Section step={3} title="Where is it?" subtitle="The exact address is only shared with our legal team.">
            <div className="grid gap-4 sm:grid-cols-2">
              <div id="field-state">
                <Field label="State" error={errors.state} required>
                  <Select
                    value={values.state}
                    onChange={(e) => {
                      set("state", e.target.value);
                      set("region", "");
                      set("lga", "");
                      set("area", "");
                    }}
                    aria-label="State"
                  >
                    <option value="">Choose a state</option>
                    {STATES.map((state) => (
                      <option key={state.name} value={state.name}>{state.name}</option>
                    ))}
                  </Select>
                </Field>
              </div>
              {values.state === "Lagos" && (
                <Field label="Island or Mainland" hint="Optional">
                  <Select value={values.region} onChange={(e) => set("region", e.target.value)} aria-label="Island or Mainland">
                    <option value="">Not sure</option>
                    <option value="Island">Island</option>
                    <option value="Mainland">Mainland</option>
                  </Select>
                </Field>
              )}
              <div id="field-lga">
                <Field label="Local government area (LGA)" error={errors.lga} required>
                  <Select
                    value={lgaSelectValue}
                    onChange={(e) => {
                      // "Other" clears the value so the text box below takes over.
                      set("lga", e.target.value === OTHER_OPTION ? "" : e.target.value);
                      set("area", "");
                    }}
                    aria-label="Local government area"
                    disabled={!values.state}
                  >
                    <option value="">{values.state ? "Choose an LGA" : "Choose a state first"}</option>
                    {lgaOptions.map((lga) => (
                      <option key={lga} value={lga}>{lga}</option>
                    ))}
                    <option value={OTHER_OPTION}>Not listed — I&apos;ll type it</option>
                  </Select>
                </Field>
                {lgaSelectValue === OTHER_OPTION && (
                  <Input
                    className="mt-2"
                    value={values.lga}
                    onChange={(e) => set("lga", e.target.value)}
                    placeholder="Type the LGA name"
                    aria-label="LGA name"
                  />
                )}
              </div>
              <div id="field-area">
                <Field label="Area or neighbourhood" error={errors.area} required>
                  <Select
                    value={areaSelectValue}
                    onChange={(e) => set("area", e.target.value === OTHER_OPTION ? "" : e.target.value)}
                    aria-label="Area"
                    disabled={!values.lga}
                  >
                    <option value="">{values.lga ? "Choose an area" : "Choose an LGA first"}</option>
                    {areaOptions.map((area) => (
                      <option key={area} value={area}>{area}</option>
                    ))}
                    <option value={OTHER_OPTION}>Not listed — I&apos;ll type it</option>
                  </Select>
                </Field>
                {areaSelectValue === OTHER_OPTION && (
                  <Input
                    className="mt-2"
                    value={values.area}
                    onChange={(e) => set("area", e.target.value)}
                    placeholder="e.g. Nestoil Estate"
                    aria-label="Area name"
                  />
                )}
              </div>
              <div id="field-address" className="sm:col-span-2">
                <Field label="Street address or directions" error={errors.address} required>
                  <Textarea
                    rows={2}
                    value={values.address}
                    onChange={(e) => set("address", e.target.value)}
                    placeholder="e.g. 12 Admiralty Way, off Lekki Phase 1 roundabout"
                  />
                </Field>
              </div>
            </div>
          </Section>

          {/* ---------------------------------------- 4. description */}
          <Section step={4} title="Describe it">
            <div id="field-description">
              <Field label="Description" error={errors.description} required>
                <Textarea
                  rows={5}
                  value={values.description}
                  onChange={(e) => set("description", e.target.value)}
                  placeholder="What makes it special? Rooms, finishing, the estate, nearby roads and amenities."
                />
              </Field>
              <CharacterCount length={values.description.trim().length} minimum={MIN_DESCRIPTION_LENGTH} />
            </div>

            <div id="field-features">
              <p className="label">Features <span className="font-normal text-ink-muted">(tap any that apply)</span></p>
              <div className="flex flex-wrap gap-2">
                {allFeatureOptions.map((feature) => {
                  const active = values.features.includes(feature);
                  return (
                    <button
                      key={feature}
                      type="button"
                      onClick={() =>
                        set("features", active ? values.features.filter((f) => f !== feature) : [...values.features, feature])
                      }
                      aria-pressed={active}
                      className={`rounded-full px-3 py-2 text-xs font-medium transition-colors ${
                        active ? "bg-brand-700 text-white" : "bg-white text-ink-soft ring-1 ring-brand-200 hover:bg-brand-50"
                      }`}
                    >
                      {active ? "✓ " : ""}{feature}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex gap-2">
                <Input
                  value={customFeature}
                  onChange={(e) => setCustomFeature(e.target.value)}
                  placeholder="Something else? Type it here"
                  aria-label="Custom feature"
                  maxLength={MAX_CUSTOM_FEATURE_LENGTH}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void addCustomFeature();
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={() => void addCustomFeature()}>
                  Add
                </Button>
              </div>
              {errors.features && <p className="mt-1 text-xs font-medium text-red-600">{errors.features}</p>}
            </div>
          </Section>

          {/* --------------------------------- 5. optional extra details */}
          <Card className="overflow-hidden">
            <button
              type="button"
              onClick={() => setDetailsOpen((open) => !open)}
              aria-expanded={detailsOpen}
              className="flex w-full items-center justify-between gap-3 p-5 text-left sm:p-6"
            >
              <span>
                <span className="block text-lg font-semibold text-ink-strong">More details <span className="text-sm font-normal text-ink-muted">(optional)</span></span>
                <span className="mt-0.5 block text-sm text-ink-muted">Bedrooms, bathrooms, size, parking, furnishing</span>
              </span>
              <span aria-hidden className={`text-xl text-brand-700 transition-transform ${detailsOpen ? "rotate-45" : ""}`}>+</span>
            </button>
            {detailsOpen && (
              <div className="grid grid-cols-2 gap-4 border-t border-brand-100 p-5 sm:grid-cols-3 sm:p-6">
                {NUMBER_DETAILS.map(([key, label]) => (
                  <div key={key} id={`field-${key}`}>
                    <Field label={label} error={errors[key]}>
                      <Input
                        inputMode="numeric"
                        value={values[key] as string}
                        onChange={(e) => set(key, digitsOnly(e.target.value) as never)}
                      />
                    </Field>
                  </div>
                ))}
                <div id="field-furnishing">
                  <Field label="Furnishing" error={errors.furnishing}>
                    <Select value={values.furnishing} onChange={(e) => set("furnishing", e.target.value)} aria-label="Furnishing">
                      <option value="">Not stated</option>
                      <option value="furnished">Furnished</option>
                      <option value="semi_furnished">Semi-furnished</option>
                      <option value="unfurnished">Unfurnished</option>
                    </Select>
                  </Field>
                </div>
                <div id="field-availability" className="col-span-2 sm:col-span-1">
                  <Field label="Availability" error={errors.availability}>
                    <Select value={values.availability} onChange={(e) => set("availability", e.target.value)} aria-label="Availability">
                      <option value="AVAILABLE">Available</option>
                      <option value="UNDER_OFFER">Under offer</option>
                      <option value="UNAVAILABLE">Unavailable</option>
                    </Select>
                  </Field>
                </div>
              </div>
            )}
          </Card>
        </fieldset>

        {/* ------------------------------------------------ action bar */}
        {/* Sticky so Submit is always within thumb reach on phones. */}
        <div className="sticky bottom-0 z-10 -mx-4 border-t border-brand-100 bg-white/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
          {media.uploading && (
            <p className="mb-2 text-xs text-ink-muted" aria-live="polite">Uploading files — please keep this page open.</p>
          )}
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:justify-end">
            {staffMode ? (
              <Button type="submit" loading={saving !== null} disabled={blocked} className="col-span-2">
                Save changes
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void save(false)}
                  loading={saving === "draft"}
                  disabled={blocked || media.uploading}
                >
                  Save as draft
                </Button>
                <Button type="submit" loading={saving === "submit"} disabled={blocked || media.uploading}>
                  {saving === "submit" ? "Submitting…" : "Submit for review"}
                </Button>
              </>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}

/** A numbered form group, so the provider always knows where they are. */
function Section({
  step,
  title,
  subtitle,
  children,
}: {
  step: number;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-700 text-xs font-bold text-white" aria-hidden>
          {step}
        </span>
        <div>
          <h2 className="text-lg font-semibold text-ink-strong">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-ink-muted">{subtitle}</p>}
        </div>
      </div>
      <div className="mt-4 space-y-4">{children}</div>
    </Card>
  );
}

function CharacterCount({ length, minimum }: { length: number; minimum: number }) {
  const remaining = minimum - length;
  return (
    <p className={`mt-1 text-xs ${remaining > 0 ? "text-ink-muted" : "text-emerald-700"}`}>
      {remaining > 0 ? `${remaining} more character${remaining === 1 ? "" : "s"} needed` : `${length} characters — great`}
    </p>
  );
}
