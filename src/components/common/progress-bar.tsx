"use client";

import { cn } from "@/lib/utils";

interface ProgressBarProps {
  value: number;
  className?: string;
}

export function ProgressBar({ value, className }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div className={cn("flex-1 h-2 rounded-full bg-muted overflow-hidden", className)}>
      <div
        data-testid="progress-fill"
        className="h-full rounded-full bg-gradient-to-r from-ember-600 to-primary dark:from-ember-400 dark:to-ember-300 transition-all duration-500"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
