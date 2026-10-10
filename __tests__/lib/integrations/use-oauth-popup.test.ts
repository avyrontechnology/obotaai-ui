import { act, renderHook } from "@testing-library/react";
import { useOAuthPopup } from "@/lib/integrations/use-oauth-popup";
import { API_BASE_URL } from "@/lib/api-client";

/** The origin the backend callback page is served from. */
const CALLBACK_ORIGIN = new URL(API_BASE_URL).origin;
const EVIL_ORIGIN = "https://attacker.example";

/** Minimal Window stand-in for the popup `start()` opens. */
function makePopup() {
  return { location: { href: "" }, close: jest.fn() } as unknown as Window;
}

let popup: Window;

beforeEach(() => {
  popup = makePopup();
  jest.spyOn(window, "open").mockReturnValue(popup);
});

afterEach(() => {
  jest.restoreAllMocks();
});

/** Dispatch a `message` event as the browser would deliver it. */
function postMessage(data: unknown, origin: string, source: Window | null = popup) {
  const event = new MessageEvent("message", { data, origin });
  Object.defineProperty(event, "source", { value: source });
  act(() => {
    window.dispatchEvent(event);
  });
}

function setup(handlers: { onConnected?: () => void; onFailed?: () => void } = {}) {
  const onConnected = handlers.onConnected ?? jest.fn();
  const onFailed = handlers.onFailed ?? jest.fn();
  const view = renderHook(() => useOAuthPopup({ provider: "github", onConnected, onFailed }));
  return { onConnected, onFailed, ...view };
}

const CONNECTED = { type: "oauth:connected", ok: true, provider: "github" };

describe("useOAuthPopup", () => {
  it("accepts a handshake from the API origin, posted by our popup", () => {
    const { onConnected, result } = setup();
    act(() => {
      result.current.start();
    });
    postMessage(CONNECTED, CALLBACK_ORIGIN);
    expect(onConnected).toHaveBeenCalledTimes(1);
  });

  it("ignores a forged handshake from a foreign origin", () => {
    // The regression this hook exists for: the backend posts with targetOrigin
    // "*", so without a receiver-side check any frame could claim `ok: true`
    // and make the builder skip sealing the credential.
    const { onConnected, onFailed, result } = setup();
    act(() => {
      result.current.start();
    });
    postMessage(CONNECTED, EVIL_ORIGIN);
    expect(onConnected).not.toHaveBeenCalled();
    expect(onFailed).not.toHaveBeenCalled();
  });

  it("ignores a handshake from the right origin but a different window", () => {
    const { onConnected, result } = setup();
    act(() => {
      result.current.start();
    });
    postMessage(CONNECTED, CALLBACK_ORIGIN, makePopup());
    expect(onConnected).not.toHaveBeenCalled();
  });

  it("reports failure when the callback reports ok:false", () => {
    const { onConnected, onFailed, result } = setup();
    act(() => {
      result.current.start();
    });
    postMessage({ type: "oauth:connected", ok: false, provider: "github" }, CALLBACK_ORIGIN);
    expect(onConnected).not.toHaveBeenCalled();
    expect(onFailed).toHaveBeenCalledTimes(1);
  });

  it("reports failure when the handshake is for a different provider", () => {
    const { onConnected, onFailed, result } = setup();
    act(() => {
      result.current.start();
    });
    postMessage({ ...CONNECTED, provider: "gitlab" }, CALLBACK_ORIGIN);
    expect(onConnected).not.toHaveBeenCalled();
    expect(onFailed).toHaveBeenCalledTimes(1);
  });

  it("survives unrelated messages without consuming the handshake", () => {
    // `{ once: true }` used to tear the listener down on the first message of
    // any kind, so a stray postMessage silently killed the real callback.
    const { onConnected, result } = setup();
    act(() => {
      result.current.start();
    });
    postMessage({ type: "webpackHotUpdate" }, CALLBACK_ORIGIN);
    postMessage({ hello: "world" }, EVIL_ORIGIN);
    postMessage(CONNECTED, CALLBACK_ORIGIN);
    expect(onConnected).toHaveBeenCalledTimes(1);
  });

  it("stops listening after a matched handshake", () => {
    const { onConnected, result } = setup();
    act(() => {
      result.current.start();
    });
    postMessage(CONNECTED, CALLBACK_ORIGIN);
    postMessage(CONNECTED, CALLBACK_ORIGIN);
    expect(onConnected).toHaveBeenCalledTimes(1);
  });

  it("closes the popup and drops the listener when closed mid-flow", () => {
    const { onConnected, result } = setup();
    act(() => {
      result.current.start();
    });
    act(() => {
      result.current.close();
    });
    expect(popup.close).toHaveBeenCalled();
    postMessage(CONNECTED, CALLBACK_ORIGIN);
    expect(onConnected).not.toHaveBeenCalled();
  });

  it("does not dispatch after unmount", () => {
    const { onConnected, result, unmount } = setup();
    act(() => {
      result.current.start();
    });
    unmount();
    postMessage(CONNECTED, CALLBACK_ORIGIN);
    expect(onConnected).not.toHaveBeenCalled();
  });

  it("opens the popup before navigating it, so the click stays user-activated", () => {
    const { result } = setup();
    act(() => {
      result.current.start();
    });
    // window.open already ran synchronously — the browser saw user activation.
    expect(window.open).toHaveBeenCalledWith("", "oauth-login", "width=600,height=700");

    act(() => {
      result.current.navigate("https://provider.example/authorize?state=abc");
    });
    expect(popup.location.href).toBe("https://provider.example/authorize?state=abc");
  });

  it("arms no listener when the popup is blocked", () => {
    jest.spyOn(window, "open").mockReturnValue(null);
    const { onConnected, result } = setup();
    let handle: Window | null = null;
    act(() => {
      handle = result.current.start();
    });
    expect(handle).toBeNull();
    // Nothing to answer, so a later message must not reach the handlers.
    postMessage(CONNECTED, CALLBACK_ORIGIN, null);
    expect(onConnected).not.toHaveBeenCalled();
  });

  it("resolves the callback origin lazily, not at module load", () => {
    // Regression: the origin was resolved at module scope, where an empty
    // API_BASE_URL made `new URL("")` throw and took the /integrations static
    // export down with it. `npm run build` is the real guard — it is what
    // catches this, since jest always has a public env set. Here we only pin
    // that start() still arms and opens with a real origin configured.
    const { result } = setup();
    act(() => {
      expect(result.current.start()).not.toBeNull();
    });
    expect(popup).toBeDefined();
  });
});