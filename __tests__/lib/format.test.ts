import { displayCallerNumber, formatDuration, formatLatency, timeAgo } from "@/lib/format";

describe("format utils", () => {
  it("timeAgo renders relative times", () => {
    const now = new Date("2026-09-03T00:01:00+00:00").getTime();
    expect(timeAgo("2026-09-03T00:00:30+00:00", now)).toBe("30s ago");
    expect(timeAgo("2026-09-02T23:56:00+00:00", now)).toBe("5m ago");
    expect(timeAgo("2026-09-02T22:01:00+00:00", now)).toBe("2h ago");
    expect(timeAgo("2026-09-01T00:01:00+00:00", now)).toBe("2d ago");
    expect(timeAgo("2026-09-03T00:00:59+00:00", now)).toBe("just now");
  });

  it("formatDuration renders seconds compactly", () => {
    expect(formatDuration(12)).toBe("12s");
    expect(formatDuration(75)).toBe("1m 15s");
    expect(formatDuration(0)).toBe("0s");
  });

  it("formatLatency renders milliseconds", () => {
    expect(formatLatency(280)).toBe("280ms");
    expect(formatLatency(1500)).toBe("1.5s");
    expect(formatLatency(null)).toBe("—");
  });

  it("displayCallerNumber hides null/blank/unknown numbers", () => {
    expect(displayCallerNumber("+911234")).toBe("+911234");
    expect(displayCallerNumber("  +911234  ")).toBe("+911234");
    expect(displayCallerNumber(null)).toBe("—");
    expect(displayCallerNumber("")).toBe("—");
    expect(displayCallerNumber("unknown")).toBe("—");
    expect(displayCallerNumber("Unknown")).toBe("—");
    expect(displayCallerNumber("unknown", "Unknown caller")).toBe("Unknown caller");
  });
});
