"use client";

import { useCallback, useEffect, useRef } from "react";
import { API_BASE_URL } from "@/lib/api-client";

/**
 * OAuth popup handshake for the MCP provider-login flow.
 *
 * The backend callback page (`voiceai/modules/tools/oauth_service.py` → `GET
 * /api/v1/oauth/callback`) renders a tiny page in the popup that calls
 * `window.opener.postMessage({type:"oauth:connected", ok, provider}, "*")`
 * and closes itself. The target origin is `*` because the callback is served by
 * the API host, which is not the app origin — so the *receiver* is the only
 * place an origin check can live. Without it, any frame (or any extension)
 * that can reach this window can forge `ok:true` for a provider slug and make
 * the builder skip the credential-seal step entirely.
 *
 * Three things this hook fixes over the inline version it replaces:
 *  1. `event.origin` is checked against the API origin before the payload is
 *     read, and `event.source` must be the popup window we opened.
 *  2. The listener is registered *before* `window.open`, and removed explicitly
 *     — `{ once: true }` fired on the first message of any kind, so an
 *     unrelated `postMessage` consumed the handshake and the real callback was
 *     ignored.
 *  3. The listener is torn down on unmount, so closing the modal with the
 *     popup still open can't `setState` on an unmounted component.
 *
 * The popup is opened synchronously inside `start()` (before the authorize-url
 * mutation) and navigated once the URL arrives, because a `window.open` after
 * an `await` is outside the user-activation window and gets blocked.
 */

/** Origin of the API host that serves the callback page.
 *
 *  Resolved lazily, not at module load: `API_BASE_URL` is empty during
 *  prerender (no public env in that worker), and a module-level `new URL("")`
 *  throws — which broke the `/integrations` static export outright. */
function callbackOrigin(): string | null {
  try {
    return new URL(API_BASE_URL).origin;
  } catch {
    return null;
  }
}

/** Popup geometry, identical for both flows. */
const POPUP_FEATURES = "width=600,height=700";

/** Window name, so a re-login reuses the same popup instead of stacking. */
const POPUP_NAME = "oauth-login";

/** The `type` the backend callback page posts. Mirrors `_POSTMESSAGE_TYPE`. */
const POSTMESSAGE_TYPE = "oauth:connected";

interface CallbackPayload {
  type?: string;
  ok?: boolean;
  provider?: string;
}

export interface OAuthPopupHandlers {
  /** The provider slug whose handshake this popup belongs to. */
  provider: string;
  /** The backend verified the login and sealed the credential server-side. */
  onConnected: () => void;
  /** The popup reported `ok:false`, or the handshake was malformed. */
  onFailed: () => void;
}

/**
 * Drive one OAuth popup login.
 *
 * @returns `start` to launch the handshake (returns the window handle, or
 *   `null` when the popup was blocked) and `close` to tear it down early.
 */
export function useOAuthPopup({ provider, onConnected, onFailed }: OAuthPopupHandlers) {
  const popupRef = useRef<Window | null>(null);
  const listenerRef = useRef<((event: MessageEvent) => void) | null>(null);
  // Handlers are read through a ref so `start` keeps a stable identity and the
  // listener never has to be re-registered when a caller re-renders. Synced in
  // an effect rather than assigned during render (the compiler rejects that,
  // and a render-phase write is what this ref exists to avoid anyway).
  const handlersRef = useRef({ onConnected, onFailed });
  useEffect(() => {
    handlersRef.current = { onConnected, onFailed };
  }, [onConnected, onFailed]);

  const close = useCallback(() => {
    if (listenerRef.current) {
      window.removeEventListener("message", listenerRef.current);
      listenerRef.current = null;
    }
    popupRef.current?.close();
    popupRef.current = null;
  }, []);

  // Unmount with the popup still open: drop the listener and close the window.
  useEffect(() => close, [close]);

  /**
   * Open the popup and arm the handshake listener.
   *
   * Call this synchronously from a click handler so the browser still counts it
   * as user-activated; then navigate it with {@link useOAuthPopup.navigate}
   * once the authorize URL is minted.
   *
   * @returns The popup window, or `null` if the browser blocked it.
   */
  const start = useCallback(() => {
    const expectedOrigin = callbackOrigin();
    if (!expectedOrigin) return null;

    const onMessage = (event: MessageEvent) => {
      // The callback page is served by the API host, not the app origin.
      if (event.origin !== expectedOrigin) return;
      // Only our own popup may answer — a same-origin frame cannot.
      if (event.source !== popupRef.current) return;

      const data = event.data as CallbackPayload | null;
      if (!data || typeof data !== "object" || data.type !== POSTMESSAGE_TYPE) return;

      // Matched the handshake: stop listening before dispatching so a second
      // callback for the same popup can't re-enter the handler.
      if (listenerRef.current) {
        window.removeEventListener("message", listenerRef.current);
        listenerRef.current = null;
      }

      if (data.ok && data.provider === provider) handlersRef.current.onConnected();
      else handlersRef.current.onFailed();
    };

    listenerRef.current = onMessage;
    window.addEventListener("message", onMessage);

    const popup = window.open("", POPUP_NAME, POPUP_FEATURES);
    if (!popup) {
      // No popup means no handshake; drop the listener we just armed.
      window.removeEventListener("message", onMessage);
      listenerRef.current = null;
      return null;
    }
    popupRef.current = popup;
    return popup;
  }, [provider]);

  /** Point an already-open popup at the minted authorization URL. */
  const navigate = useCallback((url: string) => {
    const popup = popupRef.current;
    if (!popup) return;
    popup.location.href = url;
  }, []);

  return { start, navigate, close };
}