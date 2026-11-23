/**
 * Shared formatting helpers.
 * Dates render in Africa/Lagos (the platform's operating timezone) and
 * money in Nigerian naira, matching the prototype.
 */

const nairaFormatter = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

export function formatNaira(amount: number): string {
  return nairaFormatter.format(amount);
}

/** ₦185,000,000 -> "₦185M" (used in compact summary cards). */
export function formatNairaCompact(amount: number): string {
  if (amount >= 1_000_000_000) return `₦${(amount / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`;
  if (amount >= 1_000_000) return `₦${Math.round(amount / 1_000_000)}M`;
  if (amount >= 1_000) return `₦${Math.round(amount / 1_000)}K`;
  return `₦${amount}`;
}

const lagosDateTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Lagos",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const lagosDate = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Lagos",
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function formatDateTime(value: string | Date): string {
  return lagosDateTime.format(new Date(value));
}

export function formatDate(value: string | Date): string {
  return lagosDate.format(new Date(value));
}

/** "6 days ago" style relative labels, matching the prototype. */
export function formatRelative(value: string | Date): string {
  const then = new Date(value).getTime();
  const diffMs = Date.now() - then;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (days < 31) return `${weeks}w ago`;
  return formatDate(value);
}

// ------------------------------------------------------ display labels

// Legacy enum keys, kept only as a fallback for old data. Categories are
// admin-managed text values now ("Apartment", ...) which display as-is.
const LEGACY_CATEGORY_LABELS: Record<string, string> = {
  DETACHED_DUPLEX: "Detached Duplex",
  SEMI_DETACHED_DUPLEX: "Semi-Detached Duplex",
  APARTMENT: "Apartment",
  TERRACE: "Terrace House",
  BUNGALOW: "Bungalow",
  LAND: "Residential Land",
  COMMERCIAL: "Commercial Property",
};

/** Display label for a property category (legacy enum or admin-managed name). */
export function categoryLabel(category: string): string {
  return LEGACY_CATEGORY_LABELS[category] ?? category;
}

export const AVAILABILITY_LABELS: Record<string, string> = {
  AVAILABLE: "Available",
  UNDER_OFFER: "Under Offer",
  UNAVAILABLE: "Unavailable",
};

export const PROPERTY_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  PENDING_REVIEW: "Pending Review",
  APPROVED: "Approved",
  CHANGES_REQUESTED: "Changes Requested",
  REJECTED: "Not Approved",
  UNAVAILABLE: "Unavailable",
};

/** Enquiry / case status display names, as in the prototype stepper. */
export const CASE_STATUS_LABELS: Record<string, string> = {
  NEW_ENQUIRY: "New Enquiry",
  IN_PROGRESS: "In Progress",
  NEGOTIATION: "Negotiation / Inspection",
  PAYMENT_PENDING: "Payment Pending",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

/** Statuses in stepper order (cancelled sits outside the flow). */
export const CASE_STEPS = [
  "NEW_ENQUIRY",
  "IN_PROGRESS",
  "NEGOTIATION",
  "PAYMENT_PENDING",
  "COMPLETED",
] as const;

export const PURPOSE_LABELS: Record<string, string> = {
  PURCHASE: "Interested in purchasing",
  RENT: "Interested in renting",
  INSPECTION: "Requesting an inspection",
  MORE_INFORMATION: "Requesting more information",
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  OUTSTANDING: "Outstanding",
  AWAITING_PAYMENT: "Awaiting Payment",
  PENDING_CONFIRMATION: "Pending Confirmation",
  SUCCESSFUL: "Successful",
  FAILED: "Failed",
};

/** Tailwind classes per status — one place to keep badges consistent. */
/** Status chip backgrounds exported for list views.
 *  Values are the prototype's chip trios: bg + text + inset ring. */
export const STATUS_TONES: Record<string, string> = {
  APPROVED: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  SUCCESSFUL: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  COMPLETED: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  AVAILABLE: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  PENDING_REVIEW: "bg-amber-50 text-amber-800 ring-amber-200",
  NEW_ENQUIRY: "bg-brand-50 text-brand-800 ring-brand-200",
  OUTSTANDING: "bg-amber-50 text-amber-800 ring-amber-200",
  OPEN: "bg-brand-50 text-brand-800 ring-brand-200",
  IN_PROGRESS: "bg-brand-50 text-brand-800 ring-brand-200",
  NEGOTIATION: "bg-brand-50 text-brand-800 ring-brand-200",
  AWAITING_PAYMENT: "bg-amber-50 text-amber-800 ring-amber-200",
  PAYMENT_PENDING: "bg-amber-50 text-amber-800 ring-amber-200",
  PENDING_CONFIRMATION: "bg-amber-50 text-amber-800 ring-amber-200",
  CHANGES_REQUESTED: "bg-amber-50 text-amber-800 ring-amber-200",
  FAILED: "bg-red-50 text-red-800 ring-red-200",
  CANCELLED: "bg-red-50 text-red-800 ring-red-200",
  REJECTED: "bg-red-50 text-red-800 ring-red-200",
  DRAFT: "bg-slate-100 text-slate-600 ring-slate-200",
  UNAVAILABLE: "bg-slate-100 text-slate-600 ring-slate-200",
};

export function statusTone(status: string): string {
  return STATUS_TONES[status] ?? "bg-brand-50 text-brand-800 ring-brand-200";
}

/** Dot colour inside a status chip — matches the chip's hue family. */
export const STATUS_DOT_TONES: Record<string, string> = {
  APPROVED: "bg-emerald-500",
  SUCCESSFUL: "bg-emerald-500",
  COMPLETED: "bg-emerald-500",
  AVAILABLE: "bg-emerald-500",
  PENDING_REVIEW: "bg-amber-500",
  NEW_ENQUIRY: "bg-brand-500",
  OUTSTANDING: "bg-amber-500",
  OPEN: "bg-brand-500",
  IN_PROGRESS: "bg-brand-500",
  NEGOTIATION: "bg-brand-500",
  AWAITING_PAYMENT: "bg-amber-500",
  PAYMENT_PENDING: "bg-amber-500",
  PENDING_CONFIRMATION: "bg-amber-500",
  CHANGES_REQUESTED: "bg-amber-500",
  FAILED: "bg-red-500",
  CANCELLED: "bg-red-500",
  REJECTED: "bg-red-500",
  DRAFT: "bg-slate-400",
  UNAVAILABLE: "bg-slate-400",
};

export function statusDotTone(status: string): string {
  return STATUS_DOT_TONES[status] ?? "bg-brand-500";
}

function _statusToneOld(status: string): string {
  switch (status) {
    case "APPROVED":
    case "SUCCESSFUL":
    case "COMPLETED":
    case "AVAILABLE":
      return "bg-emerald-50 text-emerald-700";
    case "PENDING_REVIEW":
    case "UNDER_REVIEW":
    case "LAWYER_ASSIGNED":
    case "NEW_ENQUIRY":
    case "OUTSTANDING":
    case "OPEN":
      return "bg-brand-50 text-brand-700";
    case "IN_PROGRESS":
    case "NEGOTIATION":
    case "AWAITING_PAYMENT":
      return "bg-sky-50 text-sky-700";
    case "PAYMENT_PENDING":
    case "PENDING_CONFIRMATION":
      return "bg-amber-50 text-amber-700";
    case "CHANGES_REQUESTED":
    case "FAILED":
    case "CANCELLED":
    case "REJECTED":
      return "bg-rose-50 text-rose-700";
    case "DRAFT":
    case "UNAVAILABLE":
      return "bg-zinc-100 text-zinc-600";
    default:
      return "bg-brand-50 text-brand-700";
  }
}
