"use client";

/**
 * Provider property form — used for creating and editing listings.
 * Fields mirror the prototype: basic information, location cascade
 * (state → region → LGA → area), specifications, photographs and features.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiRequestError, apiUpload } from "@/lib/api";
import { formatNaira } from "@/lib/format";
import { usePropertyTypes } from "@/lib/property-types";
import { STATES, lgasFor, areasFor, OTHER_OPTION } from "@/lib/nigeria-geo";
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
  cautionDeposit: string;
  serviceCharge: string;
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
  cautionDeposit: "",
  serviceCharge: "",
};

const COMMON_FEATURES = [
  "Ensuite bedrooms", "Fitted kitchen", "24-hour security", "Gated estate",
  "Standby generator", "Borehole water", "Swimming pool", "Serviced estate",
  "Interlocked compound", "Boys’ quarters", "Walk-in closet", "Balcony",
  "Air conditioning", "POP ceilings", "CCTV", "Elevator",
];

/** Video limits shown to the lister — admin-managed settings with defaults. */
const DEFAULT_VIDEO_MAX_MB = 50;
const DEFAULT_VIDEO_MAX_DURATION_SEC = 120;

type ListingVideo = {
  url: string;
  bytes?: number | null;
  durationSec?: number | null;
};

export function PropertyForm({
  mode,
  propertyId,
}: {
  mode: "new" | "edit";
  propertyId?: string;
}) {
  const router = useRouter();
  const [values, setValues] = useState<PropertyFormValues>(EMPTY_FORM);
  const [loaded, setLoaded] = useState(mode === "new");
  const [images, setImages] = useState<Array<{ id: string; url: string; label: string }>>([]);
  const [video, setVideo] = useState<ListingVideo | null>(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [videoLimits, setVideoLimits] = useState({
    maxMb: DEFAULT_VIDEO_MAX_MB,
    maxDurationSec: DEFAULT_VIDEO_MAX_DURATION_SEC,
  });
  // This provider's own previously-typed custom features (private per
  // lister — never a shared global list).
  const [myFeatures, setMyFeatures] = useState<string[]>([]);
  const [customFeature, setCustomFeature] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<"draft" | "submit" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  // Admin-managed property types; the first active type is the default.
  const propertyTypes = usePropertyTypes();

  useEffect(() => {
    if (propertyTypes && propertyTypes.length > 0) {
      setValues((v) => (v.category ? v : { ...v, category: propertyTypes[0].name }));
    }
  }, [propertyTypes]);

  // Media limits are admin-managed (staff Settings); the public settings
  // endpoint exposes them so the form shows every lister the same rules.
  useEffect(() => {
    apiFetch<{ settings: Record<string, string> }>("/settings/public")
      .then((data) => {
        const maxMb = Number(data.settings.videoMaxMb);
        const maxDurationSec = Number(data.settings.videoMaxDurationSec);
        setVideoLimits({
          maxMb: Number.isFinite(maxMb) && maxMb > 0 ? maxMb : DEFAULT_VIDEO_MAX_MB,
          maxDurationSec:
            Number.isFinite(maxDurationSec) && maxDurationSec > 0
              ? maxDurationSec
              : DEFAULT_VIDEO_MAX_DURATION_SEC,
        });
      })
      .catch(() => undefined); // defaults stay in place if settings are unreachable
  }, []);

  // Load the lister's own feature vocabulary (new + edit mode).
  useEffect(() => {
    apiFetch<{ features: string[] }>("/provider/features")
      .then((data) =>
        setMyFeatures((prev) => Array.from(new Set([...prev, ...data.features]))),
      )
      .catch(() => undefined);
  }, [mode, propertyId]);

  const load = useCallback(async () => {
    if (mode === "edit" && propertyId) {
      try {
        const data = await apiFetch<{ property: Record<string, unknown> }>(`/provider/properties/${propertyId}`);
        const p = data.property;
        setValues({
          id: propertyId,
          title: (p.title as string) ?? "",
          category: (p.category as string) ?? "",
          listingType: ((p.listingType as string) === "RENT" ? "RENT" : "SALE") as "SALE" | "RENT",
          price: String(p.price ?? ""),
          availability: (p.availability as string) ?? "AVAILABLE",
          state: (p.state as string) ?? "",
          region: (p.region as string) ?? "",
          lga: (p.lga as string) ?? "",
          area: (p.area as string) ?? "",
          address: (p.address as string) ?? "",
          beds: p.beds != null ? String(p.beds) : "",
          baths: p.baths != null ? String(p.baths) : "",
          toilets: p.toilets != null ? String(p.toilets) : "",
          sqm: p.sqm != null ? String(p.sqm) : "",
          parking: p.parking != null ? String(p.parking) : "",
          furnishing: (p.furnishing as string) ?? "",
          description: (p.description as string) ?? "",
          features: (p.features as string[]) ?? [],
          cautionDeposit: p.cautionDeposit != null ? String(p.cautionDeposit) : "",
          serviceCharge: p.serviceCharge != null ? String(p.serviceCharge) : "",
          status: p.status as string,
          feedback: (p.feedback as string) ?? null,
        });
        setImages((p.images as Array<{ id: string; url: string; label: string }>) ?? []);
        setMyFeatures(
          ((p.features as string[]) ?? []).filter(
            (feature) => !COMMON_FEATURES.includes(feature),
          ),
        );
        const videoUrl = p.videoUrl as string | null;
        setVideo(
          videoUrl
            ? {
                url: videoUrl,
                bytes: (p.videoBytes as number | null) ?? null,
                durationSec: (p.videoDurationSec as number | null) ?? null,
              }
            : null,
        );
      } catch {
        setNotice("Could not load this property.");
      }
    }
    setLoaded(true);
  }, [mode, propertyId]);

  useEffect(() => {
    void load();
  }, [load]);

  function set<K extends keyof PropertyFormValues>(key: K, value: PropertyFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
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
  // anything already selected on the listing, so every choice is visible and
  // removable as a chip (custom ones included).
  const allFeatureOptions = useMemo(
    () => Array.from(new Set([...COMMON_FEATURES, ...myFeatures, ...values.features])),
    [myFeatures, values.features],
  );

  /** Add a custom feature: selects it on the listing and stores it in the
   * provider's PRIVATE vocabulary (per lister, never global). */
  async function addCustomFeature() {
    const trimmed = customFeature.replace(/\s+/g, " ").trim().slice(0, 60);
    setCustomFeature("");
    if (!trimmed) return;
    if (!values.features.includes(trimmed)) {
      set("features", [...values.features, trimmed]);
    }
    if (!myFeatures.some((f) => f.toLowerCase() === trimmed.toLowerCase())) {
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
  }

  async function uploadVideo(file: File | null) {
    if (!file) return;
    if (!values.id) {
      setErrors({ files: "Save the listing first, then add a video." });
      return;
    }
    if (file.size > videoLimits.maxMb * 1024 * 1024) {
      setErrors({ files: `Videos must be ${videoLimits.maxMb} MB or smaller (set by the admin team).` });
      return;
    }
    setUploadingVideo(true);
    setErrors({});
    try {
      // Read the duration from the file's metadata before uploading so the
      // admin-set time limit is checked client-side too.
      const durationSec = await new Promise<number>((resolve, reject) => {
        const probe = document.createElement("video");
        probe.preload = "metadata";
        probe.onloadedmetadata = () => {
          resolve(Math.round(probe.duration));
          URL.revokeObjectURL(probe.src);
        };
        probe.onerror = () => reject(new Error("Not a playable video file."));
        probe.src = URL.createObjectURL(file);
      });
      if (durationSec > videoLimits.maxDurationSec) {
        setErrors({
          files: `Videos must be ${videoLimits.maxDurationSec} seconds or shorter (set by the admin team).`,
        });
        return;
      }
      const formData = new FormData();
      formData.append("file", file);
      formData.append("propertyId", values.id);
      formData.append("durationSec", String(durationSec));
      const data = await apiUpload<{ video: ListingVideo }>("/uploads/property-video", formData);
      setVideo({ url: data.video.url, bytes: data.video.bytes, durationSec: data.video.durationSec });
      setNotice("Video added to the listing.");
    } catch (err) {
      setErrors({ files: err instanceof ApiRequestError ? err.message : "Video upload failed. Please try again." });
    } finally {
      setUploadingVideo(false);
    }
  }

  async function removeVideo() {
    if (!values.id) return;
    try {
      await apiFetch("/uploads/property-video", { method: "DELETE", body: { propertyId: values.id } });
      setVideo(null);
    } catch {
      setErrors({ files: "Could not remove the video." });
    }
  }

  async function uploadFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    if (!values.id) {
      setErrors({ files: "Save the listing first, then add photographs." });
      return;
    }
    setUploading(true);
    setErrors({});
    try {
      const formData = new FormData();
      for (const file of Array.from(files)) formData.append("files", file);
      formData.append("propertyId", values.id);
      const data = await apiUpload<{ images: Array<{ id: string; url: string; label: string }> }>(
        "/uploads/property-image",
        formData,
      );
      setImages((prev) => [...prev, ...data.images]);
    } catch (err) {
      setErrors({ files: err instanceof ApiRequestError ? err.message : "Upload failed. Please try again." });
    } finally {
      setUploading(false);
    }
  }

  async function removeImage(imageId: string) {
    try {
      await apiFetch(`/uploads/property-image/${imageId}`, { method: "DELETE" });
      setImages((prev) => prev.filter((img) => img.id !== imageId));
    } catch {
      setErrors({ files: "Could not remove the photo." });
    }
  }

  async function save(submitForReview: boolean) {
    setErrors({});
    setNotice(null);

    // Client-side validation mirrors the prototype's rules.
    const local: Record<string, string> = {};
    if (values.title.trim().length < 8) local.title = "Give the property a descriptive title (at least 8 characters).";
    const price = Number(values.price.replace(/[^0-9]/g, ""));
    if (!(price > 0)) local.price = "Enter a price greater than zero.";
    if (!values.state) local.state = "Complete the state, LGA and area.";
    if (!values.lga) local.lga = "Choose an LGA within the selected state.";
    if (!values.area) local.area = "Choose an area within the selected LGA.";
    if (!values.address.trim()) local.address = "Describe the location so the legal team can identify it.";
    if (values.description.trim().length < 60) local.description = "Write a description of at least 60 characters.";
    setErrors(local);
    if (Object.keys(local).length > 0) {
      document.querySelector("form")?.scrollIntoView({ behavior: "smooth" });
      return;
    }

    setSaving(submitForReview ? "submit" : "draft");
    try {
      const body = {
        title: values.title,
        category: values.category,
        listingType: values.listingType,
        price,
        state: values.state,
        region: values.region || undefined,
        lga: values.lga,
        area: values.area,
        address: values.address,
        beds: values.beds ? Number(values.beds) : null,
        baths: values.baths ? Number(values.baths) : null,
        toilets: values.toilets ? Number(values.toilets) : null,
        sqm: values.sqm ? Number(values.sqm) : null,
        parking: values.parking ? Number(values.parking) : null,
        furnishing: values.furnishing || undefined,
        description: values.description,
        features: values.features,
        availability: values.availability,
        cautionDeposit: values.cautionDeposit ? Number(values.cautionDeposit) : null,
        serviceCharge: values.serviceCharge ? Number(values.serviceCharge) : null,
        submitForReview,
      };

      if (mode === "new") {
        await apiFetch<{ property: { id: string } }>("/provider/properties", {
          method: "POST",
          body,
        });
        // Photos and video are attached from the listing's Edit page — go
        // back to the list so the flow ends where the lister expects it.
        router.push("/app/provider/properties?submitted=1");
        return;
      }

      await apiFetch(`/provider/properties/${propertyId}`, { method: "PATCH", body });
      setNotice(
        submitForReview
          ? "Listing submitted for review. Our legal team will be in touch."
          : "Listing saved.",
      );
      await load();
    } catch (err) {
      setErrors(err instanceof ApiRequestError ? (err.fields ?? { form: err.message }) : { form: "Could not save the listing." });
    } finally {
      setSaving(null);
    }
  }

  if (!loaded) return <PageLoader />;

  const isDraft = values.status === "DRAFT";
  const isChangesRequested = values.status === "CHANGES_REQUESTED";

  return (
    <div className="mx-auto max-w-4xl">
      <button
        onClick={() => router.push("/app/provider/properties")}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-brand-700"
      >
        <ChevronLeftIcon className="h-4 w-4" />
        My properties
      </button>
      <h1 className="mt-3 font-serif text-3xl text-ink-strong">
        {mode === "new" ? "Add a property" : "Edit property"}
      </h1>
      <p className="mt-1.5 text-ink-muted">
        Complete the details below. Listings are reviewed by our legal team before they appear publicly.
      </p>

      {isChangesRequested && values.feedback && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-semibold">Changes requested by the legal team:</p>
          <p className="mt-1">{values.feedback}</p>
        </div>
      )}
      {notice && <div className="mt-4"><Alert tone="success">{notice}</Alert></div>}
      {errors.form && <div className="mt-4"><Alert tone="error">{errors.form}</Alert></div>}

      <form onSubmit={(e) => { e.preventDefault(); void save(true); }} className="mt-6 space-y-6" noValidate>
        {/* ------------------------------------------- basic information */}
        <Card className="p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-ink-strong">Basic information</h2>
          <div className="mt-4 space-y-4">
            <Field label="Property title" error={errors.title} required hint="e.g. Contemporary 4-Bedroom Detached Duplex">
              <Input value={values.title} onChange={(e) => set("title", e.target.value)} />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Property type" required>
                <Select value={values.category} onChange={(e) => set("category", e.target.value)} aria-label="Property type">
                  {(propertyTypes ?? []).map((type) => (
                    <option key={type.id} value={type.name}>{type.name}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Listing for" required>
                <div className="grid grid-cols-2 gap-2 rounded-lg bg-brand-50 p-1" role="group" aria-label="Listing for">
                  {(["SALE", "RENT"] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => set("listingType", option)}
                      aria-pressed={values.listingType === option}
                      className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
                        values.listingType === option ? "bg-brand-700 text-white" : "text-brand-700 hover:bg-brand-100"
                      }`}
                    >
                      {option === "SALE" ? "Sale" : "Rent"}
                    </button>
                  ))}
                </div>
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={values.listingType === "SALE" ? "Sale price (₦)" : "Annual rent (₦)"}
                error={errors.price}
                required
                hint={values.price ? formatNaira(Number(values.price.replace(/[^0-9]/g, "") || 0)) : undefined}
              >
                <Input
                  inputMode="numeric"
                  value={values.price}
                  onChange={(e) => set("price", e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="e.g. 4500000"
                />
              </Field>
              <Field label="Availability">
                <Select value={values.availability} onChange={(e) => set("availability", e.target.value)} aria-label="Availability">
                  <option value="AVAILABLE">Available</option>
                  <option value="UNDER_OFFER">Under offer</option>
                  <option value="UNAVAILABLE">Unavailable</option>
                </Select>
              </Field>
            </div>

            {values.listingType === "RENT" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Caution deposit (₦)" hint="Optional">
                  <Input inputMode="numeric" value={values.cautionDeposit} onChange={(e) => set("cautionDeposit", e.target.value.replace(/[^0-9]/g, ""))} />
                </Field>
                <Field label="Service charge (₦)" hint="Optional">
                  <Input inputMode="numeric" value={values.serviceCharge} onChange={(e) => set("serviceCharge", e.target.value.replace(/[^0-9]/g, ""))} />
                </Field>
              </div>
            )}
          </div>
        </Card>

        {/* --------------------------------------------------- location */}
        <Card className="p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-ink-strong">Location</h2>
          <p className="mt-0.5 text-sm text-ink-muted">
            The exact address is shared with our legal team only.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="State" required>
              <Select value={values.state} onChange={(e) => { set("state", e.target.value); set("region", ""); set("lga", ""); set("area", ""); }} aria-label="State">
                <option value="">Select state</option>
                {STATES.map((state) => (
                  <option key={state.name} value={state.name}>{state.name}</option>
                ))}
              </Select>
            </Field>
            {values.state === "Lagos" && (
              <Field label="Island / Mainland">
                <Select value={values.region} onChange={(e) => set("region", e.target.value)} aria-label="Island or Mainland">
                  <option value="">Select</option>
                  <option value="Island">Island</option>
                  <option value="Mainland">Mainland</option>
                </Select>
              </Field>
            )}
            <Field label="Local Government Area (LGA)" error={errors.lga}>
              <Select
                value={lgaSelectValue}
                onChange={(e) => {
                  const value = e.target.value;
                  // "Other…" clears the value so the free-text input below
                  // takes over; choosing a listed LGA clears the free text.
                  set("lga", value === OTHER_OPTION ? "" : value);
                  set("area", "");
                }}
                aria-label="Local Government Area"
                disabled={!values.state}
              >
                <option value="">Select LGA</option>
                {lgaOptions.map((lga) => (
                  <option key={lga} value={lga}>{lga}</option>
                ))}
                <option value={OTHER_OPTION}>Other (type it below)</option>
              </Select>
            </Field>
            {lgaSelectValue === OTHER_OPTION && (
              <Field label="LGA name" hint="Type the LGA exactly as it is known.">
                <Input value={values.lga} onChange={(e) => set("lga", e.target.value)} placeholder="e.g. Ogo-Oluwa" aria-label="Custom LGA" />
              </Field>
            )}
            <Field label="Area / neighbourhood" error={errors.area}>
              <Select
                value={areaSelectValue}
                onChange={(e) => {
                  const value = e.target.value;
                  set("area", value === OTHER_OPTION ? "" : value);
                }}
                aria-label="Area"
                disabled={!values.lga}
              >
                <option value="">Select area</option>
                {areaOptions.map((area) => (
                  <option key={area} value={area}>{area}</option>
                ))}
                <option value={OTHER_OPTION}>Other (type it below)</option>
              </Select>
            </Field>
            {areaSelectValue === OTHER_OPTION && (
              <Field label="Area / neighbourhood name" hint="Type the area or estate as locals know it.">
                <Input value={values.area} onChange={(e) => set("area", e.target.value)} placeholder="e.g. Nestoil Estate" aria-label="Custom area" />
              </Field>
            )}
            <Field label="Address or location description" error={errors.address} required className="sm:col-span-2">
              <Textarea rows={2} value={values.address} onChange={(e) => set("address", e.target.value)} />
            </Field>
          </div>
        </Card>

        {/* ----------------------------------------------- specifications */}
        <Card className="p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-ink-strong">Specifications</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {([
              ["beds", "Bedrooms"], ["baths", "Bathrooms"], ["toilets", "Toilets"],
              ["sqm", "Size (sqm)"], ["parking", "Parking spaces"],
            ] as Array<[keyof PropertyFormValues, string]>).map(([key, label]) => (
              <Field key={key} label={label}>
                <Input
                  inputMode="numeric"
                  value={values[key] as string}
                  onChange={(e) => set(key, e.target.value.replace(/[^0-9]/g, "") as never)}
                />
              </Field>
            ))}
            <Field label="Furnishing">
              <Select value={values.furnishing} onChange={(e) => set("furnishing", e.target.value)} aria-label="Furnishing">
                <option value="">Select</option>
                <option value="furnished">Furnished</option>
                <option value="semi_furnished">Semi-furnished</option>
                <option value="unfurnished">Unfurnished</option>
              </Select>
            </Field>
          </div>

          <div className="mt-5">
            <Field label="Description" error={errors.description} required hint="At least 60 characters — describe the space, finishings and estate.">
              <Textarea rows={6} value={values.description} onChange={(e) => set("description", e.target.value)} />
            </Field>
            <p className="mt-1 text-xs text-ink-muted">{values.description.trim().length} / 60 characters minimum</p>
          </div>

          <div className="mt-5">
            <p className="mb-2 text-sm font-medium text-ink-strong">Features</p>
            <p className="mb-2 text-xs text-ink-muted">
              Tap to select. Features you type yourself are saved to <strong>your</strong> account only, so your suggestions stay relevant.
            </p>
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
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                      active ? "bg-brand-700 text-white" : "bg-white text-ink-soft ring-1 ring-brand-200 hover:bg-brand-50"
                    }`}
                  >
                    {feature}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex gap-2">
              <Input
                value={customFeature}
                onChange={(e) => setCustomFeature(e.target.value)}
                placeholder="Add a custom feature"
                aria-label="Custom feature"
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
            {values.features.length > 0 && (
              <p className="mt-2 text-xs text-ink-muted">Selected: {values.features.join(", ")}</p>
            )}
          </div>
        </Card>

        {/* ----------------------------------------------- photographs */}
        <Card className="p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-ink-strong">Photographs</h2>
          <p className="mt-0.5 text-sm text-ink-muted">
            {mode === "new"
              ? "Save the listing first, then upload photographs (JPEG, PNG or WebP, up to 5 MB each)."
              : "Upload photographs (JPEG, PNG or WebP, up to 5 MB each). The first photo is the cover."}
          </p>
          {mode === "edit" && (
            <>
              {images.length > 0 && (
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {images.map((image, index) => (
                    <div key={image.id} className="group relative">
                      { }
                      <img src={image.url} alt={image.label} className="aspect-[4/3] w-full rounded-lg object-cover" />
                      {index === 0 && (
                        <span className="absolute left-2 top-2 rounded-full bg-brand-700 px-2 py-0.5 text-[10px] font-bold text-white">
                          Cover
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => void removeImage(image.id)}
                        aria-label={`Remove ${image.label}`}
                        className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-white/90 text-ink-soft shadow hover:text-red-600"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <label className="mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand-200 px-6 py-8 text-center transition-colors hover:border-brand-400 hover:bg-brand-50/40">
                <span className="text-sm font-medium text-ink-soft">
                  {uploading ? "Uploading…" : "Click to upload photographs"}
                </span>
                <span className="text-xs text-ink-muted">JPEG, PNG or WebP · up to 5 MB each · max 10 photos</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="sr-only"
                  onChange={(e) => void uploadFiles(e.target.files)}
                  disabled={uploading}
                />
              </label>
              {errors.files && <Alert tone="error">{errors.files}</Alert>}
            </>
          )}
        </Card>

        {/* ------------------------------------------------------ video */}
        <Card className="p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-ink-strong">Video walkthrough</h2>
          <p className="mt-0.5 text-sm text-ink-muted">
            {mode === "new"
              ? "Optional. Save the listing first, then add a short walkthrough video from the edit page."
              : "Optional — one video per listing. It is replaced when you upload a new one."}
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            Limits set by the admin team: {videoLimits.maxMb} MB · {videoLimits.maxDurationSec} seconds · MP4, WebM or MOV.
          </p>
          {mode === "edit" && (
            <>
              {video && (
                <div className="mt-4">
                  <video
                    src={video.url}
                    controls
                    className="max-h-72 w-full rounded-lg bg-black"
                    data-testid="listing-video"
                  />
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-xs text-ink-muted">
                      {video.durationSec ? `${video.durationSec}s · ` : ""}
                      {video.bytes ? `${(video.bytes / (1024 * 1024)).toFixed(1)} MB` : "uploaded"}
                    </p>
                    <Button type="button" variant="outline" onClick={() => void removeVideo()}>
                      Remove video
                    </Button>
                  </div>
                </div>
              )}
              <label className="mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand-200 px-6 py-8 text-center transition-colors hover:border-brand-400 hover:bg-brand-50/40">
                <span className="text-sm font-medium text-ink-soft">
                  {uploadingVideo ? "Uploading video…" : video ? "Replace the video" : "Click to upload a video"}
                </span>
                <span className="text-xs text-ink-muted">
                  MP4, WebM or MOV · up to {videoLimits.maxMb} MB · max {videoLimits.maxDurationSec}s (optional)
                </span>
                <input
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  className="sr-only"
                  onChange={(e) => void uploadVideo(e.target.files?.[0] ?? null)}
                  disabled={uploadingVideo}
                />
              </label>
            </>
          )}
        </Card>

        {/* --------------------------------------------------- submit row */}
        <div className="flex flex-wrap items-center justify-end gap-3 pb-6">
          <Button type="button" variant="outline" onClick={() => void save(false)} loading={saving === "draft"}>
            {mode === "new" ? "Save as draft" : "Save without submitting"}
          </Button>
          <Button type="submit" loading={saving === "submit"}>
            {mode === "new" ? "Submit for review" : isDraft ? "Submit for review" : "Submit for review"}
          </Button>
        </div>
      </form>
    </div>
  );
}
