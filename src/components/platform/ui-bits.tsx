"use client";

/**
 * ELVICTORIA shared UI primitives.
 *
 * Styled to match the reviewed prototype exactly (brand-700 actions,
 * rounded-lg inputs, paper background). Kept dependency-free besides
 * Tailwind so every screen reads the same visual language.
 */
import Link from "next/link";
import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, type ButtonHTMLAttributes, type ReactNode } from "react";
import { statusTone, statusDotTone } from "@/lib/format";

// ---------------------------------------------------------------- logo

export function Logo({ href = "/", light = false }: { href?: string; light?: boolean }) {
  // Wordmark and mark are lifted 1:1 from the prototype header SVG.
  return (
    <Link href={href} className="inline-flex items-center gap-2.5" aria-label="ELVICTORIA home">
      <svg viewBox="0 0 40 40" className="h-9 w-9 shrink-0" aria-hidden>
        <rect width="40" height="40" rx="9" fill={light ? "#ffffff" : "#6b1d2c"} />
        <path d="M11 29 L11 13 L20 8 L29 13 L29 29" fill="none" stroke="#cfa04a" strokeWidth="2.2" strokeLinejoin="round" />
        <path
          d="M15.5 29 V18 h9 M15.5 23.5 h7 M15.5 29 h9"
          fill="none"
          stroke={light ? "#6b1d2c" : "#ffffff"}
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </svg>
      <span className={`font-display text-2xl leading-none tracking-wide ${light ? "text-white" : "text-ink-strong"}`}>
        EL<span className="text-gold-500">V</span>ICTORIA
      </span>
    </Link>
  );
}

// -------------------------------------------------------------- inputs

// Prototype .input recipe: brand-100 border, 17px text, brand-400 focus.
const inputClasses =
  "w-full rounded-lg border border-brand-100 bg-white px-3.5 py-2.5 text-base text-ink placeholder:text-ink-muted/70 " +
  "transition-colors focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 " +
  "disabled:cursor-not-allowed disabled:bg-brand-50 disabled:text-ink-muted";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={`${inputClasses} ${className ?? ""}`} {...props} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, rows = 4, ...props }, ref) {
    return <textarea ref={ref} rows={rows} className={`${inputClasses} ${className ?? ""}`} {...props} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select
        ref={ref}
        // Chevron and placement match the prototype's custom selects.
        className={`${inputClasses} appearance-none bg-[length:16px] bg-[right_0.75rem_center] bg-no-repeat pr-9 ${className ?? ""}`}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236b7385' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        }}
        {...props}
      >
        {children}
      </select>
    );
  },
);

/** Label + control + error + hint wrapper used on every form. */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="label">
        {label}
        {required && <span className="ml-0.5 text-red-600" aria-hidden>*</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
      {error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}

// ------------------------------------------------------------- buttons

type ButtonVariant = "primary" | "outline" | "ghost" | "danger" | "gold";
type ButtonSize = "sm" | "md" | "lg";

// Base string lifted from the prototype's rendered buttons; variants and
// sizes mirror the exact class combinations found in its DOM.
const buttonBase =
  "inline-flex select-none items-center justify-center whitespace-nowrap rounded-lg font-medium transition " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/60 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

const buttonVariantClasses: Record<ButtonVariant, string> = {
  primary: "bg-brand-800 text-white hover:bg-brand-700 shadow-sm",
  outline: "border border-brand-200 bg-white text-brand-800 hover:bg-brand-50 shadow-sm",
  ghost: "text-brand-700 hover:bg-brand-50",
  danger: "bg-red-600 text-white hover:bg-red-700 shadow-sm",
  gold: "bg-gold-400 text-brand-950 hover:bg-gold-300 shadow-sm",
};

const buttonSizeClasses: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  loading,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}) {
  return (
    <button
      className={`${buttonBase} ${buttonVariantClasses[variant]} ${buttonSizeClasses[size]} ${className ?? ""}`}
      disabled={props.disabled || loading}
      {...props}
    >
      {loading && (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />
      )}
      {children}
    </button>
  );
}

// ---------------------------------------------------------- containers

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  // Prototype card surface: blush border + wine-tinted card shadow.
  return (
    <div className={`rounded-xl border border-brand-100/80 bg-white shadow-card ${className ?? ""}`}>
      {children}
    </div>
  );
}

export function Badge({ tone, children }: { tone?: string; children: ReactNode }) {
  // Prototype status chip: pill with an inset ring; tone supplies the
  // bg/text/ring trio from STATUS_TONES.
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${tone ?? "bg-brand-50 text-brand-800 ring-brand-200"}`}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const tone = statusTone(status);
  return (
    <Badge tone={tone}>
      <span className={`h-1.5 w-1.5 rounded-full ${statusDotTone(status)}`} aria-hidden />
      {label ?? status.replace(/_/g, " ")}
    </Badge>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={`inline-block h-5 w-5 animate-spin rounded-full border-2 border-brand-200 border-t-brand-700 ${className ?? ""}`}
      role="status"
      aria-label="Loading"
    />
  );
}

export function PageLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-ink-muted">
      <Spinner />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-brand-200 bg-white/60 px-6 py-12 text-center">
      <p className="font-medium text-ink-strong">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function Alert({ tone = "info", children }: { tone?: "info" | "error" | "success"; children: ReactNode }) {
  const tones = {
    info: "border-sky-200 bg-sky-50 text-sky-800",
    error: "border-red-200 bg-red-50 text-red-800",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  };
  return (
    <div role="alert" className={`rounded-lg border px-4 py-3 text-sm ${tones[tone]}`}>
      {children}
    </div>
  );
}

/** Stat card used on every dashboard — prototype tile with icon chip. */
export function StatCard({
  label,
  value,
  hint,
  icon,
  iconTone = "brand",
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  /** "brand" = blush tile, "gold" = warm attention tile. */
  iconTone?: "brand" | "gold";
  href?: string;
}) {
  const tileTones = iconTone === "gold" ? "bg-gold-400/15 text-gold-600" : "bg-brand-50 text-brand-700";
  const body = (
    <div className="flex h-full items-start justify-between gap-3 rounded-xl border border-brand-100/80 bg-white p-4 shadow-card transition hover:border-brand-200 hover:shadow-lift">
      <div className="min-w-0">
        <p className="text-sm text-ink-muted">{label}</p>
        <p className="mt-1.5 text-2xl font-semibold tracking-tight text-ink-strong">{value}</p>
        {hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
      </div>
      {icon && <span className={`rounded-lg p-2 ${tileTones}`}>{icon}</span>}
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}

/** Section title row with optional trailing action. */
export function SectionHeader({
  title,
  action,
  description,
}: {
  title: string;
  action?: ReactNode;
  description?: string;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        {/* Prototype card-section headings: text-base semibold ink. */}
        <h2 className="text-base font-semibold text-ink-strong">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** Trust bullets reused across public pages (exact prototype copy). */
export function TrustPanel({ compact = false }: { compact?: boolean }) {
  return (
    <div className="rounded-xl bg-brand-50/70 p-5">
      <p className="flex items-center gap-2 font-semibold text-brand-700">
        <ShieldIcon className="h-4 w-4 shrink-0" />
        Lawyers handle everything — not strangers.
      </p>
      <ul className={`mt-2 space-y-1 text-sm text-ink-soft ${compact ? "" : "ml-6"}`}>
        {[
          "Lawyers handle every enquiry",
          "Your details stay confidential",
          "Every listing is reviewed",
        ].map((item) => (
          <li key={item} className="flex items-center gap-2">
            <CheckIcon className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ----------------------------------------------------------- auth shell

/** Split-screen frame for the auth pages, lifted from the prototype:
 *  form column with logo, mobile trust note, and the full-bleed dark
 *  photo panel with the tagline and trust bullets. */
export function AuthShell({
  heading,
  intro,
  children,
}: {
  heading: string;
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col px-5 py-8 sm:px-10">
        <Logo />
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <h1 className="font-display text-3xl">{heading}</h1>
          {intro && <p className="mt-2 text-ink-soft">{intro}</p>}
          <p className="mt-4 flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-sm font-medium text-brand-900 lg:hidden">
            <ShieldIcon className="h-4 w-4 shrink-0 text-brand-700" />
            Lawyers handle everything — not strangers.
          </p>
          <div className="mt-8">{children}</div>
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-brand-950 lg:block">
        <img
          src="https://images.unsplash.com/photo-1643297551340-19d8ad4f20ad?auto=format&fit=crop&w=1400&q=82"
          alt="Contemporary home"
          className="object-cover absolute inset-0 h-full w-full opacity-80"
          loading="eager"
          decoding="async"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-950 via-brand-950/30 to-transparent" />
        <div className="absolute bottom-0 p-12 text-white">
          <ScaleIcon className="h-6 w-6 text-gold-400" />
          <p className="mt-4 max-w-md font-display text-3xl text-white">
            Lawyers handle everything — not strangers.
          </p>
          <ul className="mt-4 max-w-md space-y-2 text-white/85">
            {[
              "Lawyers handle every enquiry",
              "Your details stay confidential",
              "Every listing is reviewed",
              "Safer payments",
            ].map((item) => (
              <li key={item} className="flex gap-2">
                <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-gold-400" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------- icons
// Minimal inline icons (lucide-style) so shared components stay portable.

export function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    </svg>
  );
}

export function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function HeartIcon({ className, filled }: { className?: string; filled?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  );
}

export function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

export function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

export function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

export function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

export function EyeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 11s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <path d="m2 2 20 20" />
    </svg>
  );
}

export function BuildingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect width="16" height="20" x="4" y="2" rx="2" />
      <path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M8 10h.01M16 10h.01M12 10h.01M8 14h.01M16 14h.01M12 14h.01" />
    </svg>
  );
}

export function FileIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    </svg>
  );
}

export function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function EnvelopeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

export function ScaleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
      <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
      <path d="M7 21h10M12 3v18M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
    </svg>
  );
}

export function AlertTriangleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}

export function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

export function BriefcaseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect width="20" height="14" x="2" y="7" rx="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}

export function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

export function CreditCardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <path d="M2 10h20" />
    </svg>
  );
}

export function HelpCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" />
    </svg>
  );
}

export function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function LayoutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M3 9h18M9 21V9" />
    </svg>
  );
}

export function LogoutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5M21 12H9" />
    </svg>
  );
}

export function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export function TagIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" />
      <circle cx="7.5" cy="7.5" r=".5" fill="currentColor" />
    </svg>
  );
}

export function BedIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8" />
      <path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4" />
      <path d="M12 4v6" />
      <path d="M2 18h20" />
    </svg>
  );
}

export function BathIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10 4 8 6" />
      <path d="M17 19v2" />
      <path d="M2 12h20" />
      <path d="M7 19v2" />
      <path d="M9 5 7.621 3.621A2.121 2.121 0 0 0 4 5v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5" />
    </svg>
  );
}

export function AreaIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M15 3h6v6" />
      <path d="m21 3-7 7" />
      <path d="m3 21 7-7" />
      <path d="M9 21H3v-6" />
    </svg>
  );
}

export function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

export function MenuIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 5h16" />
      <path d="M4 12h16" />
      <path d="M4 19h16" />
    </svg>
  );
}
