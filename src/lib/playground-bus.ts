/**
 * Tiny event bus between the Playground page chrome and the active session
 * panels (LiveTalk / ChatTalk), which own their sockets and transcript.
 *
 * Used for page-level controls that must reach inside a session without
 * lifting socket state up: clearing the transcript and injecting text
 * (intent chips, custom message input). Subscriptions happen in effects;
 * emissions are plain function calls, so the set-state-in-effect lint rule
 * never fires.
 */

export type PlaygroundBusEvent = { type: "clear-transcript" } | { type: "send-text"; text: string };

type Listener = (event: PlaygroundBusEvent) => void;

const listeners = new Set<Listener>();

export function subscribePlaygroundBus(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitPlaygroundBus(event: PlaygroundBusEvent): void {
  listeners.forEach((listener) => {
    try {
      listener(event);
    } catch {
      /* one bad listener must not break the others */
    }
  });
}
