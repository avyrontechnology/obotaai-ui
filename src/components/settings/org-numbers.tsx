"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Loader2, Phone, PlugZap, Plus, Trash2, X } from "lucide-react";
import { useAgents } from "@/services/api";
import {
  useAssignPhoneNumber,
  useCreatePhoneNumber,
  useDeletePhoneNumber,
  usePhoneNumbers,
  useUnassignPhoneNumber,
} from "@/services/platform/phone-numbers";
import { fieldStyles } from "@/lib/field-styles";
import { cn } from "@/lib/utils";


const PROVIDERS = ["simulated", "twilio", "plivo", "exotel", "vobiz", "talko"] as const;

export function OrgNumbers() {
  const { data: numbers, isLoading } = usePhoneNumbers();
  const { data: agents } = useAgents();
  const createNumber = useCreatePhoneNumber();
  const deleteNumber = useDeletePhoneNumber();
  const assignNumber = useAssignPhoneNumber();
  const unassignNumber = useUnassignPhoneNumber();

  const [showForm, setShowForm] = useState(false);
  const [number, setNumber] = useState("");
  const [provider, setProvider] = useState<(typeof PROVIDERS)[number]>("simulated");
  const [country, setCountry] = useState("IN");
  const [error, setError] = useState<string | null>(null);

  const agentNames = new Map((agents ?? []).map((agent) => [agent.agent_id, agent.agent_name]));

  const handleCreate = async () => {
    setError(null);
    if (!number.trim()) {
      setError("Enter a phone number.");
      return;
    }
    try {
      await createNumber.mutateAsync({ number: number.trim(), provider, country: country.trim() || "IN" });
      setNumber("");
      setShowForm(false);
    } catch {
      setError("Could not add the number. Is the backend running?");
    }
  };

  const handleAssign = async (numberId: string, agentId: string) => {
    setError(null);
    try {
      if (!agentId) {
        await unassignNumber.mutateAsync(numberId);
      } else {
        await assignNumber.mutateAsync({ id: numberId, agent_id: agentId });
      }
    } catch {
      setError("Could not update the assignment.");
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-foreground">Phone Numbers</h3>
          <p className="text-sm text-muted-foreground mt-1">Inventory and agent assignment. Purchasing arrives later.</p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors flex items-center gap-2 shrink-0"
          >
            <Plus className="w-4 h-4" /> Add
          </button>
        )}
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-3xl border border-border bg-card p-5 space-y-3"
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                value={number}
                onChange={(event) => setNumber(event.target.value)}
                placeholder="+911234567890"
                aria-label="Phone number"
                className={cn(fieldStyles.fieldSm, "font-mono")}
              />
              <select
                value={provider}
                onChange={(event) => setProvider(event.target.value as (typeof PROVIDERS)[number])}
                aria-label="Number provider"
                className={fieldStyles.fieldSm}
              >
                {PROVIDERS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <input
                value={country}
                onChange={(event) => setCountry(event.target.value)}
                placeholder="IN"
                aria-label="Country code"
                className={fieldStyles.fieldSm}
              />
            </div>
            {error && (
              <p className="flex items-center gap-2 text-xs text-red-700 dark:text-red-400">
                <AlertCircle className="w-3.5 h-3.5" /> {error}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => void handleCreate()}
                disabled={createNumber.isPending}
                className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {createNumber.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Add number
              </button>
              <button
                onClick={() => {
                  setShowForm(false);
                  setError(null);
                }}
                className="h-10 px-4 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {error && !showForm && (
        <p className="flex items-center gap-2 text-xs text-red-700 dark:text-red-400">
          <AlertCircle className="w-3.5 h-3.5" /> {error}
        </p>
      )}

      {isLoading ? (
        <div className="h-40 rounded-3xl bg-card border border-border animate-pulse" />
      ) : (numbers ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground rounded-3xl border border-dashed border-border p-10 text-center">
          No numbers in inventory yet.
        </p>
      ) : (
        <div className="rounded-3xl border border-border overflow-hidden">
          {(numbers ?? []).map((item, index) => {
            const assignedName = item.assigned_agent_id
              ? (agentNames.get(item.assigned_agent_id) ?? `${item.assigned_agent_id.slice(0, 8)}…`)
              : null;
            return (
              <div
                key={item.number_id}
                className={cn("p-4 md:px-5 bg-card", index > 0 && "border-t border-border")}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-sm text-foreground truncate">{item.number}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.provider} · {item.country}
                    </p>
                  </div>
                  <select
                    value={item.assigned_agent_id ?? ""}
                    onChange={(event) => void handleAssign(item.number_id, event.target.value)}
                    aria-label={`Assign ${item.number}`}
                    className="h-9 px-2 max-w-[180px] bg-muted/50 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ember-400/50"
                  >
                    <option value="">Unassigned</option>
                    {(agents ?? []).map((agent) => (
                      <option key={agent.agent_id} value={agent.agent_id}>
                        {agent.agent_name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => void deleteNumber.mutateAsync(item.number_id)}
                    aria-label={`Delete ${item.number}`}
                    className="p-2 rounded-xl text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                {assignedName && (
                  <p className="mt-2 ml-[52px] inline-flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400">
                    <PlugZap className="w-3 h-3" /> {assignedName}
                    <button
                      onClick={() => void handleAssign(item.number_id, "")}
                      aria-label={`Unassign ${item.number}`}
                      className="hover:text-foreground transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
