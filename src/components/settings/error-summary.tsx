"use client";

import { useEffect, useRef } from "react";
import { useFormContext } from "react-hook-form";
import { AlertCircle } from "lucide-react";

export interface ErrorSummaryItem {
  path: string;
  message: string;
}

/**
 * Flatten a nested react-hook-form errors object into a list of
 * `{ path, message }` entries (depth-first, e.g. `agent_config.llm.model`).
 * Used by the error summary and shared with tests.
 */
export function flattenErrors(errors: Record<string, unknown>, prefix = ""): ErrorSummaryItem[] {
  const items: ErrorSummaryItem[] = [];
  for (const [key, value] of Object.entries(errors)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === "object") {
      const record = value as Record<string, unknown>;
      if (typeof record.message === "string") {
        items.push({ path, message: record.message });
      } else {
        items.push(...flattenErrors(record, path));
      }
    }
  }
  return items;
}

/**
 * Presentational summary: renders role=alert + focus + field links from a
 * pre-flattened item list. Use directly when the form is NOT wrapped in a
 * FormProvider (e.g. AgentWizard, which drives RHF via `useForm` return).
 */
export function ErrorSummaryView({
  items,
  title = "Please fix the following before saving",
}: {
  items: ErrorSummaryItem[];
  title?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Focus the summary when errors appear so screen-reader and keyboard
  // users are taken to it. Focusing is a DOM effect, not React state —
  // no setState-in-effect cascade.
  useEffect(() => {
    if (items.length > 0) {
      ref.current?.focus();
    }
  }, [items.length]);

  if (items.length === 0) return null;

  return (
    <div
      ref={ref}
      role="alert"
      tabIndex={-1}
      aria-labelledby="form-error-summary-title"
      className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/5 p-4 md:p-5 min-w-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 motion-reduce:transition-none"
    >
      <div className="flex items-center gap-2 mb-2 min-w-0">
        <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" aria-hidden="true" />
        <h2 id="form-error-summary-title" className="text-sm font-semibold text-red-700 dark:text-red-300 truncate">
          {title} ({items.length})
        </h2>
      </div>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item.path} className="min-w-0">
            <a
              href={`#${item.path}`}
              onClick={(event) => {
                // Move focus to the field in addition to scrolling to it.
                const target = document.getElementById(item.path) as HTMLElement | null;
                if (target) {
                  event.preventDefault();
                  target.focus({ preventScroll: false });
                  // jsdom (tests) has no scrollIntoView — guard it.
                  target.scrollIntoView?.({ block: "center", behavior: "smooth" });
                }
              }}
              className="block truncate text-sm text-red-700 dark:text-red-300 hover:text-red-800 dark:hover:text-red-200 underline underline-offset-2 rounded cursor-pointer transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60"
            >
              {item.message}
              <span className="sr-only"> (go to {item.path})</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Accessible validation summary for agent forms (wizard + configure).
 *
 * - `role="alert"` announces the failure to screen readers.
 * - Auto-focuses (tabIndex -1) so keyboard users land on the summary.
 * - Each item links to its field (`#<path>` matches RHF input ids), so
 *   activating a link moves focus to the offending control.
 * - Inline field errors are retained — this summary is additive, never a
 *   replacement.
 *
 * Renders nothing when the form has no errors. Place it at the top of the
 * `<form>` inside the `FormProvider` so it reads `formState.errors` live.
 * For forms driven directly by `useForm` (no provider, e.g. AgentWizard),
 * use `ErrorSummaryView` with `flattenErrors(form.formState.errors)` instead.
 * Stacks full-width at 375px (`min-w-0`, wrapping links).
 */
export function FormErrorSummary({ title = "Please fix the following before saving" }: { title?: string }) {
  const { formState: { errors } } = useFormContext();
  const items = flattenErrors(errors as Record<string, unknown>);
  return <ErrorSummaryView items={items} title={title} />;
}
