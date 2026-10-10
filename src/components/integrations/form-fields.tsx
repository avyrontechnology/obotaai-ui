"use client";

import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Shared form primitives for the integrations hub.
 * Goal: every builder/connect dialog speaks one visual language —
 * labeled field + hint + inline error, segmented pickers, alert box.
 */

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <label htmlFor={htmlFor} className="flex flex-col gap-1.5 min-w-0">
      <span className="text-xs font-medium text-foreground">{label}</span>
      {children}
      {error ? (
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      ) : hint ? (
        <span className="text-[11px] text-muted-foreground">{hint}</span>
      ) : null}
    </label>
  );
}

export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: T; title: string; hint: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div className="space-y-1.5 min-w-0">
      <p className="text-xs font-medium text-foreground">{label}</p>
      <div
        role="radiogroup"
        aria-label={label}
        className="grid grid-cols-2 sm:grid-cols-3 gap-2 min-w-0"
      >
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              title={option.hint}
              onClick={() => onChange(option.value)}
              className={cn(
                "p-3 rounded-2xl border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none min-w-0",
                active
                  ? "border-primary/40 bg-primary/10"
                  : "border-border hover:border-muted-foreground/40"
              )}
            >
              <span className="block text-xs font-semibold text-foreground truncate">{option.title}</span>
              <span
                className="block text-[11px] text-muted-foreground truncate mt-0.5"
                title={option.hint}
              >
                {option.hint}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function FormAlert({ message, tone = "error" }: { message: string; tone?: "error" | "warn" }) {
  return (
    <p
      role="alert"
      className={cn(
        "flex items-start gap-2 text-xs rounded-2xl border p-3 min-w-0",
        tone === "error"
          ? "text-destructive border-destructive/20 bg-destructive/5"
          : "text-amber-700 dark:text-amber-300 border-amber-500/20 bg-amber-500/5"
      )}
    >
      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" aria-hidden="true" />
      <span className="min-w-0 break-words">{message}</span>
    </p>
  );
}

export function StepDots({ step, steps }: { step: number; steps: readonly string[] }) {
  return (
    <div className="flex items-center gap-1.5" aria-label={`Step ${step + 1} of ${steps.length}`}>
      {steps.map((label, index) => (
        <span
          key={label}
          title={label}
          className={cn(
            "h-1.5 rounded-full transition-colors motion-reduce:transition-none",
            index === step ? "w-8 bg-primary" : index < step ? "w-4 bg-primary/50" : "w-4 bg-muted"
          )}
        />
      ))}
    </div>
  );
}
