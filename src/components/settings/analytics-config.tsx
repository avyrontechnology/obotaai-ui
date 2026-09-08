"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { BellRing, Loader2, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { FormSection } from "./form-controls";
import { useCreateWebhook, useDeleteWebhook, useWebhooks } from "@/services/platform/webhooks";
import { fieldStyles } from "@/lib/field-styles";
import type { Webhook } from "@/lib/schemas/platform";
import { cn } from "@/lib/utils";

const EVENT_OPTIONS = ["call.started", "call.completed", "call.failed", "batch.completed"];


export function AnalyticsConfigForm({ agentId }: { agentId: string }) {
  const { data: webhooks, isLoading } = useWebhooks();
  const createWebhook = useCreateWebhook();
  const deleteWebhook = useDeleteWebhook();

  const [showForm, setShowForm] = useState(false);
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>(["call.completed"]);
  const [formError, setFormError] = useState<string | null>(null);

  const scoped = (webhooks ?? []).filter(
    (hook: Webhook) => !hook.agent_id || hook.agent_id === agentId
  );

  const toggleEvent = (event: string) =>
    setEvents((prev) => (prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]));

  const handleCreate = async () => {
    setFormError(null);
    if (!url.trim()) {
      setFormError("Enter a webhook URL.");
      return;
    }
    try {
      new URL(url.trim());
    } catch {
      setFormError("That URL does not look valid.");
      return;
    }
    try {
      await createWebhook.mutateAsync({ agent_id: agentId, url: url.trim(), events });
      setUrl("");
      setEvents(["call.completed"]);
      setShowForm(false);
    } catch {
      setFormError("Could not create the webhook. Is the backend running?");
    }
  };

  return (
    <div className="space-y-10">
      <FormSection
        title="Post-Call Webhooks"
        description="Push call events to your CRM or workflows the moment they happen."
      >
        <div className="col-span-1 md:col-span-2 space-y-3">
          {isLoading ? (
            <div className="h-20 rounded-2xl bg-muted/50 animate-pulse" />
          ) : scoped.length === 0 ? (
            <p className="text-sm text-muted-foreground rounded-2xl border border-dashed border-border p-6 text-center">
              No webhooks for this agent yet.
            </p>
          ) : (
            scoped.map((hook) => (
              <div
                key={hook.webhook_id}
                className="flex items-center gap-3 rounded-2xl border border-border bg-muted/40 p-4"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <BellRing className="w-4 h-4 text-ember-700 dark:text-ember-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono text-foreground truncate">{hook.url}</p>
                  <p className="text-xs text-muted-foreground truncate">{hook.events.join(" · ") || "all events"}</p>
                </div>
                <button
                  onClick={() => void deleteWebhook.mutateAsync(hook.webhook_id)}
                  aria-label={`Delete webhook ${hook.url}`}
                  className="p-2 rounded-xl text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}

          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="w-full h-12 rounded-2xl border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add webhook
            </button>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-border bg-card p-4 space-y-3"
            >
              <input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://your-crm.example.com/hooks/calls"
                aria-label="Webhook URL"
                className={cn(fieldStyles.field, "font-mono text-xs")}
              />
              <div className="flex flex-wrap gap-2">
                {EVENT_OPTIONS.map((event) => (
                  <button
                    key={event}
                    onClick={() => toggleEvent(event)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-mono border transition-colors",
                      events.includes(event)
                        ? "border-primary/40 bg-primary/10 text-foreground"
                        : "border-border text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {event}
                  </button>
                ))}
              </div>
              {formError && <p className="text-xs text-red-700 dark:text-red-400">{formError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={() => void handleCreate()}
                  disabled={createWebhook.isPending}
                  className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {createWebhook.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create webhook
                </button>
                <button
                  onClick={() => {
                    setShowForm(false);
                    setFormError(null);
                  }}
                  className="h-10 px-4 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </FormSection>

      <FormSection
        title="Call Data"
        description="Summaries, transcripts and extractions land on every execution record."
      >
        <div className="col-span-1 md:col-span-2">
          <Link
            href={`/calls?agent=${agentId}`}
            className="flex items-center justify-center gap-2 h-12 rounded-2xl bg-muted/50 border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            Open Call History for this agent
          </Link>
        </div>
      </FormSection>
    </div>
  );
}
