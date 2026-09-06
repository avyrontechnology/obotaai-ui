import type { Execution } from "@/lib/schemas/platform";

const HEADERS = [
  "execution_id",
  "agent_id",
  "batch_id",
  "direction",
  "from_number",
  "to_number",
  "status",
  "started_at",
  "duration_s",
  "e2e_ms",
  "hangup_code",
  "summary",
  "transcript",
] as const;

function escapeCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function transcriptToText(execution: Execution): string {
  return execution.transcript.map((turn) => `${turn.role}: ${turn.text}`).join(" | ");
}

/** Serialize executions to CSV for export. Pure function, tested. */
export function executionsToCsv(executions: Execution[]): string {
  const rows = executions.map((execution) =>
    [
      execution.execution_id,
      execution.agent_id,
      execution.batch_id ?? "",
      execution.direction,
      execution.from_number ?? "",
      execution.to_number ?? "",
      execution.status,
      execution.started_at,
      String(execution.duration_s),
      execution.latency ? String(execution.latency.e2e_ms) : "",
      execution.hangup_code ?? "",
      execution.summary ?? "",
      transcriptToText(execution),
    ]
      .map(escapeCell)
      .join(",")
  );
  return [HEADERS.join(","), ...rows].join("\r\n");
}

/** Trigger a browser download of CSV text. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
