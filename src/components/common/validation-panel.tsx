"use client";

import { AlertCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ValidationPanelProps {
  valid: boolean;
  errors: string[];
  warnings: string[];
  validLabel?: string;
  invalidLabel?: (count: number) => string;
}

export function ValidationPanel({
  valid,
  errors,
  warnings,
  validLabel = "Valid",
  invalidLabel = (count) => `${count} problem${count === 1 ? "" : "s"} found`,
}: ValidationPanelProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4 md:p-5 space-y-2 min-w-0",
        valid ? "border-emerald-500/20 bg-emerald-500/5" : "border-red-500/20 bg-red-500/5"
      )}
    >
      <p
        className={cn(
          "text-sm font-semibold",
          valid ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"
        )}
      >
        {valid ? validLabel : invalidLabel(errors.length)}
      </p>
      {errors.map((error) => (
        <p key={error} className="flex items-start gap-2 text-sm text-red-700 dark:text-red-400">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
        </p>
      ))}
      {warnings.map((warning) => (
        <p key={warning} className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {warning}
        </p>
      ))}
    </div>
  );
}
