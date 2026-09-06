/** PCM audio helpers for the live-talk websocket leg. Pure functions, tested. */

export const LIVE_TALK_INPUT_RATE = 16000;
export const LIVE_TALK_CHUNK_SAMPLES = 1600; // 100ms at 16kHz
export const LIVE_TALK_OUTPUT_RATE = 24000;
/** Schedule one source per ~120ms+ of audio: smaller model frames each start/stop
 *  their own source, and every boundary is a potential click. */
export const PLAYBACK_MIN_SAMPLES = 2880; // 120ms at 24kHz
/** Raised-cosine edge fade per scheduled source; kills boundary clicks, inaudible. */
export const PLAYBACK_FADE_SAMPLES = 72; // 3ms at 24kHz

/** Float32 [-1, 1] → signed 16-bit PCM, clamped. */
export function floatTo16BitPCM(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const clamped = Math.max(-1, Math.min(1, input[i]));
    output[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }
  return output;
}

/** Resampler to the 16k talk rate. Integer ratios use an averaging window;
 *  anything else (e.g. 44100 → 16000) uses linear interpolation — the old
 *  nearest-neighbor fallback folded highs into metallic tones on such mics. */
export function downsample(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return input.slice();
  if (fromRate > toRate && fromRate % toRate === 0) {
    const factor = fromRate / toRate;
    const length = Math.floor(input.length / factor);
    const output = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      let sum = 0;
      const start = i * factor;
      for (let j = 0; j < factor; j++) sum += input[start + j] ?? 0;
      output[i] = sum / factor;
    }
    return output;
  }
  const ratio = fromRate / toRate;
  const length = Math.floor(input.length / ratio);
  const output = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const pos = i * ratio;
    const idx = Math.floor(pos);
    const frac = pos - idx;
    const a = input[idx] ?? 0;
    const b = input[idx + 1] ?? a;
    output[i] = a + (b - a) * frac;
  }
  return output;
}

/** Int16 PCM bytes → base64 (chunked to avoid call-stack limits). */
export function pcmToBase64(pcm: Int16Array): string {
  const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/**
 * base64 → Int16 PCM samples. Never throws: the server occasionally emits a
 * chunk whose byte count isn't sample-aligned (odd length), which makes
 * `new Int16Array` throw RangeError and would kill the call. The stray
 * trailing byte is inaudible, so it is dropped.
 */
export function base64ToPcm16(base64: string): Int16Array {
  let binary = "";
  try {
    binary = atob(base64);
  } catch {
    return new Int16Array(0);
  }
  const even = binary.length - (binary.length % 2);
  const bytes = new Uint8Array(even);
  for (let i = 0; i < even; i++) bytes[i] = binary.charCodeAt(i);
  return new Int16Array(bytes.buffer);
}

/** RMS volume 0..1 of time-domain bytes (for the mic meter). */
export function rmsVolume(timeDomain: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < timeDomain.length; i++) {
    const centered = (timeDomain[i] - 128) / 128;
    sum += centered * centered;
  }
  return Math.min(1, Math.sqrt(sum / Math.max(1, timeDomain.length)) * 2.5);
}

/** Raised-cosine fade over the first/last `fadeSamples` (in place, returned for chaining).
 *  Short arrays get a proportionally smaller fade; empty arrays pass through. */
export function applyEdgeFade(samples: Float32Array, fadeSamples: number = PLAYBACK_FADE_SAMPLES): Float32Array {
  const n = Math.min(fadeSamples, Math.floor(samples.length / 2));
  for (let i = 0; i < n; i++) {
    const gain = 0.5 - 0.5 * Math.cos((Math.PI * i) / n);
    samples[i] *= gain;
    samples[samples.length - 1 - i] *= gain;
  }
  return samples;
}

/** Accumulates model audio frames and releases them in ~120ms+ pieces so the
 *  player schedules few, click-free sources instead of one per tiny frame. */
export class OutputChunkCoalescer {  private pending: number[] = [];

  /** Append samples; returns the accumulated audio once it reaches the
   *  scheduling threshold, else []. Order is preserved. */
  push(samples: Float32Array): Float32Array[] {
    for (let i = 0; i < samples.length; i++) this.pending.push(samples[i]);
    if (this.pending.length < PLAYBACK_MIN_SAMPLES) return [];
    return [new Float32Array(this.pending.splice(0, this.pending.length))];
  }

  /** Release leftovers (turn end / sentinel), or null when empty. */
  flush(): Float32Array | null {
    if (this.pending.length === 0) return null;
    return new Float32Array(this.pending.splice(0, this.pending.length));
  }

  reset(): void {
    this.pending = [];
  }

  get buffered(): number {
    return this.pending.length;
  }
}

/** Minimal gain-param surface for ramping a source out on barge-in/hangup. */
export interface FadeableGain {
  cancelScheduledValues: (time: number) => void;
  setValueAtTime: (value: number, time: number) => void;
  linearRampToValueAtTime: (value: number, time: number) => void;
}

/** 15ms fade to silence so interrupting a playing source doesn't click.
 *  Pure logic over the param interface — unit-tested with a mock. */
export function fadeGainOut(gain: FadeableGain, now: number, fadeSec = 0.015): void {
  gain.cancelScheduledValues(now);
  gain.setValueAtTime(1, now);
  gain.linearRampToValueAtTime(0, now + fadeSec);
}

/** Source for the 16k mic-capture AudioWorklet. Fractional linear-interpolation
 *  resampling with cross-block stitching: exact for integer ratios (48000),
 *  correct pitch for the rest (44100), and proper upsampling for 8k BT mics —
 *  the old integer-factor decimation sent 14.7k-as-16k (slow) on 44.1k mics
 *  and 8k-as-16k (chipmunk) on Bluetooth ones. */
export function buildCaptureWorklet(outRate: number = LIVE_TALK_INPUT_RATE): string {
  return `
class PcmCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = [];
    this._inputRate = sampleRate;
    this._in = [];
    this._pos = 0;
  }
  process(inputs) {
    const channel = inputs[0]?.[0];
    if (!channel) return true;
    for (let i = 0; i < channel.length; i++) this._in.push(channel[i]);
    const ratio = this._inputRate / ${outRate};
    while (this._pos + 1 < this._in.length) {
      const idx = Math.floor(this._pos);
      const frac = this._pos - idx;
      const a = this._in[idx];
      const b = this._in[idx + 1];
      this._buffer.push(a + (b - a) * frac);
      if (this._buffer.length >= ${LIVE_TALK_CHUNK_SAMPLES}) {
        this.port.postMessage(new Float32Array(this._buffer.splice(0, ${LIVE_TALK_CHUNK_SAMPLES})));
      }
      this._pos += ratio;
    }
    // Always retain one sample so interpolation stitches across blocks.
    const drop = Math.min(Math.floor(this._pos), this._in.length - 1);
    if (drop > 0) {
      this._in.splice(0, drop);
      this._pos -= drop;
    }
    return true;
  }
}
registerProcessor("pcm-capture", PcmCapture);
`;
}
