"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { AlertCircle, Loader2, PhoneOff, RadioReceiver, SendHorizonal } from "lucide-react";
import { WS_BASE_URL, buildTalkSocketUrl } from "@/lib/api-client";
import { fetchWsTicket } from "@/services/auth";
import { subscribePlaygroundBus } from "@/lib/playground-bus";
import { StatusBadge } from "@/components/calls/status-badge";
import {
  JitterPanel,
  SessionTabs,
  TranscriptList,
  ToolsPanel,
  type SessionStats,
  type SessionTab,
  type SessionTurn,
} from "./session-ui";

type ChatPhase = "connecting" | "live" | "reconnecting" | "ended" | "error";

type ChatTurn = SessionTurn;

/** Engine stream sentinels: control frames, never user-visible transcript. */
const STREAM_SENTINELS = new Set(["<beginning_of_stream>", "<end_of_stream>"]);

/**
 * Text chat over the voice websocket (WS_BASE_URL/chat/v1/:id, JSON frames).
 * Served for every agent type: realtime answers natively, pipeline agents via
 * the browser-leg text queue. Transcript + ids outlive the socket (SSE seam).
 */
export function ChatTalk({
  agentId,
  agentName,
  canChat = true,
}: {
  agentId: string;
  agentName: string;
  /** Role gate: viewers see the panel but cannot send. */
  canChat?: boolean;
}) {
  const [phase, setPhase] = useState<ChatPhase>("connecting");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<SessionTab>("tools");
  const [lastRtt, setLastRtt] = useState<number | null>(null);
  const [tick, setTick] = useState(0);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const turnIdRef = useRef(0);
  const endedRef = useRef(false);
  const liveRef = useRef(false);
  const lastSendAtRef = useRef<number | null>(null);
  const attemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Error summary focus: keyboard + screen-reader users land on the failure.
  // Focusing is a DOM effect, not React state — the set-state-in-effect rule stays green.
  const errorRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (phase === "error" && error) errorRef.current?.focus();
  }, [phase, error]);

  const pushTurn = useCallback((role: ChatTurn["role"], text: string) => {
    const id = ++turnIdRef.current;
    const ts = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setTurns((prev) => [...prev.slice(-99), { id, role, text, ts }]);
    if (role === "agent") {
      const sentAt = lastSendAtRef.current;
      lastSendAtRef.current = null;
      if (sentAt !== null) setLastRtt(Math.round(performance.now() - sentAt));
    }
  }, []);

  const teardown = useCallback(() => {
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    reconnectTimerRef.current = null;
    try {
      wsRef.current?.close(1000, "ui chat closed");
    } catch {
      /* already closed */
    }
    wsRef.current = null;
  }, []);

  /** Open the browser-leg chat socket (WS_BASE_URL from env, never hardcoded).
   *  leg=browser keeps telephony-configured agents on default handlers too.
   *  Transcript + ids are preserved — turns never assume socket lifetime
   *  (Phase-2 SSE seam). Self-retries via connectRef to avoid a hook cycle. */
  const connectRef = useRef<(isRetry: boolean, cancelledRef: { current: boolean }) => Promise<void>>(async () => undefined);
  const connect = useCallback(
    async (isRetry: boolean, cancelledRef: { current: boolean }) => {
      if (cancelledRef.current || endedRef.current) return;
      // No sync setState here: the initial mount already renders
      // "connecting", and manual retries set the phase from the click
      // handler. All setStates below run after an await or in socket
      // callbacks, so the set-state-in-effect rule stays green.

      const doAttach = (ws: WebSocket) => {
        wsRef.current = ws;

        ws.onopen = () => {
          if (cancelledRef.current || endedRef.current) return;
          liveRef.current = true;
          attemptRef.current = 0;
          setReconnectAttempt(0);
          if (!isRetry) {
            setLastRtt(null);
            setTick(0);
          }
          try {
            ws.send(JSON.stringify({ type: "init", meta_data: { agent_id: agentId, source: "ui-chat" } }));
          } catch {
            /* init is best-effort */
          }
          pushTurn("system", isRetry ? "Reconnected — continue chatting." : `Chatting with ${agentName} as text.`);
          setPhase("live");
        };

        ws.onmessage = (event: MessageEvent) => {
          let message: { type?: string; data?: unknown; role?: string; name?: string };
          try {
            message = JSON.parse(event.data as string);
          } catch {
            return;
          }
          if (message.type === "ack") {
            // No-op: the chatting line is pushed on open (no ack on this leg).
          } else if (message.type === "text" && typeof message.data === "string") {
            // Engine stream sentinels are control frames, never transcript.
            if (STREAM_SENTINELS.has(message.data)) return;
            pushTurn(message.role === "user" ? "user" : "agent", message.data);
          } else if (message.type === "mark" && typeof message.name === "string") {
            // Echo marks so the engine can track playout and latency.
            try {
              ws.send(JSON.stringify({ type: "mark", name: message.name }));
            } catch {
              /* socket closing */
            }
          } else if (message.type === "clear") {
            pushTurn("system", "Agent interrupted itself.");
          }
          // Audio frames carry no text — ignored quietly on the chat leg.
        };

        ws.onerror = () => {
          if (!endedRef.current && !liveRef.current && !isRetry && attemptRef.current === 0) {
            endedRef.current = true;
            setPhase("error");
            setError("Couldn't reach the voice backend. Is it running at the configured API URL?");
          }
        };

        ws.onclose = () => {
          if (cancelledRef.current || endedRef.current) return;
          liveRef.current = false;
          // Unexpected drop mid-thread: back off and re-open on the same
          // transcript. Pre-live failures already surfaced via onerror.
          if (attemptRef.current < 3) {
            const delay = Math.min(4000, 800 * 2 ** attemptRef.current);
            attemptRef.current += 1;
            setReconnectAttempt(attemptRef.current);
            setPhase("reconnecting");
            pushTurn("system", `Connection lost — retrying (${attemptRef.current}/3)…`);
            if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = setTimeout(() => {
              reconnectTimerRef.current = null;
              if (cancelledRef.current || endedRef.current) return;
              void connectRef.current(true, cancelledRef);
            }, delay);
            return;
          }
          endedRef.current = true;
          setPhase("ended");
          pushTurn("system", "Chat ended.");
        };
      };

      // Prefer a single-use ticket (works cross-origin); fall back to cookies.
      try {
        const ticket = await fetchWsTicket();
        if (cancelledRef.current || endedRef.current) return;
        doAttach(new WebSocket(buildTalkSocketUrl(WS_BASE_URL, agentId, ticket)));
      } catch {
        if (cancelledRef.current || endedRef.current) return;
        doAttach(new WebSocket(buildTalkSocketUrl(WS_BASE_URL, agentId)));
      }
    },
    [agentId, agentName, pushTurn]
  );

  // Keep the retry pointer fresh. Ref writes in effects are safe — no
  // setState, so both lint rules stay green.
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  // Fresh mount per agent (parent passes key): initial useState values ARE
  // the reset — no setState-in-effect. The socket opens asynchronously (the
  // ticket fetch yields first), so no setState runs in the effect body.
  useEffect(() => {
    if (!agentId || !canChat) return;
    endedRef.current = false;
    liveRef.current = false;
    attemptRef.current = 0;

    const cancelledRef = { current: false };
    void connect(false, cancelledRef);

    return () => {
      cancelledRef.current = true;
      endedRef.current = true;
      liveRef.current = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
      teardown();
    };
  }, [agentId, agentName, canChat, connect, teardown]);

  const sendText = useCallback(
    (raw: string) => {
      const text = raw.trim();
      const ws = wsRef.current;
      if (!text || !ws || ws.readyState !== WebSocket.OPEN || !canChat) return false;
      try {
        ws.send(JSON.stringify({ type: "text", data: text }));
        lastSendAtRef.current = performance.now();
        pushTurn("user", text);
        return true;
      } catch {
        setError("Send failed — the socket is closing. Reopen the chat to continue.");
        return false;
      }
    },
    [canChat, pushTurn]
  );

  const send = useCallback(() => {
    if (sendText(draft)) setDraft("");
  }, [draft, sendText]);

  // Shared bus: the tab bar's Clear wipes the thread; page-level injections
  // arrive as send-text (queued by the sender until live).
  useEffect(() => {
    return subscribePlaygroundBus((event) => {
      if (event.type === "clear-transcript") {
        setTurns([]);
      } else if (event.type === "send-text") {
        sendText(event.text);
      }
    });
  }, [sendText]);

  const hangup = useCallback(() => {
    endedRef.current = true;
    liveRef.current = false;
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    reconnectTimerRef.current = null;
    attemptRef.current = 0;
    setReconnectAttempt(0);
    teardown();
    setPhase("ended");
    pushTurn("system", "You ended the chat.");
  }, [pushTurn, teardown]);

  /** Manual retry after ended/error: re-opens the socket on the same thread. */
  const retry = useCallback(() => {
    if (!agentId || !canChat) return;
    endedRef.current = false;
    liveRef.current = false;
    attemptRef.current = 0;
    setReconnectAttempt(0);
    setError(null);
    setPhase("connecting");
    pushTurn("system", "Reconnecting…");
    void connect(false, { current: false });
  }, [agentId, canChat, connect, pushTurn]);

  // Elapsed clock ticks only while live — no setState in render/effect loops.
  useEffect(() => {
    if (phase !== "live") return;
    const timer = setInterval(() => setTick((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  const stats: SessionStats = useMemo(
    () => ({
      e2eMs: lastRtt,
      jitterMs: null,
      turns: turns.filter((turn) => turn.role !== "system").length,
      elapsedSec: tick,
      deviceRate: null,
      playedChunks: 0,
    }),
    [lastRtt, turns, tick]
  );

  const live = phase === "live";
  const badge =
    live ? "in_progress" : phase === "connecting" || phase === "reconnecting" ? "ringing" : phase === "error" ? "failed" : "completed";

  // Phase-2 seam: turns carry explicit ids and role labels with no session
  // object — the SSE/message-core migration lifts this list verbatim.
  return (
    <div className="grid xl:grid-cols-[1.15fr_1fr] gap-4 sm:gap-6 flex-1 min-h-0">
      {/* Left: chat thread — p-4 at 375px so the input row fits 295px */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="flex flex-col bg-card border border-border rounded-3xl p-4 sm:p-6 relative overflow-hidden min-h-[420px] lg:min-h-0 max-h-[70vh] lg:max-h-none min-w-0"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 mb-4 pb-4 border-b border-border relative z-10 shrink-0">
          <p className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground min-w-0">
            <RadioReceiver className="w-4 h-4 text-ember-700 dark:text-ember-300 shrink-0" aria-hidden="true" />
            <span className="truncate">Chat session · {agentName}</span>
          </p>
          <span className="flex items-center gap-3 shrink-0">
            <StatusBadge status={badge} />
            {live ? (
              <button
                onClick={hangup}
                aria-label="End chat"
                className="h-9 px-4 rounded-xl bg-red-600/10 text-red-700 dark:text-red-400 border border-red-500/20 text-xs font-semibold hover:bg-red-600/20 transition-all duration-200 motion-reduce:transition-none cursor-pointer flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <PhoneOff className="w-3.5 h-3.5" aria-hidden="true" /> End
              </button>
            ) : phase === "reconnecting" ? (
              <span className="flex items-center gap-2">
                <span className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  Retrying {reconnectAttempt}/3
                </span>
                <button
                  onClick={hangup}
                  aria-label="Cancel reconnect and end chat"
                  className="h-9 px-4 rounded-xl bg-red-600/10 text-red-700 dark:text-red-400 border border-red-500/20 text-xs font-semibold hover:bg-red-600/20 transition-all duration-200 motion-reduce:transition-none cursor-pointer flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  Cancel
                </button>
              </span>
            ) : phase === "ended" || phase === "error" ? (
              <button
                onClick={retry}
                disabled={!canChat}
                aria-label="Reconnect chat"
                className="h-9 px-4 rounded-xl bg-card border border-border text-foreground text-xs font-semibold hover:bg-accent hover:border-primary/40 transition-all duration-200 motion-reduce:transition-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Reconnect
              </button>
            ) : (
              <span className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                Connecting
              </span>
            )}
          </span>
        </div>

        {phase === "error" && error && (
          <div
            ref={errorRef}
            role="alert"
            tabIndex={-1}
            aria-labelledby="chat-talk-error-title"
            className="relative z-10 mb-4 rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-3 flex items-start gap-2 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-700 dark:text-red-300" aria-hidden="true" />
            <span className="min-w-0">
              <span id="chat-talk-error-title" className="block text-sm font-semibold text-red-800 dark:text-red-200">
                Couldn&apos;t reach the chat backend
              </span>
              <span className="block text-sm text-red-800 dark:text-red-200">{error}</span>
              <a
                href="/calls"
                className="mt-1.5 inline-block text-[13px] font-medium underline underline-offset-2 text-red-800 dark:text-red-200 hover:opacity-80 cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-1 focus-visible:ring-offset-background transition-all duration-200 motion-reduce:transition-none"
              >
                View call history
              </a>
            </span>
          </div>
        )}
        {phase === "reconnecting" && (
          <p className="relative z-10 mb-4 text-xs text-muted-foreground rounded-2xl border border-dashed border-border px-4 py-2" aria-live="polite">
            Connection lost — retrying ({reconnectAttempt}/3). Your thread is preserved.
          </p>
        )}
        <TranscriptList
          turns={turns}
          emptyHint={
            phase === "connecting" || phase === "reconnecting"
              ? "Opening a text session…"
              : "Say hello below — the agent replies here as text, no microphone or phone call needed."
          }
          minHeight="min-h-[280px] lg:min-h-0"
        />

        {!canChat && (
          <p className="relative z-10 mt-4 text-xs text-muted-foreground rounded-2xl border border-dashed border-border px-4 py-3">
            Text chat needs a member role or higher — you are signed in as read-only.
          </p>
        )}
        <form
          className="relative z-10 mt-4 flex gap-2 shrink-0"
          onSubmit={(event) => {
            event.preventDefault();
            send();
          }}
        >
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={live ? "Type a message…" : "Connecting…"}
            disabled={!live || !canChat}
            aria-label="Chat message"
            className="flex-1 min-w-0 h-12 px-4 bg-card border border-border rounded-2xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 motion-reduce:transition-none"
          />
          <button
            type="submit"
            disabled={!live || !draft.trim() || !canChat}
            aria-label="Send message"
            className="h-12 w-12 shrink-0 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all duration-200 motion-reduce:transition-none shadow-lg shadow-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <SendHorizonal className="w-4 h-4" aria-hidden="true" />
          </button>
        </form>
      </motion.div>

      {/* Right: tools + debug panel (the thread itself is the transcript) */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.05 }}
        className="flex flex-col bg-card border border-border rounded-3xl p-4 sm:p-6 relative overflow-hidden min-h-[420px] lg:min-h-0 min-w-0"
      >
        <SessionTabs
          tab={tab}
          onChange={setTab}
          onClear={() => setTurns([])}
          tabs={["tools", "jitter"]}
        />
        <div className="pt-4 flex-1 flex flex-col min-h-0 min-w-0">
          {tab === "jitter" ? <JitterPanel stats={stats} hasAudio={false} /> : <ToolsPanel agentId={agentId} />}
        </div>
      </motion.div>
    </div>
  );
}
