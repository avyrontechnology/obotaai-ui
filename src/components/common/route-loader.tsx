"use client";

import { Loader2 } from "lucide-react";

export function RouteLoader({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
      <div className="relative">
        <div className="absolute inset-0 bg-primary/20 dark:bg-primary/40 blur-[40px] rounded-full animate-pulse" />
        <Loader2 className="w-12 h-12 animate-spin text-primary relative z-10" />
      </div>
      <p className="font-mono text-sm tracking-[0.2em] uppercase animate-pulse text-muted-foreground">
        {label}
      </p>
    </div>
  );
}
