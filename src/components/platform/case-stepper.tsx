"use client";

/**
 * Case progress stepper — the 7-stage flow from the prototype
 * (New Enquiry → … → Completed). Cancelled renders as a separate state.
 */
import { CASE_STEPS, CASE_STATUS_LABELS } from "@/lib/format";
import { CheckIcon, AlertTriangleIcon } from "./ui-bits";

export function CaseStepper({ status, clientMode = false }: { status: string; clientMode?: boolean }) {
  if (status === "CANCELLED") {
    return (
      <ol className="flex flex-wrap items-center gap-2 text-sm">
        <li className="flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1.5 text-rose-700">
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
    <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
      {CASE_STEPS.map((step, index) => {
        const done = index < current;
        const active = index === current;
        const label = clientMode ? (clientLabels[step] ?? CASE_STATUS_LABELS[step]) : CASE_STATUS_LABELS[step];
        return (
          <li
            key={step}
            aria-current={active ? "step" : undefined}
            className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs font-medium ${
              done
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : active
                  ? "border-brand-600 bg-brand-700 text-white"
                  : "border-zinc-200 bg-white text-ink-muted"
            }`}
          >
            {done ? (
              <CheckIcon className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <span
                className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ${
                  active ? "bg-white/20" : "bg-zinc-100"
                }`}
              >
                {index + 1}
              </span>
            )}
            <span className="leading-tight">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
