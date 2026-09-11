"use client";

import { useMemo } from "react";
import { BellRing, Globe2, Plug2, Power, Trash2 } from "lucide-react";
import Link from "next/link";
import { useAgents } from "@/services/api";
import { useDeleteWebhook, useWebhooks } from "@/services/platform/webhooks";
import { timeAgo } from "@/lib/format";
import { SectionHeader } from "@/components/common/section-header";
import { SettingsStatCard, SettingsStatsGrid } from "@/components/settings/settings-stats";

function WebhooksStats() {
  const { data: webhooks, isLoading } = useWebhooks();
  const counts = useMemo(() => {
    const list = webhooks ?? [];
    const enabled = list.filter((h) => h.enabled).length;
    const scoped = list.filter((h) => !!h.agent_id).length;
    return { total: list.length, enabled, global: list.length - scoped, scoped };
  }, [webhooks]);
  return (
    <SettingsStatsGrid label="Webhook summary">
      <SettingsStatCard
        title="Total"
        icon={BellRing}
        value={isLoading ? "—" : String(counts.total)}
        caption={isLoading ? "Loading" : "Endpoints in one place"}
        loading={isLoading}
        delay={0}
      />
      <SettingsStatCard
        title="Enabled"
        icon={Power}
        value={isLoading ? "—" : String(counts.enabled)}
        caption={isLoading ? "Loading" : "Firing on events"}
        loading={isLoading}
        delay={0.05}
      />
      <SettingsStatCard
        title="Global"
        icon={Globe2}
        value={isLoading ? "—" : String(counts.global)}
        caption={isLoading ? "Loading" : "All-agents endpoints"}
        loading={isLoading}
        delay={0.1}
      />
      <SettingsStatCard
        title="Agent-scoped"
        icon={Plug2}
        value={isLoading ? "—" : String(counts.scoped)}
        caption={isLoading ? "Loading" : "Per-agent endpoints"}
        loading={isLoading}
        delay={0.15}
      />
    </SettingsStatsGrid>
  );
}

export function OrgWebhooks() {
  const { data: webhooks, isLoading } = useWebhooks();
  const { data: agents } = useAgents();
  const deleteWebhook = useDeleteWebhook();

  const agentNames = new Map((agents ?? []).map((agent) => [agent.agent_id, agent.agent_name]));

  return (
    <div className="space-y-6 min-w-0">
      <WebhooksStats />

      <section className="rounded-3xl border border-border bg-card p-5 md:p-6 min-w-0">
        <SectionHeader
          title="Webhooks"
          description="Every endpoint in one place. Manage per-agent webhooks from Analytics settings."
          className="mb-6"
        />

        {isLoading ? (
          <div className="h-32 rounded-3xl bg-muted/50 border border-border animate-pulse motion-reduce:animate-none" />
        ) : (webhooks ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground rounded-3xl border border-dashed border-border p-8 text-center">
            No webhooks yet. Add them from any agent&apos;s Analytics tab.
          </p>
        ) : (
          <>
            <div className="hidden sm:grid sm:grid-cols-12 gap-3 px-4 py-2 text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
              <div className="sm:col-span-6 truncate">Endpoint</div>
              <div className="sm:col-span-4 truncate">Scope · Events</div>
              <div className="sm:col-span-2 text-right truncate">Actions</div>
            </div>
            <div className="flex flex-col gap-3 min-w-0">
              {(webhooks ?? []).map((hook) => (
                <div
                  key={hook.webhook_id}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center rounded-3xl border border-border bg-muted/40 p-4 min-w-0"
                >
                  <div className="sm:col-span-6 flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                      <BellRing className="w-4 h-4 text-ember-700 dark:text-ember-300" aria-hidden="true" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-mono text-foreground truncate" title={hook.url}>{hook.url}</p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5 tabular-nums" title={`${timeAgo(hook.created_at)}${hook.enabled ? "" : " · disabled"}`}>
                        {timeAgo(hook.created_at)}{hook.enabled ? "" : " · disabled"}
                      </p>
                    </div>
                  </div>
                  <div className="sm:col-span-4 min-w-0">
                    <p className="text-xs text-muted-foreground truncate" title={`${hook.agent_id ? (agentNames.get(hook.agent_id) ?? hook.agent_id.slice(0, 8)) : "all agents"} · ${hook.events.join(" · ") || "all events"}`}>
                      {hook.agent_id ? (agentNames.get(hook.agent_id) ?? hook.agent_id.slice(0, 8)) : "all agents"}
                      {" · "}
                      {hook.events.join(" · ") || "all events"}
                    </p>
                    {hook.agent_id && (
                      <Link
                        href={`/agents/${hook.agent_id}/configure`}
                        className="text-xs text-ember-700 dark:text-ember-300 hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 rounded"
                      >
                        Open agent
                      </Link>
                    )}
                  </div>
                  <div className="sm:col-span-2 flex sm:justify-end min-w-0">
                    <button
                      onClick={() => void deleteWebhook.mutateAsync(hook.webhook_id)}
                      aria-label={`Delete webhook ${hook.url}`}
                      className="p-2 rounded-xl text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 motion-reduce:transition-none"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <p className="text-xs font-mono text-muted-foreground tabular-nums truncate" title="Adds happen from agent Analytics tabs">
        Adds happen from agent Analytics tabs · Deletes apply immediately.
      </p>
    </div>
  );
}
