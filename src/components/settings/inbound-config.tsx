"use client";

import { useState } from "react";
import { AlertCircle, Check, Loader2, Plus, X } from "lucide-react";
import { FormSection } from "./form-controls";
import { useInbound, useUpdateInbound } from "@/services/platform/inbound";
import { useAssignPhoneNumber, usePhoneNumbers, useUnassignPhoneNumber } from "@/services/platform/phone-numbers";
import { Toggle } from "@/components/common/toggle";
import { fieldStyles } from "@/lib/field-styles";
import { cn } from "@/lib/utils";


interface InboundDraft {
  greeting: string;
  spam_protection: boolean;
  caller_match_source: "none" | "csv" | "sheets" | "api";
  caller_match_ref: string;
  blocklist: string[];
}

const EMPTY_DRAFT: InboundDraft = {
  greeting: "",
  spam_protection: true,
  caller_match_source: "none",
  caller_match_ref: "",
  blocklist: [],
};

export function InboundConfigForm({ agentId }: { agentId: string }) {
  const { data: inbound, isLoading } = useInbound(agentId);
  const updateInbound = useUpdateInbound(agentId);
  const { data: numbers } = usePhoneNumbers();
  const assignNumber = useAssignPhoneNumber();
  const unassignNumber = useUnassignPhoneNumber();

  const [draft, setDraft] = useState<InboundDraft | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState<string>("");
  const [savedFlash, setSavedFlash] = useState(false);
  const [blockDraft, setBlockDraft] = useState("");
  const [assignError, setAssignError] = useState<string | null>(null);

  // Seed the editable draft from the platform API once loaded (render-phase
  // init keeps React Compiler happy; no effect-driven setState cascades).
  if (inbound && draft === null) {
    const next: InboundDraft = {
      greeting: inbound.greeting ?? "",
      spam_protection: inbound.spam_protection,
      caller_match_source: inbound.caller_match_source,
      caller_match_ref: inbound.caller_match_ref ?? "",
      blocklist: inbound.blocklist,
    };
    setDraft(next);
    setSavedSnapshot(JSON.stringify(next));
  }

  const editable = draft ?? EMPTY_DRAFT;
  const dirty = draft !== null && JSON.stringify(draft) !== savedSnapshot;

  const assignedNumber = (numbers ?? []).find((item) => item.assigned_agent_id === agentId);

  const patch = (update: Partial<InboundDraft>) => {
    setDraft((prev) => ({ ...(prev ?? EMPTY_DRAFT), ...update }));
    setSavedFlash(false);
  };

  const addBlocked = () => {
    const number = blockDraft.trim();
    const current = draft?.blocklist ?? [];
    if (!number || current.includes(number)) return;
    patch({ blocklist: [...current, number] });
    setBlockDraft("");
  };

  const handleSave = async () => {
    if (!draft) return;
    setSavedFlash(false);
    await updateInbound.mutateAsync({
      assigned_number_id: assignedNumber?.number_id ?? null,
      greeting: draft.greeting.trim() || null,
      spam_protection: draft.spam_protection,
      caller_match_source: draft.caller_match_source,
      caller_match_ref: draft.caller_match_ref.trim() || null,
      blocklist: draft.blocklist,
    });
    setSavedSnapshot(JSON.stringify(draft));
    setSavedFlash(true);
  };

  const handleAssign = async (numberId: string) => {
    setAssignError(null);
    try {
      if (!numberId) {
        if (assignedNumber) await unassignNumber.mutateAsync(assignedNumber.number_id);
      } else {
        await assignNumber.mutateAsync({ id: numberId, agent_id: agentId });
      }
    } catch {
      setAssignError("Could not update number assignment.");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-24 rounded-2xl bg-muted/50 animate-pulse" />
        <div className="h-24 rounded-2xl bg-muted/50 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <FormSection
        title="Phone Number"
        description="Assign a platform number to this agent for inbound calls."
      >
        <div className="col-span-1 md:col-span-2 space-y-2">
          <select
            value={assignedNumber?.number_id ?? ""}
            onChange={(event) => void handleAssign(event.target.value)}
            aria-label="Assigned phone number"
            className={cn(fieldStyles.field, "max-w-md")}
          >
            <option value="">No number assigned</option>
            {(numbers ?? []).map((item) => (
              <option key={item.number_id} value={item.number_id}>
                {item.number} · {item.provider}
                {item.assigned_agent_id && item.assigned_agent_id !== agentId ? " (in use)" : ""}
              </option>
            ))}
          </select>
          {(numbers ?? []).length === 0 && (
            <p className="text-xs text-muted-foreground">
              No numbers in inventory yet. Number purchasing arrives in a later milestone.
            </p>
          )}
          {assignError && <p className="text-xs text-red-700 dark:text-red-400">{assignError}</p>}
        </div>
      </FormSection>

      <FormSection
        title="Caller Matching"
        description="Identify callers from your own data and greet them personally."
      >
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">Match Source</span>
          <select
            value={editable.caller_match_source}
            onChange={(event) =>
              patch({ caller_match_source: event.target.value as InboundDraft["caller_match_source"] })
            }
            aria-label="Caller match source"
            className={fieldStyles.field}
          >
            <option value="none">None</option>
            <option value="csv">CSV Upload</option>
            <option value="sheets">Google Sheets</option>
            <option value="api">API Lookup</option>
          </select>
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">Source Reference</span>
          <input
            value={editable.caller_match_ref}
            onChange={(event) => patch({ caller_match_ref: event.target.value })}
            placeholder="customers.csv, sheet URL, or endpoint"
            aria-label="Caller match reference"
            className={fieldStyles.field}
          />
        </label>
        <label className="col-span-1 md:col-span-2 flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">Inbound Greeting</span>
          <input
            value={editable.greeting}
            onChange={(event) => patch({ greeting: event.target.value })}
            placeholder="Thanks for calling Acme! How can I help?"
            aria-label="Inbound greeting"
            className={fieldStyles.field}
          />
        </label>
      </FormSection>

      <FormSection
        title="Spam Protection"
        description="Screen unwanted callers before the agent picks up."
      >
        <div className="col-span-1 md:col-span-2 flex items-start justify-between gap-4 p-4 rounded-xl bg-muted/50 border border-border">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-foreground">Spam Screening</span>
            <span className="text-xs text-muted-foreground">
              Challenge silent or flagged callers before connecting
            </span>
          </div>
          <Toggle
            checked={editable.spam_protection}
            onChange={(value) => patch({ spam_protection: value })}
            label="Spam screening"
          />
        </div>
        <div className="col-span-1 md:col-span-2 space-y-3">
          <div className="flex flex-wrap gap-2">
            {editable.blocklist.length === 0 && (
              <p className="text-sm text-muted-foreground">No blocked numbers.</p>
            )}
            {editable.blocklist.map((number) => (
              <span
                key={number}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20 text-xs font-mono"
              >
                {number}
                <button
                  type="button"
                  onClick={() => patch({ blocklist: editable.blocklist.filter((item) => item !== number) })}
                  aria-label={`Unblock ${number}`}
                  className="hover:text-foreground transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={blockDraft}
              onChange={(event) => setBlockDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addBlocked();
                }
              }}
              placeholder="+911234567890"
              aria-label="Number to block"
              className={cn(fieldStyles.field, "font-mono")}
            />
            <button
              type="button"
              onClick={addBlocked}
              aria-label="Block number"
              className="h-11 w-11 shrink-0 flex items-center justify-center rounded-2xl bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </FormSection>

      <div className="flex items-center gap-3">
        <button
          onClick={() => void handleSave().catch(() => undefined)}
          disabled={updateInbound.isPending || !dirty}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {updateInbound.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          Save Inbound Settings
        </button>
        {savedFlash && !dirty && (
          <span className="flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-400">
            <Check className="w-4 h-4" /> Saved
          </span>
        )}
        {updateInbound.isError && (
          <span className="flex items-center gap-1.5 text-sm text-red-700 dark:text-red-400">
            <AlertCircle className="w-4 h-4" /> Save failed
          </span>
        )}
      </div>
    </div>
  );
}
