"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 p-10">
      <div className="w-24 h-24 rounded-3xl bg-destructive/10 flex items-center justify-center border border-destructive/20">
        <AlertCircle className="w-10 h-10 text-destructive" strokeWidth={1.5} />
      </div>
      <div className="text-center space-y-3 max-w-lg">
        <h2 className="text-3xl font-medium tracking-tight text-foreground">
          Something went wrong
        </h2>
        <p className="font-mono text-sm leading-relaxed text-muted-foreground">
          {error.message || "An unexpected error occurred."}
        </p>
      </div>
      <button 
        onClick={reset}
        className="flex items-center gap-2 px-8 py-3 rounded-xl bg-primary text-primary-foreground font-semibold shadow-lg hover:shadow-xl transition-all"
      >
        <RefreshCw className="w-4 h-4" />
        Try Again
      </button>
    </div>
  );
}
