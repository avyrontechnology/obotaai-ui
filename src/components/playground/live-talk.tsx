"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  Loader2,
  Mic,
  MicOff,
  PhoneOff,
  RadioReceiver,
  SendHorizonal,
} from "lucide-react";
import { StatusBadge } from "@/components/calls/status-badge";
import { WS_BASE_URL } from "@/lib/api-client";
import { fetchWsTicket } from "@/services/auth";
import { emitPlaygroundBus, subscribePlaygroundBus } from "@/lib/playground-bus";
import { VoiceWaveform, combineLevels } from "./voice-waveform";
import {
  JitterPanel,
  SessionTabs,
  TranscriptList,
  ToolsPanel,
  type SessionStats,
  type SessionTab,
} from "./session-ui";
import {
  LIVE_TALK_OUTPUT_RATE,
  OutputChunkCoalescer,
  applyEdgeFade,
  base64ToPcm16,
  buildCaptureWorklet,
  fadeGainOut,
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
  /** Caller-turn correlation from the backend; lets cumulative ASR re-emissions
   *  ("A" -> "A B") update one bubble instead of stacking four. */
  asrTurnId?: number | string | null;
}

/** Append a transcript turn, updating the last bubble when a caller turn grows.
 *  Pure — unit-tested. Agent/system turns always append. */
export function upsertTurn(
  turns: TalkTurn[],
  opts: { id: number; role: TalkTurn["role"]; text: string; ts: string; asrTurnId?: number | string | null }
): TalkTurn[] {
  const { id, role, text, ts, asrTurnId } = opts;
  const last = turns[turns.length - 1];
  if (
    role === "user" &&
    asrTurnId !== undefined &&
    asrTurnId !== null &&
    last !== undefined &&
    last.role === "user" &&
    last.asrTurnId === asrTurnId
  ) {
    return [...turns.slice(0, -1), { ...last, text, ts }];
  }
  return [...turns.slice(-49), { id, role, text, ts, asrTurnId: asrTurnId ?? undefined }];
}

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export interface LiveSessionSnapshot {
  phase: Phase;
  turns: number;
  elapsedSec: number;
  framesIn: number;
  framesOut: number;
  /** Device output rate (e.g. 48000) — the player resamples into it. */
  deviceRate?: number;
  /** Audio sources scheduled for playback this call. */
  playedChunks?: number;
}

const INTENT_SUGGESTIONS = ["Check Refund Policy", "Reschedule Appointment", "Speak with Human"];

export function LiveTalk({
  agentId,
  agentName,
  canTalk = true,
  onStats,
}: {
  agentId: string;
  agentName: string;
  /** Role gate: viewers see the panel but cannot start a call. */
  canTalk?: boolean;
  /** Snapshot callback for the Debug Drawer (called ~1/s while active). */
  onStats?: (snapshot: LiveSessionSnapshot) => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0);
  const [levels, setLevels] = useState<number[]>([]);
  const [turns, setTurns] = useState<TalkTurn[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<SessionTab>("transcript");
  const [draft, setDraft] = useState("");
  const [stats, setStats] = useState<SessionStats>({ e2eMs: null, jitterMs: null, turns: 0, elapsedSec: 0 });

  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const playAnalyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const workletUrlRef = useRef<string | null>(null);
  const mutedRef = useRef(false);
  const playheadRef = useRef(0);
  const sourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const gainsRef = useRef<GainNode[]>([]);
  const smootherRef = useRef(new OutputChunkCoalescer());
  const turnIdRef = useRef(0);
  const turnCountRef = useRef(0);
  const openedAtRef = useRef(0);
  const liveRef = useRef(false);
  const audioHeardRef = useRef(false);
  const liveSinceRef = useRef(0);
  const rafRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endedRef = useRef(false);
  // Measured session telemetry (all observed, never estimated).
  const framesInRef = useRef(0);
  const framesOutRef = useRef(0);
  const deviceRateRef = useRef(0);
  const playedRef = useRef(0);
  const audioTimesRef = useRef<number[]>([]);
  const pendingSinceRef = useRef<number | null>(null);
  const lastE2eRef = useRef<number | null>(null);
  const onStatsRef = useRef(onStats);
  useEffect(() => {
    onStatsRef.current = onStats;
  }, [onStats]);

  const pushTurn = useCallback((role: TalkTurn["role"], text: string) => {
    const id = ++turnIdRef.current;
    if (role !== "system") turnCountRef.current += 1;
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
    gainsRef.current = [];
    playheadRef.current = 0;
    smootherRef.current.reset();
    micStreamRef.current?.getTracks().forEach((track) => track.stop());
    micStreamRef.current = null;
    playAnalyserRef.current = null;
    if (audioCtxRef.current) {
      void audioCtxRef.current.close().catch(() => undefined);
      audioCtxRef.current = null;
    }
    if (workletUrlRef.current) {
      URL.revokeObjectURL(workletUrlRef.current);
      workletUrlRef.current = null;
    }
    setVolume(0);
    setLevels([]);
  }, []);

  // Unmount safety: never leave mic/ws open.
  useEffect(() => () => teardown(), [teardown]);

  const stopPlayback = useCallback(() => {
    const ctx = audioCtxRef.current;
    // Fade out instead of hard-stopping: cutting a source mid-waveform clicks.
    if (ctx && ctx.state !== "closed") {
      const now = ctx.currentTime;
      gainsRef.current.forEach((gain) => {
        try {
          fadeGainOut(gain.gain, now);
        } catch {
          /* already stopped */
        }
      });
    }
    const stale = sourcesRef.current;
    sourcesRef.current = [];
    gainsRef.current = [];
    window.setTimeout(() => {
      stale.forEach((source) => {
        try {
          source.stop();
        } catch {
          /* already stopped */
        }
      });
    }, 40);
    smootherRef.current.reset();
    if (ctx) playheadRef.current = ctx.currentTime;
  }, []);

  const scheduleSamples = useCallback((samples: Float32Array) => {
    const ctx = audioCtxRef.current;
    if (!ctx || ctx.state === "closed" || samples.length === 0) return;
    if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
    applyEdgeFade(samples);
    const buffer = ctx.createBuffer(1, samples.length, LIVE_TALK_OUTPUT_RATE);
    buffer.getChannelData(0).set(samples);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    // Per-source gain (see stopPlayback): lets barge-in fade out instead of click.
    const gain = ctx.createGain();
    gain.gain.value = 1;
    source.connect(gain);
    // Route agent audio through the playback analyser so the orb waveform
    // dances for agent speech too — analyser passes audio through untouched.
    gain.connect(playAnalyserRef.current ?? ctx.destination);
    // Generous lookahead: transcript setState re-renders share this thread and can
    // delay scheduling past a tight horizon, which surfaces as gaps/choppiness.
    const startAt = Math.max(playheadRef.current, ctx.currentTime + 0.12);
    source.start(startAt);
    playheadRef.current = startAt + buffer.duration;
    sourcesRef.current.push(source);
    gainsRef.current.push(gain);
    playedRef.current += 1;
    source.onended = () => {
      sourcesRef.current = sourcesRef.current.filter((s) => s !== source);
      gainsRef.current = gainsRef.current.filter((g) => g !== gain);
    };
    audioHeardRef.current = true;
  }, []);

  const playPcm24k = useCallback(
    (base64: string) => {
      try {
        // Model frames vary wildly in size (2.5KB–38KB); scheduling one source per
        // tiny frame turns every boundary into a click. Coalesce to ~120ms+ pieces
        // and flush leftovers on the turn-end sentinel (which decodes to 0 samples).
        const int16 = base64ToPcm16(base64);
        if (int16.length === 0) {
          const rest = smootherRef.current.flush();
          if (rest && rest.length > 0) {
            const asFloat = new Float32Array(rest.length);
            for (let i = 0; i < rest.length; i++) asFloat[i] = rest[i] / 0x8000;
            scheduleSamples(asFloat);
          }
          return;
        }
        const asFloat = new Float32Array(int16.length);
        for (let i = 0; i < int16.length; i++) asFloat[i] = int16[i] / 0x8000;
        for (const piece of smootherRef.current.push(asFloat)) scheduleSamples(piece);
      } catch {
        // A single malformed chunk must never take down the call.
      }
    },
    [scheduleSamples]
  );

  const handleServerMessage = useCallback(
    (event: MessageEvent) => {
      let message: { type?: string; data?: unknown; name?: string; role?: string; asr_turn_id?: unknown };
      try {
        message = JSON.parse(event.data as string);
      } catch {
        return;
      }
      const ws = wsRef.current;
      framesInRef.current += 1;
      if (message.type === "ack") {
        // Kept for forward-compat; the connected line is pushed on open
        // because this backend doesn't emit ack on the call leg.
      } else if (message.type === "audio" && typeof message.data === "string") {
        const now = performance.now();
        const arrivals = audioTimesRef.current;
        arrivals.push(now);
        if (arrivals.length > 20) arrivals.shift();
        if (pendingSinceRef.current !== null) {
          lastE2eRef.current = Math.round(now - pendingSinceRef.current);
          pendingSinceRef.current = null;
        }
        playPcm24k(message.data);
      } else if (message.type === "text" && typeof message.data === "string") {
        if (pendingSinceRef.current !== null) {
          lastE2eRef.current = Math.round(performance.now() - pendingSinceRef.current);
          pendingSinceRef.current = null;
        }
        const role = message.role === "user" ? "user" : "agent";
        const rawId = message.asr_turn_id;
        const asrTurnId =
          role === "user" && (typeof rawId === "number" || typeof rawId === "string") ? rawId : undefined;
        const id = ++turnIdRef.current;
        const ts = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        const text = message.data;
        setTurns((prev) => upsertTurn(prev, { id, role, text, ts, asrTurnId }));
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
    [playPcm24k, stopPlayback]
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
    setLevels([]);
    setStats({ e2eMs: null, jitterMs: null, turns: 0, elapsedSec: 0 });
    turnIdRef.current = 0;
    turnCountRef.current = 0;
    framesInRef.current = 0;
    framesOutRef.current = 0;
    deviceRateRef.current = 0;
    playedRef.current = 0;
    audioTimesRef.current = [];
    pendingSinceRef.current = null;
    lastE2eRef.current = null;
    audioHeardRef.current = false;
    smootherRef.current.reset();
    // A stale playhead from a previous call would schedule the first greeting
    // tens of seconds out (new contexts start near t=0) — "Talk again" silence.
    playheadRef.current = 0;
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
    deviceRateRef.current = ctx.sampleRate;
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
    // Playback tap for the orb waveform (agent speech). Placed before the
    // destination; an analyser never alters the audio passing through it.
    const playAnalyser = ctx.createAnalyser();
    playAnalyser.fftSize = 256;
    playAnalyser.connect(ctx.destination);
    playAnalyserRef.current = playAnalyser;
    const meter = new Uint8Array(analyser.frequencyBinCount);
    const micSpectrum = new Uint8Array(analyser.frequencyBinCount);
    const playSpectrum = new Uint8Array(playAnalyser.frequencyBinCount);
    let lastMeter = 0;
    const tickMeter = () => {
      analyser.getByteTimeDomainData(meter);
      const now = performance.now();
      if (now - lastMeter > 120) {
        lastMeter = now;
        setVolume(rmsVolume(meter));
        analyser.getByteFrequencyData(micSpectrum);
        playAnalyser.getByteFrequencyData(playSpectrum);
        setLevels(combineLevels(micSpectrum, playSpectrum, !mutedRef.current));
      }
      rafRef.current = requestAnimationFrame(tickMeter);
    };
    rafRef.current = requestAnimationFrame(tickMeter);

    // 16k PCM capture worklet (fractional resampling lives in lib/audio).
    try {
      const url = URL.createObjectURL(new Blob([buildCaptureWorklet()], { type: "application/javascript" }));
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
      // The AudioWorklet already resampled the audio to 16k talk rate.
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
    // Same-origin cookies ride the handshake automatically; otherwise (or
    // for fresh sessions) attach a single-use ticket minted for this call.
    let url = `${WS_BASE_URL}/chat/v1/${agentId}`;
    try {
      const ticket = await fetchWsTicket();
      url += `?token=${encodeURIComponent(ticket)}`;
    } catch {
      /* fall back to cookie auth */
    }
    const ws = new WebSocket(url);
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
      // Greeting latency baseline: measured to the first agent frame below.
      pendingSinceRef.current = performance.now();
      timerRef.current = setInterval(() => {
        const elapsedSec = Math.floor((Date.now() - liveSinceRef.current) / 1000);
        setElapsed(elapsedSec);
        const arrivals = audioTimesRef.current;
        let jitter: number | null = null;
        if (arrivals.length >= 3) {
          const gaps: number[] = [];
          for (let i = 1; i < arrivals.length; i++) gaps.push(arrivals[i] - arrivals[i - 1]);
          const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
          const variance = gaps.reduce((a, b) => a + (b - mean) ** 2, 0) / gaps.length;
          jitter = Math.round(Math.sqrt(variance));
        }
        setStats((prev) => {
          const next = {
            e2eMs: lastE2eRef.current,
            jitterMs: jitter,
            turns: turnCountRef.current,
            elapsedSec,
          };
          return next.e2eMs === prev.e2eMs &&
            next.jitterMs === prev.jitterMs &&
            next.turns === prev.turns &&
            next.elapsedSec === prev.elapsedSec
            ? prev
            : next;
        });
        onStatsRef.current?.({
          phase: "live",
          turns: turnCountRef.current,
          elapsedSec,
          framesIn: framesInRef.current,
          framesOut: framesOutRef.current,
          deviceRate: deviceRateRef.current || undefined,
          playedChunks: playedRef.current,
        });
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
          "The voice backend hung up before any audio — the model session failed to open. " +
            "Check the backend logs for the real error (API keys, model access, or agent config), then try again."
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

  // Typed injection over the voice socket: the engine answers out loud.
  // Returns false when there is no live socket to send on.
  const sendTextMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      const ws = wsRef.current;
      if (!trimmed || !ws || ws.readyState !== WebSocket.OPEN) return false;
      try {
        ws.send(JSON.stringify({ type: "text", data: trimmed }));
        framesOutRef.current += 1;
        pendingSinceRef.current = performance.now();
        pushTurn("user", trimmed);
        return true;
      } catch {
        return false;
      }
    },
    [pushTurn]
  );

  // Page chrome (Clear button, intent chips, message box) reaches the live
  // session through the bus — socket state stays inside this component.
  useEffect(() => {
    return subscribePlaygroundBus((event) => {
      if (event.type === "clear-transcript") {
        setTurns([]);
      } else if (event.type === "send-text") {
        sendTextMessage(event.text);
      }
    });
  }, [sendTextMessage]);

  // Space toggles mute while live (never while typing).
  useEffect(() => {
    if (phase !== "live") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      event.preventDefault();
      setMuted((value) => {
        mutedRef.current = !value;
        return !value;
      });
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [phase]);

  const starting = phase === "mic" || phase === "connecting";
  const live = phase === "live";

  const previewTurns = turns.filter((turn) => turn.role !== "system").slice(-2);
  const orbScale = live && !muted ? 1 + Math.min(volume, 1) * 0.12 : 1;

  const submitDraft = () => {
    if (sendTextMessage(draft)) setDraft("");
  };

  return (
    <div className="grid lg:grid-cols-[1.15fr_1fr] gap-6 flex-1 min-h-0">
      {/* Left: live session card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        data-testid="session-card"
        className="bg-card border border-border rounded-[2rem] p-6 shadow-[0_20px_50px_-24px_rgba(17,24,39,0.25)] relative overflow-hidden flex flex-col min-h-0 min-w-0"
      >
        <div className="flex items-center justify-between gap-3 shrink-0">
          <p className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground min-w-0">
            <RadioReceiver className="w-4 h-4 text-ember-600 dark:text-ember-400 shrink-0" />
            <span className="truncate">Live session · {agentName}</span>
          </p>
          <span className="flex items-center gap-3 shrink-0">
            <StatusBadge status={live ? "in_progress" : starting ? "ringing" : "queued"} />
            <span className="font-mono text-xs tabular-nums text-muted-foreground">{formatClock(elapsed)}</span>
          </span>
        </div>

        {/* Orb with expanding waves — waves mark a live session (either side
            may be speaking), so muting the mic must not kill them. */}
        <div
          className="relative flex items-center justify-center py-2 flex-1 min-h-0"
          aria-hidden="true"
          data-testid="session-orb"
          data-live={live}
        >
          {live
            ? [0, 1, 2].map((index) => (
                <span
                  key={index}
                  data-testid="session-wave"
                  className="ring-expand absolute w-28 h-28 rounded-full border border-ember-500/40"
                  style={{ animationDelay: `${index}s` }}
                />
              ))
            : [0, 1].map((index) => (
                <span
                  key={index}
                  className="absolute rounded-full border border-border"
                  style={{ width: 112 + index * 36, height: 112 + index * 36 }}
                />
              ))}
          <span
            className={cn(
              "relative w-28 h-28 rounded-full overflow-hidden transition-all duration-300",
              live
                ? "bg-[radial-gradient(circle_at_35%_30%,var(--primary-foreground),var(--primary)_70%)] shadow-[0_0_60px_rgba(231,63,30,0.35)]"
                : "bg-[radial-gradient(circle_at_35%_30%,#FFF7EA,#F9B637_140%)] dark:bg-[radial-gradient(circle_at_35%_30%,#3a2c14,#a82d11_140%)] border border-ember-500/30"
            )}
            style={{ transform: `scale(${orbScale.toFixed(3)})` }}
          >
            <VoiceWaveform levels={levels} live={live} count={12} />
          </span>
        </div>

        <p className="text-center font-mono text-xs uppercase tracking-widest text-muted-foreground shrink-0" aria-live="polite">
          {phase === "idle" && "Ready"}
          {phase === "mic" && "Requesting microphone…"}
          {phase === "connecting" && "Dialing…"}
          {live && (muted ? "Muted — press Space to talk" : "Listening — press Space to mute")}
          {phase === "ended" && "Ended"}
          {phase === "error" && "Failed"}
        </p>
        <div className="mt-3 flex flex-col items-center gap-2 shrink-0">
          {!canTalk && (phase === "idle" || phase === "ended") && (
            <p className="max-w-sm text-center text-xs text-muted-foreground rounded-2xl border border-dashed border-border px-4 py-2">
              Read-only role — live sessions need a member role or higher.
            </p>
          )}
          {phase === "idle" || phase === "ended" ? (
            <button
              onClick={() => void start()}
              disabled={!agentId || !canTalk}
              title={canTalk ? undefined : "Requires member role or higher"}
              className="h-11 px-8 rounded-2xl bg-gradient-to-r from-[#E73F1E] to-[#FB6C00] text-white font-semibold text-sm transition-all hover:brightness-105 disabled:opacity-50 flex items-center gap-2 shadow-[0_16px_32px_-12px_rgba(231,63,30,0.55)]"
            >
              <Mic className="w-5 h-5" aria-hidden="true" />
              <span>{phase === "ended" ? "Talk again" : "Start talking"}</span>
            </button>
          ) : phase === "error" ? (
            <button
              onClick={() => void start()}
              disabled={!agentId}
              className="h-10 px-6 rounded-2xl bg-card border border-border text-foreground font-medium text-sm hover:bg-accent transition-all flex items-center gap-2"
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
                aria-pressed={muted}
                title="Mute (or press Space)"
                className={cn(
                  "w-11 h-11 rounded-full border flex items-center justify-center transition-all disabled:opacity-50",
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
                className="h-11 px-6 rounded-full bg-red-600 hover:bg-red-700 text-white font-medium text-sm flex items-center gap-2 transition-all shadow-md"
              >
                <PhoneOff className="w-4 h-4" /> End
              </button>
            </div>
          )}
          {starting && <Loader2 className="w-5 h-5 animate-spin text-primary" aria-hidden="true" />}

          {phase === "error" && error && (
            <p role="alert" className="max-w-sm text-center text-sm text-red-700 dark:text-red-400 rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-2 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
            </p>
          )}
        </div>

        {/* Mini preview of the last turns */}
        {previewTurns.length > 0 && (
          <div className="mt-3 space-y-1.5 shrink-0" aria-label="Latest exchanges">
            {previewTurns.map((turn) => (
              <p key={turn.id} className="flex items-baseline gap-2 text-[13px] min-w-0">
                <span
                  className={cn(
                    "shrink-0 px-2 py-0.5 rounded-md text-[10px] font-mono uppercase tracking-wider",
                    turn.role === "agent"
                      ? "bg-ember-500/10 text-ember-700 dark:text-ember-300"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {turn.role === "agent" ? "Agent" : "You"}
                </span>
                <span className="text-muted-foreground truncate">{turn.text}</span>
              </p>
            ))}
          </div>
        )}

        {/* Intent shortcuts + typed injection — pinned footer */}
        <div className="mt-3 pt-3 border-t border-border/60 shrink-0">
          <div className="flex gap-2 mb-2 overflow-x-auto custom-scrollbar pb-1" role="group" aria-label="Suggested intents">
            {INTENT_SUGGESTIONS.map((intent) => (
              <button
                key={intent}
                type="button"
                onClick={() => sendTextMessage(intent)}
                disabled={!live}
                className="shrink-0 px-3.5 h-8 rounded-full border border-border bg-card text-xs text-foreground hover:border-primary/40 hover:bg-primary/5 disabled:opacity-40 transition-all whitespace-nowrap"
              >
                {intent}
              </button>
            ))}
          </div>
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              submitDraft();
            }}
          >
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Type a custom message or prompt injection…"
              disabled={!live}
              aria-label="Type a message to the agent"
              className="flex-1 min-w-0 h-10 px-4 bg-card border border-border rounded-2xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ember-400/50 disabled:opacity-50 transition-all"
            />
            <button
              type="submit"
              disabled={!live || !draft.trim()}
              aria-label="Send message"
              className="h-10 w-10 shrink-0 rounded-2xl bg-foreground text-background flex items-center justify-center hover:opacity-90 disabled:opacity-40 transition-all"
            >
              <SendHorizonal className="w-4 h-4" />
            </button>
          </form>
        </div>
      </motion.div>

      {/* Right: tabbed transcript panel */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.05 }}
        className="flex flex-col bg-card border border-border rounded-[2rem] p-6 shadow-[0_20px_50px_-24px_rgba(17,24,39,0.25)] relative overflow-hidden min-h-[420px] lg:min-h-0 min-w-0"
      >
        <SessionTabs tab={tab} onChange={setTab} onClear={() => emitPlaygroundBus({ type: "clear-transcript" })} />
        <div className="pt-4 flex-1 flex flex-col min-h-0 min-w-0">
          {tab === "transcript" && (
            <TranscriptList
              turns={turns}
              emptyHint="Press Start talking and speak — the agent hears you through your microphone and answers out loud. Use a headset for the cleanest call."
            />
          )}
          {tab === "tools" && <ToolsPanel agentId={agentId} />}
          {tab === "jitter" && <JitterPanel stats={stats} hasAudio />}
        </div>
      </motion.div>
    </div>
  );
}
