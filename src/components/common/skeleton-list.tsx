"use client";

import { cn } from "@/lib/utils";

interface SkeletonListProps {
  rows?: number;
  rowClassName?: string;
}

export function SkeletonList({ rows = 3, rowClassName }: SkeletonListProps) {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          data-testid="skeleton-row"
          className={cn("h-20 rounded-3xl bg-card border border-border animate-pulse", rowClassName)}
        />
      ))}
    </div>
  );
}
