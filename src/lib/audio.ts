/** PCM audio helpers for the live-talk websocket leg. Pure functions, tested. */

export const LIVE_TALK_INPUT_RATE = 16000;
export const LIVE_TALK_CHUNK_SAMPLES = 1600; // 100ms at 16kHz

/** Float32 [-1, 1] → signed 16-bit PCM, clamped. */
export function floatTo16BitPCM(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const clamped = Math.max(-1, Math.min(1, input[i]));
    output[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }
  return output;
}

/** Naive downsampler (averaging window). fromRate must be a multiple-friendly
 *  superset of toRate (e.g. 48000 → 16000); falls back to nearest-neighbor. */
export function downsample(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return input.slice();
  if (fromRate < toRate || fromRate % toRate !== 0) {
    const ratio = fromRate / toRate;
    const length = Math.floor(input.length / ratio);
    const output = new Float32Array(length);
    for (let i = 0; i < length; i++) output[i] = input[Math.floor(i * ratio)];
    return output;
  }
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
