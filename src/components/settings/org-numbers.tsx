"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Loader2, Phone, PhoneForwarded, PhoneOff, PlugZap, Plus, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useAgents } from "@/services/api";
import {
  useAssignPhoneNumber,
  useCreatePhoneNumber,
  useDeletePhoneNumber,
  usePhoneNumbers,
  useUnassignPhoneNumber,
} from "@/services/platform/phone-numbers";
import { fieldStyles } from "@/lib/field-styles";
import { minRoleFor, useCan } from "@/lib/rbac";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SectionHeader } from "@/components/common/section-header";
import { SearchInput } from "@/components/common/search-input";
import { SettingsStatCard, SettingsStatsGrid } from "@/components/settings/settings-stats";
import { ProviderSetup } from "@/components/settings/provider-setup";


const PROVIDERS = ["simulated", "twilio", "plivo", "exotel", "vobiz", "talko"] as const;

function NumbersStats() {
  const { data: numbers, isLoading } = usePhoneNumbers();
  const counts = useMemo(() => {
    const list = numbers ?? [];
    const assigned = list.filter((n) => !!n.assigned_agent_id).length;
    const providers = new Set(list.map((n) => n.provider)).size;
    return { total: list.length, assigned, unassigned: list.length - assigned, providers };
  }, [numbers]);
  return (
    <SettingsStatsGrid label="Number inventory summary">
      <SettingsStatCard
        title="Total"
        icon={Phone}
        value={isLoading ? "—" : String(counts.total)}
        caption={isLoading ? "Loading" : "Numbers in inventory"}
        loading={isLoading}
        delay={0}
      />
      <SettingsStatCard
        title="Assigned"
        icon={PhoneForwarded}
        value={isLoading ? "—" : String(counts.assigned)}
        caption={isLoading ? "Loading" : "Routed to an agent"}
        loading={isLoading}
        delay={0.05}
      />
      <SettingsStatCard
        title="Unassigned"
        icon={PhoneOff}
        value={isLoading ? "—" : String(counts.unassigned)}
        caption={isLoading ? "Loading" : "Awaiting routing"}
        loading={isLoading}
        delay={0.1}
      />
      <SettingsStatCard
        title="Providers"
        icon={PlugZap}
        value={isLoading ? "—" : String(counts.providers)}
        caption={isLoading ? "Loading" : "Distinct providers in use"}
        loading={isLoading}
        delay={0.15}
      />
    </SettingsStatsGrid>
  );
}

export function OrgNumbers() {
  const { data: numbers, isLoading } = usePhoneNumbers();
  const { data: agents } = useAgents();
  const createNumber = useCreatePhoneNumber();
  const deleteNumber = useDeletePhoneNumber();
  const assignNumber = useAssignPhoneNumber();
  const unassignNumber = useUnassignPhoneNumber();
  // Numbers writes need platform:write (member+). UI-only gate via the
  // member-level agents.write action; backend re-checks on every endpoint.
  const canManageNumbers = useCan("agents.write");

  const [showForm, setShowForm] = useState(false);
  const [number, setNumber] = useState("");
  const [provider, setProvider] = useState<(typeof PROVIDERS)[number]>("simulated");
  const [country, setCountry] = useState("IN");
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const agentNames = new Map((agents ?? []).map((agent) => [agent.agent_id, agent.agent_name]));

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return numbers ?? [];
    return (numbers ?? []).filter((item) => {
      const assignedName = item.assigned_agent_id
        ? (agentNames.get(item.assigned_agent_id) ?? item.assigned_agent_id)
        : "";
      return [item.number, item.provider, item.country, item.status, assignedName]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numbers, query, agents]);

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
    <div className="space-y-6 min-w-0">
      <NumbersStats />

      <ProviderSetup />

      <section className="rounded-3xl border border-border bg-card p-5 md:p-6 min-w-0">
        <SectionHeader
          title="Phone Numbers"
          description={canManageNumbers ? "Inventory and agent assignment. Purchasing arrives later." : `Read-only — requires ${minRoleFor("agents.write")} role.`}
          action={
            !showForm && canManageNumbers ? (
              <button
                onClick={() => setShowForm(true)}
                className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 cursor-pointer transition-colors duration-200 flex items-center gap-2 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
              >
                <Plus className="w-4 h-4" aria-hidden="true" /> Add
              </button>
            ) : undefined
          }
          className="mb-6"
        />
        {!canManageNumbers && (
          <p className="mb-4 text-xs text-muted-foreground rounded-2xl border border-dashed border-border px-4 py-3">
            Read-only for your role — number management needs a {minRoleFor("agents.write")} role.
          </p>
        )}

        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-3xl border border-border bg-muted/40 p-5 space-y-3 mb-4 min-w-0 motion-reduce:transition-none"
            >
              <p className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">New number</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 min-w-0">
                <input
                  value={number}
                  onChange={(event) => setNumber(event.target.value)}
                  placeholder="+911234567890"
                  aria-label="Phone number"
                  className={cn(fieldStyles.fieldSm, "font-mono min-w-0 tabular-nums")}
                />
                <select
                  value={provider}
                  onChange={(event) => setProvider(event.target.value as (typeof PROVIDERS)[number])}
                  aria-label="Number provider"
                  className={cn(fieldStyles.fieldSm, "min-w-0 cursor-pointer")}
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
                  className={cn(fieldStyles.fieldSm, "min-w-0 font-mono")}
                />
              </div>
              {error && (
                <p role="alert" className="flex items-center gap-2 text-xs text-destructive min-w-0">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /> <span className="truncate">{error}</span>
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => void handleCreate()}
                  disabled={createNumber.isPending}
                  className="flex-1 min-w-[140px] h-10 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors duration-200 flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
                >
                  {createNumber.isPending && <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                  Add number
                </button>
                <button
                  onClick={() => {
                    setShowForm(false);
                    setError(null);
                  }}
                  className="h-10 px-4 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {error && !showForm && (
          <p role="alert" className="flex items-center gap-2 text-xs text-destructive mb-4 min-w-0">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /> <span className="truncate">{error}</span>
          </p>
        )}

        {isLoading ? (
          <div className="h-40 rounded-3xl bg-muted/50 border border-border animate-pulse motion-reduce:animate-none" />
        ) : (numbers ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground rounded-3xl border border-dashed border-border p-10 text-center">
            No numbers in inventory yet. Connect a provider above, then add your first number.
          </p>
        ) : (
          <>
            <div className="mb-4">
              <SearchInput
                value={query}
                onChange={setQuery}
                placeholder="Filter by number, provider, status or agent…"
                label="Filter numbers"
                className="!w-full max-w-none sm:max-w-xs"
              />
            </div>
            {visible.length === 0 ? (
              <p className="text-sm text-muted-foreground rounded-3xl border border-dashed border-border p-10 text-center">
                No numbers match this filter.
              </p>
            ) : (
            <>
            <div className="hidden sm:grid sm:grid-cols-12 gap-3 px-5 py-2 text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
              <div className="sm:col-span-5 truncate">Number</div>
              <div className="sm:col-span-4 truncate">Assignment</div>
              <div className="sm:col-span-3 text-right truncate">Actions</div>
            </div>
            <div className="rounded-3xl border border-border overflow-hidden min-w-0">
              {visible.map((item, index) => {
                const assignedName = item.assigned_agent_id
                  ? (agentNames.get(item.assigned_agent_id) ?? `${item.assigned_agent_id.slice(0, 8)}…`)
                  : null;
                return (
                  <div
                    key={item.number_id}
                    className={cn("p-4 md:px-5 bg-card min-w-0", index > 0 && "border-t border-border")}
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center min-w-0">
                      <div className="sm:col-span-5 flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                          <Phone className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="flex items-center gap-2 min-w-0">
                            <span className="font-mono text-sm text-foreground truncate tabular-nums" title={item.number}>{item.number}</span>
                            <span
                              className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-muted text-muted-foreground border border-border truncate shrink-0"
                              title={`Status: ${item.status}`}
                            >
                              {item.status}
                            </span>
                          </p>
                          <p className="text-xs text-muted-foreground truncate" title={`${item.provider} · ${item.country} · added ${timeAgo(item.created_at)}`}>
                            {item.provider} · {item.country} · added {timeAgo(item.created_at)}
                          </p>
                        </div>
                      </div>
                      <div className="sm:col-span-4 min-w-0">
                        <select
                          value={item.assigned_agent_id ?? ""}
                          onChange={(event) => void handleAssign(item.number_id, event.target.value)}
                          aria-label={`Assign ${item.number}`}
                          disabled={!canManageNumbers}
                          title={canManageNumbers ? undefined : `Requires ${minRoleFor("agents.write")} role`}
                          className="h-9 px-2 w-full max-w-[220px] bg-muted/50 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ember-400/50 truncate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <option value="">Unassigned</option>
                          {(agents ?? []).map((agent) => (
                            <option key={agent.agent_id} value={agent.agent_id}>
                              {agent.agent_name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="sm:col-span-3 flex sm:justify-end min-w-0">
                        <button
                          onClick={() => void deleteNumber.mutateAsync(item.number_id)}
                          aria-label={`Delete ${item.number}`}
                          disabled={!canManageNumbers}
                          title={canManageNumbers ? undefined : `Requires ${minRoleFor("agents.write")} role`}
                          className="p-2 rounded-xl text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 cursor-pointer disabled:cursor-not-allowed transition-colors duration-200 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 motion-reduce:transition-none disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                    {assignedName && item.assigned_agent_id && (
                      <p className="mt-2 ml-[52px] flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400 min-w-0 max-w-full">
                        <PlugZap className="w-3 h-3 shrink-0" aria-hidden="true" />
                        <Link
                          href={`/agents/${item.assigned_agent_id}`}
                          className="truncate hover:underline underline-offset-2 cursor-pointer transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 rounded motion-reduce:transition-none"
                          title={assignedName}
                        >
                          {assignedName}
                        </Link>
                        <button
                          onClick={() => void handleAssign(item.number_id, "")}
                          aria-label={`Unassign ${item.number}`}
                          disabled={!canManageNumbers}
                          className="hover:text-foreground cursor-pointer disabled:cursor-not-allowed transition-colors duration-200 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 rounded motion-reduce:transition-none disabled:opacity-50"
                        >
                          <X className="w-3 h-3" aria-hidden="true" />
                        </button>
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            </>
            )}
          </>
        )}
      </section>

      <p className="text-xs font-mono text-muted-foreground tabular-nums truncate" title="Assignment routes inbound calls to the selected agent">
        Assignment routes inbound calls to the selected agent.
      </p>
    </div>
  );
}
