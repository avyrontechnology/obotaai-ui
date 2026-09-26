"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { AlertCircle, Loader2, PhoneOff, RadioReceiver, SendHorizonal } from "lucide-react";
import { ApiError, WS_BASE_URL, buildTalkSocketUrl, wsCloseReason } from "@/lib/api-client";
import { fetchWsTicket } from "@/services/auth";
import {
  probeChatEndpoint,
  useChatHistory,
  useSendChatTurn,
} from "@/services/platform/chat";
import type { ChatHistory } from "@/lib/schemas/chat";
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

type ChatPhase = "connecting" | "live" | "ended" | "error";

/** Transports: HTTP chat endpoint (spec 0039) with WS text-frame fallback
 *  for backends predating the chat module (probed, never version-gated). */
type ChatTransport = "http" | "ws";

type ChatTurn = SessionTurn;

function formatClock(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** Persisted history renders as the backlog above live turns (spec 0039).
 *  Negative ids keep backlog keys disjoint from live turn ids. */
function backlogTurns(history: ChatHistory | undefined): ChatTurn[] {
  if (!history) return [];
  const turns: ChatTurn[] = [];
  let id = 0;
  for (const session of history) {
    for (const message of session.messages) {
      turns.push({
        id: --id,
        role: message.role === "assistant" ? "agent" : "user",
        text: message.content,
        ts: formatClock(message.ts),
      });
    }
  }
  return turns.slice(-100);
}

/**
 * Text chat over the HTTP chat endpoint (`POST /api/v1/chat/:id`, SSE
 * replies, persisted history), with the legacy voice-websocket text frames
 * as fallback for backends without the chat module.
 *
 * Gating is channel-owned (specs 0038 + 0039): the tab serves agents whose
 * `channels` include `chat`. Voice-only agents render the notice, never the
 * composer. Chat-channel agents (answered 4404 on the voice socket) work
 * here for the first time.
 */
export function ChatTalk({
  agentId,
  agentName,
  canChat = true,
  chatSupported = false,
}: {
  agentId: string;
  agentName: string;
  /** Role gate: viewers see the panel but cannot send. */
  canChat?: boolean;
  /** Channel gate: true when the agent's channels include `chat`. */
  chatSupported?: boolean;
}) {
  const [phase, setPhase] = useState<ChatPhase>("connecting");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [pendingText, setPendingText] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<SessionTab>("tools");
  const [lastRtt, setLastRtt] = useState<number | null>(null);
  const [tick, setTick] = useState(0);
  const [transport, setTransport] = useState<ChatTransport | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const turnIdRef = useRef(0);
  const endedRef = useRef(false);
  const liveRef = useRef(false);
  const lastSendAtRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sendMutation = useSendChatTurn();
  // History is read-only backlog: useful even for viewers, independent of
  // the send transport.
  const historyQuery = useChatHistory(agentId, chatSupported && !!agentId);

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
    try {
      abortRef.current?.abort();
    } catch {
      /* no in-flight turn */
    }
    abortRef.current = null;
    try {
      wsRef.current?.close(1000, "ui chat closed");
    } catch {
      /* already closed */
    }
    wsRef.current = null;
  }, []);

  // Fresh mount per agent (parent passes key): initial useState values ARE
  // the reset — no setState-in-effect. Refs are safe to write here.
  useEffect(() => {
    if (!agentId || !chatSupported) return;
    endedRef.current = false;
    liveRef.current = false;

    let cancelled = false;

    const attachWs = (ws: WebSocket) => {
      wsRef.current = ws;

      ws.onopen = () => {
        if (cancelled) return;
        liveRef.current = true;
        setLastRtt(null);
        setTick(0);
        try {
          ws.send(JSON.stringify({ type: "init", meta_data: { agent_id: agentId, source: "ui-chat" } }));
        } catch {
          /* init is best-effort */
        }
        pushTurn("system", `Chatting with ${agentName} as text.`);
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
          pushTurn(message.role === "user" ? "user" : "agent", message.data);
        } else if (message.type === "mark" && typeof message.name === "string") {
          try {
            ws.send(JSON.stringify({ type: "mark", name: message.name }));
          } catch {
            /* socket closing */
          }
        } else if (message.type === "clear") {
          pushTurn("system", "Agent interrupted itself.");
        }
      };

      ws.onerror = () => {
        if (!endedRef.current && !liveRef.current) {
          endedRef.current = true;
          setPhase("error");
          setError("Couldn't reach the voice backend. Is it running at the configured API URL?");
        }
      };

      ws.onclose = (event?: CloseEvent) => {
        if (endedRef.current) return;
        endedRef.current = true;
        liveRef.current = false;
        // Channel-owned close codes (spec 0021): surface denied/dark/unknown
        // with dedicated copy instead of a silent "ended".
        const gated = typeof event?.code === "number" ? wsCloseReason(event.code) : null;
        if (gated) {
          setPhase("error");
          setError(gated);
          pushTurn("system", "Chat ended.");
        } else {
          setPhase("ended");
          pushTurn("system", "Chat ended.");
        }
      };
    };

    const connectWs = () => {
      if (!canChat) return;
      // Prefer a single-use ticket (works cross-origin); fall back to cookies.
      // leg=browser keeps telephony-configured agents on default handlers here too.
      fetchWsTicket()
        .then((ticket) => {
          if (!cancelled) attachWs(new WebSocket(buildTalkSocketUrl(WS_BASE_URL, agentId, ticket)));
        })
        .catch(() => {
          if (!cancelled) attachWs(new WebSocket(buildTalkSocketUrl(WS_BASE_URL, agentId)));
        });
    };

    // Feature-detect the HTTP endpoint (never version-gate): a blank probe
    // 400s on live backends without writing a session; 404 means legacy.
    void probeChatEndpoint(agentId).then((httpLive) => {
      if (cancelled) return;
      if (httpLive) {
        setTransport("http");
        liveRef.current = true;
        setLastRtt(null);
        setTick(0);
        pushTurn("system", `Chatting with ${agentName} as text.`);
        setPhase("live");
      } else {
        setTransport("ws");
        connectWs();
      }
    });

    return () => {
      cancelled = true;
      endedRef.current = true;
      liveRef.current = false;
      teardown();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId, agentName, canChat, chatSupported]);

  const sendWs = useCallback(
    (text: string) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return false;
      try {
        // DEPRECATED (spec 0039): WS {"type":"text"} multiplexing stays live
        // for in-call text only. chat-talk.tsx no longer originates it on the
        // HTTP path; future text-in-call work gets its own protocol spec per
        // the spec 0038 deferral.
        ws.send(JSON.stringify({ type: "text", data: text }));
        lastSendAtRef.current = performance.now();
        pushTurn("user", text);
        return true;
      } catch {
        setError("Send failed — the socket is closing. Reopen the chat to continue.");
        return false;
      }
    },
    [pushTurn]
  );

  const sendHttp = useCallback(
    (text: string) => {
      if (sendMutation.isPending) return false;
      setError(null);
      pushTurn("user", text);
      lastSendAtRef.current = performance.now();
      setPendingText("");
      const controller = new AbortController();
      abortRef.current = controller;
      sendMutation.mutate(
        {
          agentId,
          message: text,
          sessionId: sessionId ?? undefined,
          signal: controller.signal,
          onToken: (replySoFar) => setPendingText(replySoFar),
        },
        {
          onSuccess: ({ reply, sessionId: next }) => {
            if (next) setSessionId(next);
            setPendingText(null);
            pushTurn("agent", reply);
          },
          onError: (e) => {
            setPendingText(null);
            // No oracle in the UI either: unknown/foreign agents read the
            // same "unavailable" copy; non-chat agents get the voice-only
            // notice; anything else is a generic send failure.
            if (e instanceof ApiError && e.status === 404) {
              setError("This agent is unavailable — it may have been deleted or moved.");
            } else if (e instanceof ApiError && e.status === 400) {
              setError("This agent doesn't serve the chat channel — use voice or pick a chat agent.");
            } else if (e instanceof Error && e.name === "AbortError") {
              pushTurn("system", "Send cancelled.");
            } else {
              setError("Send failed — the chat backend didn't answer. Try again.");
            }
          },
        }
      );
      return true;
    },
    [agentId, pushTurn, sendMutation, sessionId]
  );

  const sendText = useCallback(
    (raw: string) => {
      const text = raw.trim();
      if (!text || !canChat) return false;
      if (transport === "http") return sendHttp(text);
      if (transport === "ws") return sendWs(text);
      return false;
    },
    [canChat, transport, sendHttp, sendWs]
  );

  const send = useCallback(() => {
    if (sendText(draft)) setDraft("");
  }, [draft, sendText]);

  // Shared bus: the tab bar's Clear wipes the thread (and starts the next
  // turn on a fresh server session); page-level injections arrive as
  // send-text (queued by the sender until live).
  useEffect(() => {
    return subscribePlaygroundBus((event) => {
      if (event.type === "clear-transcript") {
        setTurns([]);
        setPendingText(null);
        setSessionId(null);
      } else if (event.type === "send-text") {
        sendText(event.text);
      }
    });
  }, [sendText]);

  const hangup = useCallback(() => {
    endedRef.current = true;
    liveRef.current = false;
    teardown();
    setError(null);
    setPhase("ended");
    pushTurn("system", "You ended the chat.");
  }, [pushTurn, teardown]);

  // Elapsed clock ticks only while live — no setState in render/effect loops.
  useEffect(() => {
    if (phase !== "live") return;
    const timer = setInterval(() => setTick((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  const backlog = useMemo(() => backlogTurns(historyQuery.data), [historyQuery.data]);
  const visibleTurns = useMemo(() => {
    const live = [...backlog, ...turns].slice(-150);
    if (pendingText === null) return live;
    return [
      ...live,
      {
        id: -1,
        role: "agent" as const,
        text: pendingText === "" ? "…" : pendingText,
        ts: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ];
  }, [backlog, turns, pendingText]);

  const stats: SessionStats = useMemo(
    () => ({
      e2eMs: lastRtt,
      jitterMs: null,
      turns: visibleTurns.filter((turn) => turn.role !== "system").length,
      elapsedSec: tick,
      deviceRate: null,
      playedChunks: 0,
    }),
    [lastRtt, visibleTurns, tick]
  );

  const live = phase === "live";
  const badge = live ? "in_progress" : phase === "connecting" ? "ringing" : phase === "error" ? "failed" : "completed";
  const streaming = sendMutation.isPending;

  // Channel gate (specs 0038 + 0039): without a chat channel there is no
  // composer and no socket — the notice, never a dead form.
  if (!chatSupported) {
    return (
      <div className="grid xl:grid-cols-[1.15fr_1fr] gap-6 flex-1 min-h-0">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="flex flex-col bg-card border border-border rounded-3xl p-6 relative overflow-hidden min-h-[420px] lg:min-h-0 max-h-[70vh] lg:max-h-none min-w-0"
        >
          <div className="flex items-center justify-between gap-3 mb-4 pb-4 border-b border-border relative z-10 shrink-0">
            <p className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground min-w-0">
              <RadioReceiver className="w-4 h-4 text-ember-600 dark:text-ember-400 shrink-0" />
              <span className="truncate">Chat session · {agentName}</span>
            </p>
          </div>
          <p role="alert" className="relative z-10 text-sm text-muted-foreground rounded-2xl border border-dashed border-border px-4 py-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            This agent doesn&apos;t serve the chat channel — use voice, or pick an agent with chat enabled.
          </p>
        </motion.div>
      </div>
    );
  }

  // Phase-2 seam: turns carry explicit ids and role labels with no session
  // object — the SSE/message-core migration lifts this list verbatim.
  return (
    <div className="grid xl:grid-cols-[1.15fr_1fr] gap-6 flex-1 min-h-0">
      {/* Left: chat thread */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="flex flex-col bg-card border border-border rounded-3xl p-6 relative overflow-hidden min-h-[420px] lg:min-h-0 max-h-[70vh] lg:max-h-none min-w-0"
      >
        <div className="flex items-center justify-between gap-3 mb-4 pb-4 border-b border-border relative z-10 shrink-0">
          <p className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground min-w-0">
            <RadioReceiver className="w-4 h-4 text-ember-600 dark:text-ember-400 shrink-0" />
            <span className="truncate">Chat session · {agentName}</span>
          </p>
          <span className="flex items-center gap-3 shrink-0">
            <StatusBadge status={badge} />
            {live ? (
              <button
                onClick={hangup}
                aria-label="End chat"
                className="h-9 px-4 rounded-xl bg-red-600/10 text-red-700 dark:text-red-400 border border-red-500/20 text-xs font-semibold hover:bg-red-600/20 transition-colors flex items-center gap-2"
              >
                <PhoneOff className="w-3.5 h-3.5" /> End
              </button>
            ) : (
              <span className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                {phase === "connecting" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {phase === "connecting" ? "Connecting" : phase === "error" ? "Failed" : "Ended"}
              </span>
            )}
          </span>
        </div>

        {error && (
          <p role="alert" className="relative z-10 mb-4 text-sm text-red-700 dark:text-red-400 rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
          </p>
        )}
        <TranscriptList
          turns={visibleTurns}
          emptyHint={
            phase === "connecting"
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
            disabled={!live || !canChat || streaming}
            aria-label="Chat message"
            className="flex-1 h-12 px-4 bg-card border border-border rounded-2xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ember-400/50 disabled:opacity-50 transition-all"
          />
          <button
            type="submit"
            disabled={!live || !draft.trim() || !canChat || streaming}
            aria-label="Send message"
            className="h-12 w-12 shrink-0 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 disabled:opacity-50 transition-all shadow-lg shadow-primary/20"
          >
            {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <SendHorizonal className="w-4 h-4" />}
          </button>
        </form>
      </motion.div>

      {/* Right: tools + debug panel (the thread itself is the transcript) */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.05 }}
        className="flex flex-col bg-card border border-border rounded-3xl p-6 relative overflow-hidden min-h-[420px] lg:min-h-0 min-w-0"
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
