"use client";

import { BellRing, Trash2 } from "lucide-react";
import Link from "next/link";
import { useAgents } from "@/services/api";
import { useDeleteWebhook, useWebhooks } from "@/services/platform/webhooks";
import { timeAgo } from "@/lib/format";

export function OrgWebhooks() {
  const { data: webhooks, isLoading } = useWebhooks();
  const { data: agents } = useAgents();
  const deleteWebhook = useDeleteWebhook();

  const agentNames = new Map((agents ?? []).map((agent) => [agent.agent_id, agent.agent_name]));

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-medium text-foreground">Webhooks</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Every endpoint in one place. Manage per-agent webhooks from Analytics settings.
        </p>
      </div>

      {isLoading ? (
        <div className="h-32 rounded-3xl bg-card border border-border animate-pulse" />
      ) : (webhooks ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground rounded-3xl border border-dashed border-border p-8 text-center">
          No webhooks yet. Add them from any agent&apos;s Analytics tab.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {(webhooks ?? []).map((hook) => (
            <div
              key={hook.webhook_id}
              className="flex items-center gap-3 rounded-3xl border border-border bg-muted/40 p-4"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <BellRing className="w-4 h-4 text-ember-700 dark:text-ember-300" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-mono text-foreground truncate">{hook.url}</p>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {hook.agent_id ? (agentNames.get(hook.agent_id) ?? hook.agent_id.slice(0, 8)) : "all agents"}
                  {" · "}
                  {hook.events.join(" · ") || "all events"}
                  {" · "}
                  {timeAgo(hook.created_at)}
                </p>
              </div>
              {hook.agent_id && (
                <Link
                  href={`/agents/${hook.agent_id}/configure`}
                  className="text-xs text-ember-700 dark:text-ember-300 hover:underline underline-offset-4 shrink-0"
                >
                  Open agent
                </Link>
              )}
              <button
                onClick={() => void deleteWebhook.mutateAsync(hook.webhook_id)}
                aria-label={`Delete webhook ${hook.url}`}
                className="p-2 rounded-xl text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
