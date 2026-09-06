"use client";

import { cn } from "@/lib/utils";

export const WAVEFORM_BARS = 18;
/** Resting bar height — the recorder flatline, never fully invisible. */
const FLOOR = 0.08;

function sliceAvg(data: ArrayLike<number>, bar: number): number {
  if (data.length === 0) return 0;
  const span = Math.max(1, Math.floor(((data.length * 3) / 4 / WAVEFORM_BARS)));
  const start = 2 + bar * span;
  let sum = 0;
  let count = 0;
  for (let k = start; k < Math.min(start + span, data.length); k++) {
    sum += data[k] / 255;
    count += 1;
  }
  return count === 0 ? 0 : sum / count;
}

/**
 * Merge mic + playback frequency spectra into per-bar 0..1 levels for the
 * orb waveform. Pure function — unit-tested. Either side speaking moves
 * the bars; muting the mic zeroes only the mic contribution so agent
 * speech still animates the orb.
 */
export function combineLevels(
  mic: ArrayLike<number>,
  play: ArrayLike<number>,
  micActive: boolean
): number[] {
  const out: number[] = [];
  for (let i = 0; i < WAVEFORM_BARS; i++) {
    const peak = Math.max(micActive ? sliceAvg(mic, i) : 0, sliceAvg(play, i));
    out.push(Math.min(1, Math.max(FLOOR, peak)));
  }
  return out;
}

/** Recorder-style bars clipped to the orb circle. Empty levels = flatline. */
export function VoiceWaveform({
  levels,
  live,
  count = WAVEFORM_BARS,
}: {
  levels: number[];
  live: boolean;
  /** Fewer bars for smaller orbs so they fit the circle. */
  count?: number;
}) {
  const full = levels.length === WAVEFORM_BARS ? levels : new Array<number>(WAVEFORM_BARS).fill(FLOOR);
  const bars = full.slice(0, Math.max(1, count));
  return (
    <span
      data-testid="voice-waveform"
      className="absolute inset-0 flex items-center justify-center gap-[2px] px-4"
    >
      {bars.map((level, index) => (
        <span
          key={index}
          style={{ height: `${Math.round(5 + level * 68)}px` }}
          className={cn(
            "w-1 shrink-0 rounded-full transition-[height] duration-150 ease-out",
            live ? "bg-white/90" : "bg-ember-500/30"
          )}
        />
      ))}
    </span>
  );
}
