"use client";

import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { notify } from "@/lib/notify";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        // Safety net: every failed mutation toasts the backend message,
        // so no action ever fails silently.
        mutationCache: new MutationCache({
          onError: (error) => notify.error("Request failed", error),
        }),
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
