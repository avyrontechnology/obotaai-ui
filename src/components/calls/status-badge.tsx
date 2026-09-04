"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";
import type { Execution } from "@/lib/schemas/platform";

type Status = Execution["status"];

const STYLES: Record<Status, { pill: string; dot: string; pulse: boolean; label: string }> = {
  completed: {
    pill: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
    dot: "bg-emerald-500",
    pulse: false,
    label: "Completed",
  },
  failed: {
    pill: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
    dot: "bg-red-500",
    pulse: false,
    label: "Failed",
  },
  in_progress: {
    pill: "bg-ember-400/10 text-ember-700 dark:text-ember-300 border-ember-400/20",
    dot: "bg-ember-400",
    pulse: true,
    label: "In progress",
  },
  ringing: {
    pill: "bg-ember-400/10 text-ember-700 dark:text-ember-300 border-ember-400/20",
    dot: "bg-ember-400",
    pulse: true,
    label: "Ringing",
  },
  queued: {
    pill: "bg-muted text-muted-foreground border-border",
    dot: "bg-muted-foreground",
    pulse: true,
    label: "Queued",
  },
  "no-answer": {
    pill: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
    dot: "bg-amber-500",
    pulse: false,
    label: "No answer",
  },
  busy: {
    pill: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
    dot: "bg-amber-500",
    pulse: false,
    label: "Busy",
  },
  canceled: {
    pill: "bg-muted text-muted-foreground border-border",
    dot: "bg-muted-foreground",
    pulse: false,
    label: "Canceled",
  },
};

export const TERMINAL_STATUSES: Status[] = ["completed", "failed", "no-answer", "busy", "canceled"];

export function isTerminal(status: Status): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export const StatusBadge = memo(function StatusBadge({ status }: { status: Status }) {
  const style = STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
        style.pill
      )}
    >
      <span className="relative flex h-1.5 w-1.5">
        {style.pulse && (
          <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", style.dot)} />
        )}
        <span className={cn("relative inline-flex rounded-full h-1.5 w-1.5", style.dot)} />
      </span>
      {style.label}
    </span>
  );
});
