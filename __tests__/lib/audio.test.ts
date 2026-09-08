import {
  LIVE_TALK_CHUNK_SAMPLES,
  LIVE_TALK_INPUT_RATE,
  PLAYBACK_MIN_SAMPLES,
  OutputChunkCoalescer,
  applyEdgeFade,
  base64ToPcm16,
  buildCaptureWorklet,
  downsample,
  fadeGainOut,
  floatTo16BitPCM,
  pcmToBase64,
  rmsVolume,
} from "@/lib/audio";

describe("live-talk audio utils", () => {
  it("exposes the 16k/100ms chunk contract", () => {
    expect(LIVE_TALK_INPUT_RATE).toBe(16000);
    expect(LIVE_TALK_CHUNK_SAMPLES).toBe(1600);
  });

  it("converts float samples to clamped int16", () => {
    const pcm = floatTo16BitPCM(new Float32Array([0, 0.5, -0.5, 1, -1, 2, -2]));
    expect(Array.from(pcm)).toEqual([0, 16383, -16384, 32767, -32768, 32767, -32768]);
  });

  it("downsamples 48k to 16k by thirds", () => {
    const input = new Float32Array(4800).fill(0.6);
    const output = downsample(input, 48000, 16000);
    expect(output.length).toBe(1600);
    expect(output[0]).toBeCloseTo(0.6, 5);
  });

  it("interpolates non-integer ratios instead of staircasing (44.1k mics)", () => {
    const input = new Float32Array(4410);
    for (let i = 0; i < input.length; i++) input[i] = i / (input.length - 1);
    const output = downsample(input, 44100, 16000);
    expect(output.length).toBe(1600);
    // A linear ramp must survive resampling; nearest-neighbor would staircase.
    let maxErr = 0;
    for (let i = 0; i < output.length; i++) maxErr = Math.max(maxErr, Math.abs(output[i] - i / (output.length - 1)));
    expect(maxErr).toBeLessThan(0.01);
  });

  it("passes input through when rates match", () => {
    const input = new Float32Array([0.1, 0.2]);
    const output = downsample(input, 16000, 16000);
    expect(output[0]).toBeCloseTo(0.1, 5);
    expect(output[1]).toBeCloseTo(0.2, 5);
    expect(output).not.toBe(input);
  });

  it("round-trips pcm through base64", () => {
    const pcm = new Int16Array([0, 1000, -1000, 32767, -32768]);
    expect(Array.from(base64ToPcm16(pcmToBase64(pcm)))).toEqual(Array.from(pcm));
  });

  it("tolerates odd-length and garbage payloads without throwing", () => {
    // 3 bytes -> drops the trailing byte instead of RangeError.
    const odd = btoa(String.fromCharCode(1, 2, 3));
    expect(() => base64ToPcm16(odd)).not.toThrow();
    expect(base64ToPcm16(odd).length).toBe(1);
    expect(base64ToPcm16("!!!not-base64!!!").length).toBe(0);
    expect(base64ToPcm16("").length).toBe(0);
  });

  it("measures silence as ~0 and tone as >0", () => {
    expect(rmsVolume(new Uint8Array(128).fill(128))).toBeCloseTo(0, 5);
    const tone = new Uint8Array(128).map((_, i) => (i % 2 === 0 ? 200 : 56));
    expect(rmsVolume(tone)).toBeGreaterThan(0.2);
  });

  it("fades source edges to zero without touching the middle", () => {
    const samples = new Float32Array(1000).fill(1);
    applyEdgeFade(samples, 72);
    expect(samples[0]).toBeCloseTo(0, 5);
    expect(samples[999]).toBeCloseTo(0, 5);
    expect(samples[500]).toBe(1);
    // Monotonic ramp on both edges.
    expect(samples[36]).toBeGreaterThan(samples[0]);
    expect(samples[36]).toBeLessThan(1);
  });

  it("tolerates empty and tiny arrays in the fade", () => {
    expect(() => applyEdgeFade(new Float32Array(0))).not.toThrow();
    const tiny = new Float32Array([1, 1]);
    applyEdgeFade(tiny, 72);
    expect(tiny.length).toBe(2);
  });

  it("coalesces small frames and releases at the threshold", () => {
    const coalescer = new OutputChunkCoalescer();
    const small = new Float32Array(500).fill(0.5);
    expect(coalescer.push(small)).toEqual([]);
    expect(coalescer.push(small)).toEqual([]);
    expect(coalescer.buffered).toBe(1000);
    const ready = coalescer.push(new Float32Array(PLAYBACK_MIN_SAMPLES).fill(0.5));
    expect(ready.length).toBe(1);
    expect(ready[0].length).toBe(1000 + PLAYBACK_MIN_SAMPLES);
    expect(coalescer.buffered).toBe(0);
  });

  it("flushes leftovers and resets cleanly", () => {
    const coalescer = new OutputChunkCoalescer();
    expect(coalescer.flush()).toBeNull();
    coalescer.push(new Float32Array(100).fill(0.25));
    const rest = coalescer.flush();
    expect(rest?.length).toBe(100);
    expect(rest?.[0]).toBeCloseTo(0.25, 5);
    expect(coalescer.flush()).toBeNull();
    coalescer.push(new Float32Array(100));
    coalescer.reset();
    expect(coalescer.buffered).toBe(0);
    expect(coalescer.flush()).toBeNull();
  });

  it("ramps a gain to silence for click-free stops", () => {    const calls: Array<[string, ...number[]]> = [];
    const gain = {
      cancelScheduledValues: (t: number) => calls.push(["cancel", t]),
      setValueAtTime: (v: number, t: number) => calls.push(["set", v, t]),
      linearRampToValueAtTime: (v: number, t: number) => calls.push(["ramp", v, t]),
    };
    fadeGainOut(gain, 10);
    expect(calls).toEqual([
      ["cancel", 10],
      ["set", 1, 10],
      ["ramp", 0, 10.015],
    ]);
  });

  it("soaks a realistic Gemini frame sequence without tiny schedulable pieces", () => {
    // Byte sizes observed on live Gemini turns (base64 chars): sentinel + mixed frames.
    const frameBytes = [4, 25600, 12800, 30720, 10240, 5120, 17920, 2560, 33280, 10240];
    const coalescer = new OutputChunkCoalescer();
    const scheduled: Float32Array[] = [];
    let sampleValue = 0;
    const seen: number[] = [];
    for (const n of frameBytes) {
      const int16 = new Int16Array(n / 2);
      for (let i = 0; i < int16.length; i++) {
        int16[i] = (sampleValue = (sampleValue + 1) % 1000);
        seen.push(int16[i]);
      }
      if (int16.length === 0) {
        const rest = coalescer.flush();
        if (rest && rest.length > 0) scheduled.push(applyEdgeFade(Float32Array.from(rest, (v) => v / 0x8000)));
        continue;
      }
      for (const piece of coalescer.push(Float32Array.from(int16, (v) => v / 0x8000))) {
        scheduled.push(applyEdgeFade(piece));
      }
    }
    const tail = coalescer.flush();
    if (tail && tail.length > 0) scheduled.push(applyEdgeFade(Float32Array.from(tail, (v) => v / 0x8000)));
    // Order preserved end to end.
    const flat: number[] = [];
    for (const p of scheduled) for (const v of p) flat.push(Math.round(v * 0x8000));
    expect(flat.length).toBe(seen.length);
    // Every scheduled piece carries faded (near-zero) edges.
    for (const p of scheduled) {
      if (p.length > 0) {
        expect(Math.abs(p[0])).toBeLessThan(0.05);
        expect(Math.abs(p[p.length - 1])).toBeLessThan(0.05);
      }
    }
    // No sludge of sub-threshold pieces: at most the flushed tail is small.
    const small = scheduled.filter((p) => p.length < PLAYBACK_MIN_SAMPLES);
    expect(small.length).toBeLessThanOrEqual(1);
  });

  describe("mic capture worklet", () => {
    function makeNode(deviceRate: number) {
      let Processor: new () => {
        port: { postMessage: (m: Float32Array) => void };
        process: (inputs: Float32Array[][]) => boolean;
      };
      const registerProcessor = (_name: string, cls: typeof Processor) => {
        Processor = cls;
      };
      const fn = new Function("AudioWorkletProcessor", "registerProcessor", "sampleRate", buildCaptureWorklet());
      fn(
        class {},
        registerProcessor,
        deviceRate
      );
      const posted: Float32Array[] = [];
      const node = new Processor!();
      node.port = { postMessage: (m: Float32Array) => posted.push(m) };
      return { node, posted };
    }

    function feed(node: { process: (inputs: Float32Array[][]) => boolean }, samples: Float32Array, block = 128) {
      for (let i = 0; i < samples.length; i += block) {
        expect(node.process([[samples.slice(i, i + block)]])).toBe(true);
      }
    }

    it("downsamples 48k by exact thirds", () => {
      const { node, posted } = makeNode(48000);
      feed(node, new Float32Array(4800).fill(0.5));
      const total = posted.reduce((n, m) => n + m.length, 0);
      expect(total).toBe(1600);
      for (const m of posted) for (const v of m) expect(v).toBeCloseTo(0.5, 5);
    });

    it("keeps pitch on 44.1k instead of sending 14.7k-as-16k", () => {
      const { node, posted } = makeNode(44100);
      const input = new Float32Array(4410);
      for (let i = 0; i < input.length; i++) input[i] = i / (input.length - 1);
      feed(node, input);
      const total = posted.reduce((n, m) => n + m.length, 0);
      expect(total).toBe(1600);
      const flat = posted.reduce((acc, m) => [...acc, ...m], [] as number[]);
      let maxErr = 0;
      for (let i = 0; i < flat.length; i++) maxErr = Math.max(maxErr, Math.abs(flat[i] - i / (flat.length - 1)));
      expect(maxErr).toBeLessThan(0.02);
    });

    it("upsamples 8k BT mics instead of chipmunking", () => {
      const { node, posted } = makeNode(8000);
      feed(node, new Float32Array(9600).fill(-0.25));
      const total = posted.reduce((n, m) => n + m.length, 0);
      // 2x rate in full 1600-sample posts; the live stream keeps ~1 block buffered.
      expect(total).toBe(11 * 1600);
      for (const m of posted.slice(0, 2)) for (const v of m) expect(v).toBeCloseTo(-0.25, 4);
    });

    it("stitches blocks without steps", () => {
      const { node, posted } = makeNode(44100);
      feed(node, new Float32Array(4410).fill(0.7), 128);
      for (const m of posted) for (const v of m) expect(v).toBeCloseTo(0.7, 4);
    });

    it("handles a 24k single-rate context (1.5x down to 16k)", () => {
      const { node, posted } = makeNode(24000);
      const input = new Float32Array(2400);
      for (let i = 0; i < input.length; i++) input[i] = i / (input.length - 1);
      feed(node, input);
      const total = posted.reduce((n, m) => n + m.length, 0);
      expect(total).toBe(1600);
      const flat = posted.reduce((acc, m) => [...acc, ...m], [] as number[]);
      let maxErr = 0;
      for (let i = 0; i < flat.length; i++) maxErr = Math.max(maxErr, Math.abs(flat[i] - i / (flat.length - 1)));
      expect(maxErr).toBeLessThan(0.02);
    });
  });
});
