"use client";

import { Loader2 } from "lucide-react";

export function RouteLoader({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
      <div className="relative">
        <div className="absolute inset-0 bg-primary/20 dark:bg-primary/40 blur-[40px] rounded-full animate-pulse motion-reduce:animate-none" aria-hidden="true" />
        <Loader2 className="w-12 h-12 animate-spin motion-reduce:animate-none text-primary relative z-10" aria-hidden="true" />
      </div>
      <p className="font-mono text-sm tracking-[0.2em] uppercase animate-pulse motion-reduce:animate-none text-muted-foreground">
        {label}
      </p>
    </div>
  );
}
