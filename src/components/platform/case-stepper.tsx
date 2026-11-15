"use client";

/**
 * Case progress stepper — the 7-stage flow from the prototype, rendered
 * as its horizontal stage rail: done circles in brand-700 with a check,
 * the current stage in gold, upcoming stages outlined, connected by a
 * hairline that fills as the case progresses.
 */
import { CASE_STEPS, CASE_STATUS_LABELS } from "@/lib/format";
import { CheckIcon, AlertTriangleIcon } from "./ui-bits";

export function CaseStepper({ status, clientMode = false }: { status: string; clientMode?: boolean }) {
  if (status === "CANCELLED") {
    return (
      <ol className="flex flex-wrap items-center gap-2 text-sm">
        <li className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1.5 text-red-800 ring-1 ring-inset ring-red-200">
          <AlertTriangleIcon className="h-4 w-4" />
          Cancelled
        </li>
      </ol>
    );
  }

  const current = CASE_STEPS.indexOf(status as (typeof CASE_STEPS)[number]);
  const clientLabels: Partial<Record<string, string>> = {
    NEW_ENQUIRY: "Enquiry submitted",
    UNDER_REVIEW: "Under review",
    LAWYER_ASSIGNED: "Lawyer handling your enquiry",
    PAYMENT_PENDING: "Payment requested",
  };

  return (
    <div className="scrollbar-thin overflow-x-auto">
      <ol className="flex min-w-[640px] items-start">
        {CASE_STEPS.map((step, index) => {
          const done = index < current;
          const active = index === current;
          const label = clientMode ? (clientLabels[step] ?? CASE_STATUS_LABELS[step]) : CASE_STATUS_LABELS[step];
          return (
            <li
              key={step}
              aria-current={active ? "step" : undefined}
              className="relative flex flex-1 flex-col items-center text-center"
            >
              {index > 0 && (
                <span
                  aria-hidden
                  className={`absolute right-1/2 top-3.5 h-0.5 w-full -translate-y-1/2 ${
                    done || active ? "bg-brand-600" : "bg-brand-100"
                  }`}
                />
              )}
              <span
                className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-semibold ${
                  done
                    ? "border-brand-700 bg-brand-700 text-white"
                    : active
                      ? "border-gold-500 bg-gold-50 text-gold-700"
                      : "border-brand-100 bg-white text-ink-muted"
                }`}
              >
                {done ? <CheckIcon className="h-3.5 w-3.5" /> : index + 1}
              </span>
              <span className={`mt-2 px-1 text-2xs leading-tight ${active ? "font-semibold text-ink-strong" : "text-ink-muted"}`}>
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
