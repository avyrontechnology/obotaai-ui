import type { Execution } from "@/lib/schemas/platform";

/** Dashboard time ranges. "live" shows the trailing hour with polling. */
export type RangeKey = "live" | "1h" | "24h" | "7d";

export const RANGE_MS: Record<RangeKey, number> = {
  live: 60 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
};

export const RANGE_LABEL: Record<RangeKey, string> = {
  live: "Live",
  "1h": "1h",
  "24h": "24h",
  "7d": "7d",
};

const ts = (iso: string): number => new Date(iso).getTime();

/** Executions started within [now - window, now]. */
export function filterByRange(executions: Execution[], windowMs: number, nowMs = Date.now()): Execution[] {
  return executions.filter((execution) => {
    const started = ts(execution.started_at);
    return Number.isFinite(started) && started <= nowMs && started >= nowMs - windowMs;
  });
}

/** Split into current + previous equal windows for trend comparison. */
export function splitWindows(
  executions: Execution[],
  windowMs: number,
  nowMs = Date.now()
): { current: Execution[]; previous: Execution[] } {
  const current = filterByRange(executions, windowMs, nowMs);
  const previous = executions.filter((execution) => {
    const started = ts(execution.started_at);
    return (
      Number.isFinite(started) && started < nowMs - windowMs && started >= nowMs - 2 * windowMs
    );
  });
  return { current, previous };
}

/** Percent change current vs previous. null when previous is empty. */
export function trendPercent(currentCount: number, previousCount: number): number | null {
  if (previousCount <= 0) return null;
  return ((currentCount - previousCount) / previousCount) * 100;
}

/** Fixed-width bins of counts across the window (oldest → newest). */
export function binCounts(
  executions: Execution[],
  windowMs: number,
  bins: number,
  nowMs = Date.now()
): { start: number; count: number }[] {
  const width = windowMs / bins;
  const counts = Array.from({ length: bins }, (_, index) => ({
    start: nowMs - windowMs + index * width,
    count: 0,
  }));
  for (const execution of executions) {
    const started = ts(execution.started_at);
    if (!Number.isFinite(started) || started > nowMs || started < nowMs - windowMs) continue;
    const index = Math.min(bins - 1, Math.floor((started - (nowMs - windowMs)) / width));
    counts[index].count++;
  }
  return counts;
}

/** Mean STT / LLM / TTS stage latency across executions that report breakdowns. */
export function avgStageMs(executions: Execution[]): { stt: number | null; llm: number | null; tts: number | null } {
  let sttSum = 0;
  let sttN = 0;
  let llmSum = 0;
  let llmN = 0;
  let ttsSum = 0;
  let ttsN = 0;
  for (const execution of executions) {
    const latency = execution.latency;
    if (!latency) continue;
    if (Number.isFinite(latency.transcriber_ms)) {
      sttSum += latency.transcriber_ms;
      sttN++;
    }
    if (Number.isFinite(latency.llm_ms)) {
      llmSum += latency.llm_ms;
      llmN++;
    }
    if (Number.isFinite(latency.synthesizer_ms)) {
      ttsSum += latency.synthesizer_ms;
      ttsN++;
    }
  }
  return {
    stt: sttN > 0 ? sttSum / sttN : null,
    llm: llmN > 0 ? llmSum / llmN : null,
    tts: ttsN > 0 ? ttsSum / ttsN : null,
  };
}

/** Completion + failed share for the range. */
export function completionStats(executions: Execution[]): {
  total: number;
  completed: number;
  completedRate: number | null;
  failedRate: number | null;
} {
  const total = executions.length;
  if (total === 0) return { total: 0, completed: 0, completedRate: null, failedRate: null };
  const completed = executions.filter((e) => e.status === "completed").length;
  const failed = executions.filter((e) => e.status === "failed").length;
  return {
    total,
    completed,
    completedRate: completed / total,
    failedRate: failed / total,
  };
}

/** p95 of e2e latency across executions that report it. */
export function p95E2E(executions: Execution[]): number | null {
  const samples = executions
    .map((e) => e.latency?.e2e_ms)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
    .sort((a, b) => a - b);
  if (samples.length === 0) return null;
  return samples[Math.min(samples.length - 1, Math.ceil(samples.length * 0.95) - 1)];
}

/** Short agent label: first 8 of the id plus the resolved name. */
export function agentLabel(agentId: string, name?: string): string {
  const short = agentId.length > 8 ? `${agentId.slice(0, 8)}` : agentId;
  return name ? `${short} (${name})` : short;
}
