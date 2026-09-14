"use client";

import { useEffect, useRef } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    console.error(error);
  }, [error]);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-labelledby="error-heading"
      aria-describedby="error-description"
      className="flex flex-col items-center justify-center min-h-[60dvh] gap-6 p-6 md:p-10"
    >
      <div className="w-24 h-24 rounded-3xl bg-destructive/10 flex items-center justify-center border border-destructive/20">
        <AlertCircle className="w-10 h-10 text-destructive" strokeWidth={1.5} aria-hidden="true" />
      </div>
      <div className="text-center space-y-3 max-w-lg">
        <h2
          id="error-heading"
          ref={headingRef}
          tabIndex={-1}
          className="text-3xl font-medium tracking-tight text-foreground scroll-mt-20 outline-none"
        >
          Something went wrong
        </h2>
        <p
          id="error-description"
          className="font-mono text-sm leading-relaxed text-muted-foreground"
        >
          {error.message || "An unexpected error occurred."}
        </p>
        {error.digest ? (
          <p className="font-mono text-xs leading-relaxed text-muted-foreground/80">
            Error reference: {error.digest}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={reset}
        className="flex cursor-pointer items-center gap-2 px-8 py-3 rounded-xl bg-primary text-primary-foreground font-semibold shadow-lg hover:shadow-xl hover:bg-primary/90 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <RefreshCw className="w-4 h-4" aria-hidden="true" />
        Try Again
      </button>
    </div>
  );
}
