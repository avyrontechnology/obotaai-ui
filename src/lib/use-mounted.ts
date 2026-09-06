"use client";

import { useSyncExternalStore } from "react";

function subscribe(): () => void {
  return () => {};
}

/**
 * True only after the component hydrated on the client. Server (and the
 * hydration pass itself) always see false, so role/session-gated branches
 * render identically on both sides and flip after hydration — no mismatch.
 * Uses useSyncExternalStore instead of a mounted-flag effect so the
 * set-state-in-effect rule never fires.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
