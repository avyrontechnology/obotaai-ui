"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  AudioLines,
  Loader2,
  Mic,
  MicOff,
  PhoneOff,
  RadioReceiver,
} from "lucide-react";
import { AudioVisualizer } from "./audio-visualizer";
import { StatusBadge } from "@/components/calls/status-badge";
import { WS_BASE_URL } from "@/lib/api-client";
import {
  LIVE_TALK_CHUNK_SAMPLES,
  LIVE_TALK_INPUT_RATE,
  base64ToPcm16,
  floatTo16BitPCM,
  pcmToBase64,
  rmsVolume,
} from "@/lib/audio";
import { cn } from "@/lib/utils";

type Phase = "idle" | "mic" | "connecting" | "live" | "ended" | "error";

interface TalkTurn {
  id: number;
  role: "agent" | "user" | "system";
  text: string;
  ts: string;
}

const CAPTURE_WORKLET = `
class PcmCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = [];
    this._inputRate = sampleRate;
  }
  process(inputs) {
    const channel = inputs[0]?.[0];
    if (!channel) return true;
    const factor = Math.max(1, Math.round(this._inputRate / ${LIVE_TALK_INPUT_RATE}));
    for (let i = 0; i < channel.length; i += factor) {
      let sum = 0;
      let count = 0;
      for (let j = 0; j < factor && i + j < channel.length; j++) {
        sum += channel[i + j];
        count++;
      }
      this._buffer.push(sum / count);
      if (this._buffer.length >= ${LIVE_TALK_CHUNK_SAMPLES}) {
        this.port.postMessage(new Float32Array(this._buffer.splice(0, ${LIVE_TALK_CHUNK_SAMPLES})));
      }
    }
    return true;
  }
}
registerProcessor("pcm-capture", PcmCapture);
`;

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function LiveTalk({ agentId, agentName }: { agentId: string; agentName: string }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0);
  const [turns, setTurns] = useState<TalkTurn[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const workletUrlRef = useRef<string | null>(null);
  const mutedRef = useRef(false);
  const playheadRef = useRef(0);
  const sourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const turnIdRef = useRef(0);
  const openedAtRef = useRef(0);
  const liveRef = useRef(false);
  const audioHeardRef = useRef(false);
  const liveSinceRef = useRef(0);
  const rafRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endedRef = useRef(false);

  const pushTurn = useCallback((role: TalkTurn["role"], text: string) => {
    const id = ++turnIdRef.current;
    const ts = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setTurns((prev) => [...prev.slice(-49), { id, role, text, ts }]);
  }, []);

  const teardown = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    try {
      wsRef.current?.close(1000, "ui hangup");
    } catch {
      /* already closed */
    }
    wsRef.current = null;
    sourcesRef.current.forEach((source) => {
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
    });
    sourcesRef.current = [];
    micStreamRef.current?.getTracks().forEach((track) => track.stop());
    micStreamRef.current = null;
    if (audioCtxRef.current) {
      void audioCtxRef.current.close().catch(() => undefined);
      audioCtxRef.current = null;
    }
    if (workletUrlRef.current) {
      URL.revokeObjectURL(workletUrlRef.current);
      workletUrlRef.current = null;
    }
    setVolume(0);
  }, []);

  // Unmount safety: never leave mic/ws open.
  useEffect(() => () => teardown(), [teardown]);

  const stopPlayback = useCallback(() => {
    const ctx = audioCtxRef.current;
    sourcesRef.current.forEach((source) => {
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
    });
    sourcesRef.current = [];
    if (ctx) playheadRef.current = ctx.currentTime;
  }, []);

  const playPcm24k = useCallback((base64: string) => {
    try {
      const ctx = audioCtxRef.current;
      if (!ctx || ctx.state === "closed") return;
      if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
      const samples = base64ToPcm16(base64);
      if (samples.length === 0) return;
      const buffer = ctx.createBuffer(1, samples.length, 24000);
      const channel = buffer.getChannelData(0);
      for (let i = 0; i < samples.length; i++) channel[i] = samples[i] / 0x8000;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      const startAt = Math.max(playheadRef.current, ctx.currentTime + 0.02);
      source.start(startAt);
      playheadRef.current = startAt + buffer.duration;
      sourcesRef.current.push(source);
      source.onended = () => {
        sourcesRef.current = sourcesRef.current.filter((s) => s !== source);
      };
      audioHeardRef.current = true;
    } catch {
      // A single malformed chunk must never take down the call.
    }
  }, []);

  const handleServerMessage = useCallback(
    (event: MessageEvent) => {
      let message: { type?: string; data?: unknown; name?: string; role?: string };
      try {
        message = JSON.parse(event.data as string);
      } catch {
        return;
      }
      const ws = wsRef.current;
      if (message.type === "ack") {
        // Kept for forward-compat; the connected line is pushed on open
        // because this backend doesn't emit ack on the call leg.
      } else if (message.type === "audio" && typeof message.data === "string") {
        playPcm24k(message.data);
      } else if (message.type === "text" && typeof message.data === "string") {
        pushTurn(message.role === "user" ? "user" : "agent", message.data);
      } else if (message.type === "mark" && typeof message.name === "string") {
        // Echo marks so the engine can track playout, barge-in and latency.
        try {
          ws?.send(JSON.stringify({ type: "mark", name: message.name }));
        } catch {
          /* socket closing */
        }
      } else if (message.type === "clear") {
        // Barge-in: stop everything scheduled so the agent doesn't talk over you.
        stopPlayback();
      }
    },
    [playPcm24k, pushTurn, stopPlayback]
  );

  const start = useCallback(async () => {
    if (!agentId) return;
    endedRef.current = false;
    liveRef.current = false;
    mutedRef.current = false;
    setMuted(false);
    setError(null);
    setTurns([]);
    setElapsed(0);
    turnIdRef.current = 0;
    audioHeardRef.current = false;

    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setPhase("error");
      setError("This browser can't capture microphone audio. Use Chrome or Safari on localhost/HTTPS.");
      return;
    }

    setPhase("mic");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch {
      setPhase("error");
      setError("Microphone blocked. Allow mic access in the browser site settings, then try again.");
      return;
    }
    if (endedRef.current) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    micStreamRef.current = stream;

    const Ctx: typeof AudioContext | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) {
      setPhase("error");
      setError("Web Audio is unavailable in this browser.");
      return;
    }
    const ctx = new Ctx();
    audioCtxRef.current = ctx;
    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch {
        /* play will resume later */
      }
    }

    // Mic meter.
    const micSource = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    micSource.connect(analyser);
    const meter = new Uint8Array(analyser.frequencyBinCount);
    let lastMeter = 0;
    const tickMeter = () => {
      analyser.getByteTimeDomainData(meter);
      const now = performance.now();
      if (now - lastMeter > 120) {
        lastMeter = now;
        setVolume(rmsVolume(meter));
      }
      rafRef.current = requestAnimationFrame(tickMeter);
    };
    rafRef.current = requestAnimationFrame(tickMeter);

    // 16k PCM capture worklet.
    try {
      const url = URL.createObjectURL(new Blob([CAPTURE_WORKLET], { type: "application/javascript" }));
      workletUrlRef.current = url;
      await ctx.audioWorklet.addModule(url);
    } catch {
      setPhase("error");
      setError("Audio capture failed to start in this browser.");
      teardown();
      return;
    }
    const capture = new AudioWorkletNode(ctx, "pcm-capture");
    capture.port.onmessage = (event: MessageEvent<Float32Array>) => {
      if (mutedRef.current) return;
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      // The AudioWorklet already downsampled the audio to LIVE_TALK_INPUT_RATE.
      const pcm = floatTo16BitPCM(event.data);
      try {
        ws.send(JSON.stringify({ type: "audio", data: pcmToBase64(pcm) }));
      } catch {
        /* socket closing */
      }
    };
    // The capture node must reach the destination (through a muted gain)
    // or the graph is optimized away and process() never fires — the agent
    // then hears nothing while every meter still looks alive.
    const sink = ctx.createGain();
    sink.gain.value = 0;
    micSource.connect(capture);
    capture.connect(sink);
    sink.connect(ctx.destination);

    setPhase("connecting");
    pushTurn("system", `Dialing ${agentName}…`);
    const ws = new WebSocket(`${WS_BASE_URL}/chat/v1/${agentId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      openedAtRef.current = Date.now();
      liveRef.current = true;
      liveSinceRef.current = Date.now();
      try {
        ws.send(JSON.stringify({ type: "init", meta_data: { agent_id: agentId, source: "ui-live-talk" } }));
      } catch {
        /* init is best-effort */
      }
      pushTurn("system", "Connected — speak anytime.");
      setPhase("live");
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - liveSinceRef.current) / 1000));
      }, 1000);
    };

    ws.onmessage = handleServerMessage;

    ws.onerror = () => {
      // Pre-live socket failures mean the backend is unreachable. Mid-call
      // blips are left to onclose so a healthy conversation isn't dropped.
      if (!endedRef.current && !liveRef.current) {
        endedRef.current = true;
        setPhase("error");
        setError("Couldn't reach the voice backend. Is it running at the configured API URL?");
        teardown();
      }
    };

    ws.onclose = () => {
      if (endedRef.current) return;
      endedRef.current = true;
      liveRef.current = false;
      const quickDeath = Date.now() - openedAtRef.current < 4000;
      teardown();
      if (quickDeath && !audioHeardRef.current) {
        setPhase("error");
        setError(
          "The realtime provider never answered — the backend couldn't open the model session. " +
            "Check OPENAI_API_KEY and gpt-realtime model access on the backend, then try again."
        );
      } else {
        setPhase("ended");
        pushTurn("system", "Call ended.");
      }
    };
  }, [agentId, agentName, handleServerMessage, pushTurn, teardown]);

  const hangup = useCallback(() => {
    endedRef.current = true;
    liveRef.current = false;
    teardown();
    setPhase("ended");
    pushTurn("system", "You hung up.");
  }, [pushTurn, teardown]);

  const starting = phase === "mic" || phase === "connecting";
  const live = phase === "live";

  return (
    <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
      {/* Stage */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 100, damping: 20 }}
        className="flex-1 flex flex-col items-center justify-center bg-muted/40 backdrop-blur-2xl border border-border rounded-[2.5rem] p-8 shadow-[0_8px_40px_rgba(0,0,0,0.05)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.5)] relative overflow-hidden group min-h-[420px]"
      >
        <div className="absolute top-6 left-8 flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground">
          <RadioReceiver className="w-4 h-4" />
          <span>Live Talk · {agentName}</span>
        </div>
        <div className="absolute top-6 right-8">
          <StatusBadge status={live ? "in_progress" : starting ? "ringing" : "queued"} />
        </div>

        <div className="relative z-10 flex flex-col items-center justify-center flex-1 w-full mt-8">
          <AudioVisualizer isRecording={live && !muted} volume={live && !muted ? volume : 0} />
        </div>

        <div className="relative z-10 pb-2 flex flex-col items-center gap-4">
          <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            {phase === "idle" && "Ready"}
            {phase === "mic" && "Requesting microphone…"}
            {phase === "connecting" && "Dialing…"}
            {live && (muted ? `Muted · ${formatClock(elapsed)}` : `Live · ${formatClock(elapsed)}`)}
            {phase === "ended" && `Ended · ${formatClock(elapsed)}`}
            {phase === "error" && "Failed"}
          </div>

          {phase === "idle" || phase === "ended" ? (
            <button
              onClick={() => void start()}
              disabled={!agentId}
              className="h-14 px-8 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm transition-all hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-primary/20"
            >
              <Mic className="w-5 h-5" />
              <span>{phase === "ended" ? "Talk again" : "Start talking"}</span>
            </button>
          ) : phase === "error" ? (
            <button
              onClick={() => void start()}
              disabled={!agentId}
              className="h-12 px-6 rounded-2xl bg-card border border-border text-foreground font-medium text-sm hover:bg-accent transition-all flex items-center gap-2"
            >
              Try again
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  const next = !muted;
                  setMuted(next);
                  mutedRef.current = next;
                }}
                disabled={!live}
                aria-label={muted ? "Unmute microphone" : "Mute microphone"}
                className={cn(
                  "w-14 h-14 rounded-full border flex items-center justify-center transition-all disabled:opacity-50",
                  muted
                    ? "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400"
                    : "bg-card border-border text-foreground hover:bg-accent"
                )}
              >
                {muted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
              <button
                onClick={hangup}
                aria-label="Hang up"
                className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center transition-all shadow-lg"
              >
                <PhoneOff className="w-5 h-5" />
              </button>
            </div>
          )}

          {starting && <Loader2 className="w-5 h-5 animate-spin text-primary" />}

          {phase === "error" && error && (
            <p className="max-w-sm text-center text-sm text-red-700 dark:text-red-400 rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
            </p>
          )}
        </div>
      </motion.div>

      {/* Transcript */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.1 }}
        className="w-full lg:w-[400px] flex flex-col bg-muted/40 backdrop-blur-2xl border border-border rounded-[2.5rem] p-6 shadow-[0_8px_40px_rgba(0,0,0,0.05)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.5)] relative overflow-hidden min-h-[300px]"
      >
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-border relative z-10">
          <h3 className="text-sm font-mono uppercase tracking-widest text-foreground flex items-center gap-2">
            <AudioLines className="w-4 h-4 text-ember-600 dark:text-ember-400" />
            Live Transcript
          </h3>
        </div>

        <div className="flex-1 overflow-y-auto space-y-5 pr-2 custom-scrollbar relative z-10 min-h-[200px]">
          {turns.length === 0 ? (
            <p className="text-sm text-muted-foreground leading-relaxed">
              Press Start talking and speak — the agent hears you through your microphone and answers
              out loud. Use a headset for the cleanest call.
            </p>
          ) : (
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
          )}
        </div>
      </motion.div>
    </div>
  );
}
