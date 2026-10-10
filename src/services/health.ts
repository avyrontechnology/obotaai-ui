import { useQuery } from "@tanstack/react-query";
import { API_BASE_URL } from "@/lib/api-client";

export const healthKeys = {
  live: ["health", "live"] as const,
};

/** Public liveness probe (`GET /health/live`) with measured round-trip
 *  latency. One shared query: every `EngineStatus` on the page (desktop +
 *  mobile navbar) and StrictMode remounts reuse a single request. Any HTTP
 *  response counts as reachable; only a network failure is "down". Plain
 *  fetch, not apiClient — no 401 login bounce and no envelope parsing. */
export function useEngineHealth() {
  return useQuery({
    queryKey: healthKeys.live,
    // No abort signal on purpose: consuming it makes Query cancel the
    // in-flight probe on StrictMode's unmount and refetch on remount.
    queryFn: async () => {
      const started = performance.now();
      await fetch(`${API_BASE_URL}/health/live`, { cache: "no-store" });
      return { latencyMs: Math.max(1, Math.round(performance.now() - started)) };
    },
    staleTime: 5 * 60_000,
    retry: false,
  });
}
