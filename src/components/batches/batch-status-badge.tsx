"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";
import type { Batch } from "@/lib/schemas/platform";

type Status = Batch["status"];

const STYLES: Record<Status, { pill: string; dot: string; pulse: boolean; label: string }> = {
  draft: {
    pill: "bg-muted text-muted-foreground border-border",
    dot: "bg-muted-foreground",
    pulse: false,
    label: "Draft",
  },
  scheduled: {
    pill: "bg-ember-400/10 text-ember-700 dark:text-ember-300 border-ember-400/20",
    dot: "bg-ember-400",
    pulse: false,
    label: "Scheduled",
  },
  running: {
    pill: "bg-ember-400/10 text-ember-700 dark:text-ember-300 border-ember-400/20",
    dot: "bg-ember-400",
    pulse: true,
    label: "Running",
  },
  paused: {
    pill: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
    dot: "bg-amber-500",
    pulse: false,
    label: "Paused",
  },
  completed: {
    pill: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
    dot: "bg-emerald-500",
    pulse: false,
    label: "Completed",
  },
  stopped: {
    pill: "bg-muted text-muted-foreground border-border",
    dot: "bg-muted-foreground",
    pulse: false,
    label: "Stopped",
  },
};

export const BatchStatusBadge = memo(function BatchStatusBadge({ status }: { status: Status }) {
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
