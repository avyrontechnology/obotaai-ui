"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Shared summary-stat primitives for the Manage (settings) section.
 * Mirrors the Call History `CallsKpiStrip` Card/BigValue pattern:
 * rounded-3xl, uppercase-mono headers, tabular-nums values, footer captions.
 * Theme tokens only. Values are always honest — callers pass precomputed
 * strings (or "—" when the underlying hook has no data).
 */
export function SettingsStatsGrid({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6"
      role="region"
      aria-label={label}
    >
      {children}
    </div>
  );
}

export const SettingsStatCard = memo(function SettingsStatCard({
  title,
  icon: Icon,
  value,
  caption,
  loading = false,
  delay = 0,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  caption?: string;
  loading?: boolean;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className="rounded-3xl border border-border bg-card p-5 flex flex-col gap-2 min-w-0 motion-reduce:transition-none"
    >
      <div className="flex items-center gap-2 text-muted-foreground min-w-0">
        <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <p className="text-[11px] font-mono uppercase tracking-widest truncate">{title}</p>
      </div>
      {loading ? (
        <div className="h-7 w-20 rounded bg-muted animate-pulse motion-reduce:animate-none" />
      ) : (
        <p
          className="text-xl lg:text-2xl font-semibold tracking-tight text-foreground tabular-nums truncate"
          title={value}
        >
          {value}
        </p>
      )}
      {caption !== undefined && (
        <p
          className={cn("text-xs tabular-nums truncate", "text-muted-foreground")}
          title={caption}
        >
          {loading ? (
            <span className="inline-block h-3 w-28 rounded bg-muted animate-pulse motion-reduce:animate-none" />
          ) : (
            caption
          )}
        </p>
      )}
    </motion.div>
  );
});
