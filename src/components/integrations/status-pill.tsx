"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type IntegrationStatus = "on" | "off" | "live" | "new" | "attention";

/**
 * Single badge language for the whole integrations hub.
 * Before: On/Off vs Live/New vs Key set/No key scattered across
 * IntegrationCard / TemplateCard / PartnerCard.
 */
export function StatusPill({
  status,
  title,
}: {
  status: IntegrationStatus;
  title?: string;
}) {
  const active = status === "on" || status === "live";
  const label =
    status === "on"
      ? "On"
      : status === "off"
        ? "Off"
        : status === "live"
          ? "Live"
          : status === "new"
            ? "New"
            : "Needs attention";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider border shrink-0",
        active
          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
          : status === "attention"
            ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20"
            : "bg-muted text-muted-foreground border-border"
      )}
      title={title ?? label}
    >
      {active && <Check className="w-3 h-3" aria-hidden="true" />}
      {label}
    </span>
  );
}
