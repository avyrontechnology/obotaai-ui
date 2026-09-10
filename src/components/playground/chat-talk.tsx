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

type ChatPhase = "connecting" | "live" | "ended" | "error";

type ChatTurn = SessionTurn;

/**
 * Text chat over the voice websocket: {"type":"text"} in, transcript frames
 * out. Currently served for realtime (s2s) agents only — pipeline agents
 * don't consume the text queue, so the playground gates this tab by type.
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

  const wsRef = useRef<WebSocket | null>(null);
  const turnIdRef = useRef(0);
  const endedRef = useRef(false);
  const liveRef = useRef(false);
  const lastSendAtRef = useRef<number | null>(null);

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
      wsRef.current?.close(1000, "ui chat closed");
    } catch {
      /* already closed */
    }
    wsRef.current = null;
  }, []);

  // Fresh mount per agent (parent passes key): initial useState values ARE
  // the reset — no setState-in-effect. Refs are safe to write here.
  useEffect(() => {
    if (!agentId || !canChat) return;
    endedRef.current = false;
    liveRef.current = false;

    let cancelled = false;

    const attach = (ws: WebSocket) => {
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

      ws.onclose = () => {
        if (endedRef.current) return;
        endedRef.current = true;
        liveRef.current = false;
        setPhase("ended");
        pushTurn("system", "Chat ended.");
      };
    };

    // Prefer a single-use ticket (works cross-origin); fall back to cookies.
    // leg=browser keeps telephony-configured agents on default handlers here too.
    fetchWsTicket()
      .then((ticket) => {
        if (!cancelled) attach(new WebSocket(buildTalkSocketUrl(WS_BASE_URL, agentId, ticket)));
      })
      .catch(() => {
        if (!cancelled) attach(new WebSocket(buildTalkSocketUrl(WS_BASE_URL, agentId)));
      });

    return () => {
      cancelled = true;
      endedRef.current = true;
      liveRef.current = false;
      teardown();
    };
  }, [agentId, agentName, canChat, pushTurn, teardown]);

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
    teardown();
    setPhase("ended");
    pushTurn("system", "You ended the chat.");
  }, [pushTurn, teardown]);

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
  const badge = live ? "in_progress" : phase === "connecting" ? "ringing" : phase === "error" ? "failed" : "completed";

  // Phase-2 seam: turns carry explicit ids and role labels with no session
  // object — the SSE/message-core migration lifts this list verbatim.
  return (
    <div className="grid lg:grid-cols-[1.15fr_1fr] gap-6 flex-1 min-h-0">
      {/* Left: chat thread */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="flex flex-col bg-card border border-border rounded-[2rem] p-6 shadow-[0_20px_50px_-24px_rgba(17,24,39,0.25)] relative overflow-hidden min-h-[540px] lg:min-h-0 max-h-[70vh] lg:max-h-none min-w-0"
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

        {phase === "error" && error && (
          <p role="alert" className="relative z-10 mb-4 text-sm text-red-700 dark:text-red-400 rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
          </p>
        )}
        <TranscriptList
          turns={turns}
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
            disabled={!live || !canChat}
            aria-label="Chat message"
            className="flex-1 h-12 px-4 bg-card border border-border rounded-2xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ember-400/50 disabled:opacity-50 transition-all"
          />
          <button
            type="submit"
            disabled={!live || !draft.trim() || !canChat}
            aria-label="Send message"
            className="h-12 w-12 shrink-0 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 disabled:opacity-50 transition-all shadow-lg shadow-primary/20"
          >
            <SendHorizonal className="w-4 h-4" />
          </button>
        </form>
      </motion.div>

      {/* Right: tools + debug panel (the thread itself is the transcript) */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.05 }}
        className="flex flex-col bg-card border border-border rounded-[2rem] p-6 shadow-[0_20px_50px_-24px_rgba(17,24,39,0.25)] relative overflow-hidden min-h-[420px] lg:min-h-0 min-w-0"
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
