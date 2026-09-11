"use client";

import { useMemo, useState } from "react";
import { Check, PlugZap, Plus } from "lucide-react";
import {
  useCreateIntegration,
  useIntegrations,
  useUpdateIntegration,
} from "@/services/platform/integrations";
import { usePhoneNumbers } from "@/services/platform/phone-numbers";
import {
  ConfigModal,
  KIND_FIELDS,
  TELEPHONY_KINDS,
} from "@/components/settings/org-integrations";
import { Toggle } from "@/components/common/toggle";
import { SectionHeader } from "@/components/common/section-header";
import { cn } from "@/lib/utils";
import type { IntegrationKind } from "@/lib/schemas/platform";

/**
 * Telephony provider setup for the Numbers section. Numbers can only be
 * added for a connected provider — credentials live here, inventory below.
 */
export function ProviderSetup() {
  const { data: integrations, isLoading } = useIntegrations();
  const { data: numbers } = usePhoneNumbers();
  const createIntegration = useCreateIntegration();
  const updateIntegration = useUpdateIntegration();
  const [configuring, setConfiguring] = useState<IntegrationKind | null>(null);
  const [error, setError] = useState<string | null>(null);

  const byKind = useMemo(
    () => new Map((integrations ?? []).map((item) => [item.kind, item])),
    [integrations]
  );
  const numbersByProvider = useMemo(() => {
    const counts = new Map<string, number>();
    (numbers ?? []).forEach((item) => counts.set(item.provider, (counts.get(item.provider) ?? 0) + 1));
    return counts;
  }, [numbers]);

  const configuringEntry = configuring ? byKind.get(configuring) : undefined;

  return (
    <section className="rounded-3xl border border-border bg-card p-5 md:p-6 min-w-0">
      <SectionHeader
        title="Providers"
        description="Connect a telephony provider before adding its numbers. Secrets stay masked."
        className="mb-6"
      />

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-muted/50 border border-border animate-pulse motion-reduce:animate-none" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 min-w-0">
          {TELEPHONY_KINDS.map((kind) => {
            const entry = byKind.get(kind);
            const connected = !!entry;
            const enabled = entry?.enabled ?? false;
            const count = numbersByProvider.get(kind) ?? 0;
            return (
              <div
                key={kind}
                className="rounded-2xl border border-border bg-muted/40 p-4 min-w-0 flex flex-col gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <PlugZap className="w-4 h-4 text-ember-700 dark:text-ember-300" aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate" title={KIND_FIELDS[kind].label}>
                      {KIND_FIELDS[kind].label}
                    </p>
                    <p className="text-[11px] font-mono text-muted-foreground truncate">
                      {connected
                        ? `${count} number${count === 1 ? "" : "s"}`
                        : "Not connected"}
                    </p>
                  </div>
                  {connected ? (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider border shrink-0",
                        enabled
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                          : "bg-muted text-muted-foreground border-border"
                      )}
                    >
                      {enabled && <Check className="w-3 h-3" aria-hidden="true" />}
                      {enabled ? "On" : "Off"}
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-2 min-w-0">
                  {entry && (
                    <Toggle
                      checked={enabled}
                      onChange={(value) =>
                        void updateIntegration.mutateAsync({ id: entry.integration_id, enabled: value })
                      }
                      label={`Enable ${KIND_FIELDS[kind].label}`}
                    />
                  )}
                  <button
                    onClick={() => {
                      setError(null);
                      setConfiguring(kind);
                    }}
                    className="flex-1 min-w-0 h-9 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors flex items-center justify-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
                  >
                    {!connected && <Plus className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
                    <span className="truncate">{connected ? "Configure" : `Connect ${KIND_FIELDS[kind].label}`}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {error && <p className="text-xs text-destructive truncate mt-3" title={error}>{error}</p>}

      {configuring && (
        <ConfigModal
          kind={configuring}
          initial={(configuringEntry?.config as Record<string, unknown> | undefined) ?? {}}
          pending={createIntegration.isPending || updateIntegration.isPending}
          onSave={(config) => {
            if (configuringEntry) {
              void updateIntegration
                .mutateAsync({ id: configuringEntry.integration_id, config })
                .then(() => setConfiguring(null))
                .catch(() => setError("Could not save. Is the backend running?"));
            } else {
              void createIntegration
                .mutateAsync({ kind: configuring, name: KIND_FIELDS[configuring].label, config })
                .then(() => setConfiguring(null))
                .catch(() => setError("Could not save. Is the backend running?"));
            }
          }}
          onClose={() => setConfiguring(null)}
        />
      )}
    </section>
  );
}
