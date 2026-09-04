"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, Loader2, MessageSquareText, PhoneOff, SendHorizonal } from "lucide-react";
import { WS_BASE_URL } from "@/lib/api-client";
import { cn } from "@/lib/utils";

type ChatPhase = "connecting" | "live" | "ended" | "error";

interface ChatTurn {
  id: number;
  role: "agent" | "user" | "system";
  text: string;
  ts: string;
}

/**
 * Text chat over the voice websocket: {"type":"text"} in, transcript frames
 * out. Currently served for realtime (s2s) agents only — pipeline agents
 * don't consume the text queue, so the playground gates this tab by type.
 */
export function ChatTalk({ agentId, agentName }: { agentId: string; agentName: string }) {
  const [phase, setPhase] = useState<ChatPhase>("connecting");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const turnIdRef = useRef(0);
  const endedRef = useRef(false);
  const liveRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const pushTurn = useCallback((role: ChatTurn["role"], text: string) => {
    const id = ++turnIdRef.current;
    const ts = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setTurns((prev) => [...prev.slice(-99), { id, role, text, ts }]);
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
    if (!agentId) return;
    endedRef.current = false;
    liveRef.current = false;

    const ws = new WebSocket(`${WS_BASE_URL}/chat/v1/${agentId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      liveRef.current = true;
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

    return () => {
      endedRef.current = true;
      liveRef.current = false;
      teardown();
    };
  }, [agentId, agentName, pushTurn, teardown]);

  useEffect(() => {
    // scrollIntoView is absent in some environments (jsdom) — chat works fine without it.
    bottomRef.current?.scrollIntoView?.({ behavior: "smooth", block: "end" });
  }, [turns]);

  const send = useCallback(() => {
    const text = draft.trim();
    const ws = wsRef.current;
    if (!text || !ws || ws.readyState !== WebSocket.OPEN) return;
    try {
      ws.send(JSON.stringify({ type: "text", data: text }));
      pushTurn("user", text);
      setDraft("");
    } catch {
      setError("Send failed — the socket is closing. Reopen the chat to continue.");
    }
  }, [draft, pushTurn]);

  const hangup = useCallback(() => {
    endedRef.current = true;
    liveRef.current = false;
    teardown();
    setPhase("ended");
    pushTurn("system", "You ended the chat.");
  }, [pushTurn, teardown]);

  const live = phase === "live";

  return (
    <div className="flex flex-col bg-muted/40 backdrop-blur-2xl border border-border rounded-[2.5rem] p-6 shadow-[0_8px_40px_rgba(0,0,0,0.05)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.5)] relative overflow-hidden min-h-[540px] max-h-[70vh]">
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-border relative z-10">
        <h3 className="text-sm font-mono uppercase tracking-widest text-foreground flex items-center gap-2">
          <MessageSquareText className="w-4 h-4 text-ember-600 dark:text-ember-400" />
          Chat · {agentName}
        </h3>
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
      </div>

      <div className="flex-1 overflow-y-auto space-y-5 pr-2 custom-scrollbar relative z-10 min-h-[280px]">
        {turns.length === 0 && phase !== "error" && (
          <p className="text-sm text-muted-foreground leading-relaxed">
            {phase === "connecting"
              ? "Opening a text session…"
              : "Say hello below — the agent replies here as text, no microphone or phone call needed."}
          </p>
        )}
        {phase === "error" && error && (
          <p className="text-sm text-red-700 dark:text-red-400 rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
          </p>
        )}
        <AnimatePresence initial={false}>
          {turns.map((turn) =>
            turn.role === "system" ? (
              <p key={turn.id} className="text-[11px] font-mono text-muted-foreground text-center">
                {turn.text}
              </p>
            ) : (
              <motion.div
                key={turn.id}
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={cn("flex flex-col", turn.role === "agent" ? "items-start" : "items-end")}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span
                    className={cn(
                      "text-[10px] uppercase font-mono tracking-wider",
                      turn.role === "agent"
                        ? "text-ember-700 dark:text-ember-300"
                        : "text-emerald-700 dark:text-emerald-400"
                    )}
                  >
                    {turn.role === "agent" ? "Agent" : "You"}
                  </span>
                  <span className="text-[9px] font-mono text-muted-foreground">{turn.ts}</span>
                </div>
                <div
                  className={cn(
                    "px-5 py-3.5 max-w-[90%] text-sm leading-relaxed break-words shadow-sm",
                    turn.role === "agent"
                      ? "bg-card/80 border border-border text-foreground rounded-2xl rounded-tl-sm"
                      : "bg-primary border border-border text-primary-foreground rounded-2xl rounded-tr-sm"
                  )}
                >
                  {turn.text}
                </div>
              </motion.div>
            )
          )}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      <form
        className="relative z-10 mt-4 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={live ? "Type a message…" : "Connecting…"}
          disabled={!live}
          aria-label="Chat message"
          className="flex-1 h-12 px-4 bg-card border border-border rounded-2xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ember-400/50 disabled:opacity-50 transition-all"
        />
        <button
          type="submit"
          disabled={!live || !draft.trim()}
          aria-label="Send message"
          className="h-12 w-12 shrink-0 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 disabled:opacity-50 transition-all shadow-lg shadow-primary/20"
        >
          <SendHorizonal className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
