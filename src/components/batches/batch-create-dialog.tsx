"use client";

import { useMemo, useRef, useState } from "react";
import { AlertCircle, FileUp, Loader2, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { parseCsv, type ParsedCsv } from "@/lib/csv";
import { Modal } from "@/components/common/modal";
import { Toggle } from "@/components/common/toggle";
import { fieldStyles } from "@/lib/field-styles";
import { useAgents } from "@/services/api";
import { useCreateBatch } from "@/services/platform/batches";
import { minRoleFor, useCan } from "@/lib/rbac";
import { cn } from "@/lib/utils";

const MAX_ENTRIES = 500;

interface BatchCreateDialogProps {
  open: boolean;
  onClose: () => void;
  /** Deep-linked agent (from ?agent=). Manual selection overrides it. */
  initialAgentId?: string;
}

function guessPhoneColumn(headers: string[]): string {
  const match = headers.find((header) => /phone|number|mobile|tel/i.test(header));
  return match ?? headers[0] ?? "";
}

export function BatchCreateDialog({ open, onClose, initialAgentId = "" }: BatchCreateDialogProps) {
  const router = useRouter();
  const { data: agents } = useAgents();
  const createBatch = useCreateBatch();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [agentOverride, setAgentOverride] = useState<string | null>(null);
  // Manual selection wins; otherwise the deep link, otherwise the first agent.
  const agentId = agentOverride ?? initialAgentId;
  const setAgentId = (value: string) => setAgentOverride(value);
  const [csv, setCsv] = useState<ParsedCsv | null>(null);
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [phoneColumn, setPhoneColumn] = useState("");
  const [mappedColumns, setMappedColumns] = useState<Record<string, string>>({});
  const [scheduleAt, setScheduleAt] = useState("");
  const [hoursEnabled, setHoursEnabled] = useState(false);
  const [hoursStart, setHoursStart] = useState("09:00");
  const [hoursEnd, setHoursEnd] = useState("18:00");

  const effectiveAgentId = agentId || agents?.[0]?.agent_id || "";

  const preview = useMemo(() => {
    if (!csv || !phoneColumn) return { entries: [], skipped: 0 };
    const entries: { to_number: string; variables: Record<string, string> }[] = [];
    let skipped = 0;
    for (const row of csv.rows) {
      const to_number = (row[phoneColumn] ?? "").trim();
      if (!to_number) {
        skipped++;
        continue;
      }
      const variables: Record<string, string> = {};
      for (const [column, variable] of Object.entries(mappedColumns)) {
        if (column !== phoneColumn && variable.trim() && row[column] !== undefined) {
          variables[variable.trim()] = row[column];
        }
      }
      entries.push({ to_number, variables });
    }
    return { entries, skipped };
  }, [csv, phoneColumn, mappedColumns]);

  const overLimit = preview.entries.length > MAX_ENTRIES;
  const canWrite = useCan("batches.write");

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setParseError(null);
    try {
      const parsed = parseCsv(await file.text());
      setCsv(parsed);
      setFileName(file.name);
      const phone = guessPhoneColumn(parsed.headers);
      setPhoneColumn(phone);
      const mapping: Record<string, string> = {};
      parsed.headers.forEach((header) => {
        if (header !== phone) mapping[header] = header;
      });
      setMappedColumns(mapping);
    } catch (error) {
      setCsv(null);
      setFileName("");
      setParseError(error instanceof Error ? error.message : "Could not parse CSV");
    }
  };

  const canSubmit =
    canWrite &&
    name.trim().length > 0 &&
    effectiveAgentId &&
    preview.entries.length > 0 &&
    !overLimit &&
    !createBatch.isPending;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    try {
      const batch = await createBatch.mutateAsync({
        agent_id: effectiveAgentId,
        name: name.trim(),
        entries: preview.entries,
        schedule_at: scheduleAt ? new Date(scheduleAt).toISOString() : undefined,
        calling_hours: hoursEnabled ? { start: hoursStart, end: hoursEnd } : undefined,
      });
      onClose();
      router.push(`/batches/${batch.batch_id}`);
    } catch {
      // Surfaced via createBatch.error below.
    }
  };


  return (
    <Modal
      open={open}
      onClose={onClose}
      label="New batch campaign"
      className="max-w-2xl p-0"
      header={
        <div className="flex items-center justify-between p-6 pb-4 border-b border-border sticky top-0 bg-card z-10">
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">
              New campaign
            </p>
            <h3 className="text-xl font-semibold tracking-tight text-foreground">Batch calling</h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close batch creator"
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      }
    >
      <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                      Campaign name
                    </span>
                    <input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="COD confirmations"
                      className={fieldStyles.field}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Agent</span>
                    <select
                      value={effectiveAgentId}
                      onChange={(event) => setAgentId(event.target.value)}
                      aria-label="Batch agent"
                      className={fieldStyles.field}
                    >
                      {(agents ?? []).map((agent) => (
                        <option key={agent.agent_id} value={agent.agent_id}>
                          {agent.agent_name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div>
                  <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                    Recipients CSV
                  </span>
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="mt-2 w-full flex items-center justify-center gap-2 h-24 rounded-2xl border border-dashed border-border bg-muted/40 hover:bg-muted/70 transition-colors text-sm text-muted-foreground"
                  >
                    <FileUp className="w-5 h-5" />
                    {fileName || "Upload CSV — phone,name,…"}
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    aria-label="Upload recipients CSV"
                    onChange={(event) => {
                      void handleFile(event.target.files?.[0]);
                      event.target.value = "";
                    }}
                  />
                  {parseError && (
                    <p className="mt-2 flex items-center gap-2 text-sm text-red-700 dark:text-red-400">
                      <AlertCircle className="w-4 h-4" /> {parseError}
                    </p>
                  )}
                </div>

                {csv && (
                  <div className="space-y-4 rounded-2xl border border-border bg-muted/40 p-4">
                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                        Phone column
                      </span>
                      <select
                        value={phoneColumn}
                        onChange={(event) => setPhoneColumn(event.target.value)}
                        aria-label="Phone number column"
                        className={fieldStyles.field}
                      >
                        {csv.headers.map((header) => (
                          <option key={header} value={header}>
                            {header}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div>
                      <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                        Variable mapping
                      </span>
                      <div className="mt-2 space-y-2">
                        {csv.headers
                          .filter((header) => header !== phoneColumn)
                          .map((header) => (
                            <div key={header} className="flex items-center gap-2">
                              <span className="flex-1 min-w-0 font-mono text-xs text-muted-foreground truncate" title={header}>{header}</span>
                              <span className="text-xs text-muted-foreground shrink-0">→</span>
                              <input
                                value={mappedColumns[header] ?? ""}
                                onChange={(event) =>
                                  setMappedColumns((prev) => ({ ...prev, [header]: event.target.value }))
                                }
                                placeholder="variable (blank to skip)"
                                aria-label={`Variable for ${header}`}
                                className={cn(fieldStyles.field, "h-9 font-mono text-xs flex-1 min-w-0")}
                              />
                            </div>
                          ))}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {preview.entries.length} recipients ready
                      {preview.skipped > 0 && ` · ${preview.skipped} rows skipped (no number)`}
                      {overLimit && ` · over the ${MAX_ENTRIES} limit`}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                      Schedule (optional)
                    </span>
                    <input
                      type="datetime-local"
                      value={scheduleAt}
                      onChange={(event) => setScheduleAt(event.target.value)}
                      aria-label="Schedule batch for"
                      className={fieldStyles.field}
                    />
                  </label>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                      Calling hours
                    </span>
                    <div className="flex items-center gap-2 h-11">
                      <Toggle
                        checked={hoursEnabled}
                        onChange={setHoursEnabled}
                        label="Restrict calling hours"
                      />
                      <input
                        type="time"
                        value={hoursStart}
                        onChange={(event) => setHoursStart(event.target.value)}
                        disabled={!hoursEnabled}
                        aria-label="Calling window start"
                        className={cn(fieldStyles.field, "h-9 disabled:opacity-40")}
                      />
                      <input
                        type="time"
                        value={hoursEnd}
                        onChange={(event) => setHoursEnd(event.target.value)}
                        disabled={!hoursEnabled}
                        aria-label="Calling window end"
                        className={cn(fieldStyles.field, "h-9 disabled:opacity-40")}
                      />
                    </div>
                  </div>
                </div>

                {createBatch.isError && (
                  <p className="flex items-center gap-2 text-sm text-red-700 dark:text-red-400">
                    <AlertCircle className="w-4 h-4" /> Failed to create the batch. Check the backend and retry.
                  </p>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  title={canWrite ? undefined : `Requires ${minRoleFor("batches.write")} role`}
                  className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm transition-all hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
                >
                  {createBatch.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  Create batch{preview.entries.length > 0 && ` · ${preview.entries.length} calls`}
                </button>
      </div>
    </Modal>
  );
}
