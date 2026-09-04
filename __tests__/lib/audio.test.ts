import {
  LIVE_TALK_CHUNK_SAMPLES,
  LIVE_TALK_INPUT_RATE,
  base64ToPcm16,
  downsample,
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
});
