"use client";

import type { ReactNode } from "react";
import { ServerCrash } from "lucide-react";

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
  children?: ReactNode;
}

export function ErrorState({
  message = "Something went wrong. Is the backend running?",
  onRetry,
  children,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] gap-4 rounded-3xl border border-red-500/20 bg-red-500/5 p-6 md:p-10">
      <ServerCrash className="w-10 h-10 text-red-500" strokeWidth={1.5} />
      <p className="font-mono text-sm text-red-600/80 dark:text-red-400/80 text-center">{message}</p>
      {children}
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors"
        >
          Retry
        </button>
      )}
    </div>
  );
}
