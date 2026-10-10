"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  Loader2,
  Plug,
  PlugZap,
  Plus,
  Power,
  PowerOff,
  Trash2,
  X,
} from "lucide-react";
import {
  useCreateIntegration,
  useDeleteIntegration,
  useIntegrations,
  useUpdateIntegration,
} from "@/services/platform/integrations";
import type { Integration, IntegrationKind } from "@/lib/schemas/platform";
import {
  ADD_GROUPS,
  KIND_FIELDS,
  KINDS,
  TELEPHONY_KINDS,
  type FieldDef,
} from "@/lib/integrations/catalog";
import { StatusPill } from "@/components/integrations/status-pill";
import { ProviderIcon } from "@/components/integrations/provider-icon";
import { minRoleFor, useCan } from "@/lib/rbac";

/** Re-exported for existing importers (Numbers ProviderSetup). New code should import from @/lib/integrations/catalog. */
export { ADD_GROUPS, KIND_FIELDS, KINDS, TELEPHONY_KINDS };
export type { FieldDef };
import { Modal } from "@/components/common/modal";
import { Toggle } from "@/components/common/toggle";
import { fieldStyles } from "@/lib/field-styles";
import { cn } from "@/lib/utils";
import { SectionHeader } from "@/components/common/section-header";
import { SettingsStatCard, SettingsStatsGrid } from "@/components/settings/settings-stats";

function IntegrationsStats() {
  const { data: integrations, isLoading } = useIntegrations();
  const counts = useMemo(() => {
    const list = integrations ?? [];
    const enabled = list.filter((i) => i.enabled).length;
    return { configured: list.length, total: KINDS.length, enabled, disabled: list.length - enabled };
  }, [integrations]);
  return (
    <SettingsStatsGrid label="Integration summary">
      <SettingsStatCard
        title="Configured"
        icon={Plug}
        value={isLoading ? "—" : String(counts.configured)}
        caption={isLoading ? "Loading" : `of ${counts.total} providers`}
        loading={isLoading}
        delay={0}
      />
      <SettingsStatCard
        title="Providers"
        icon={PlugZap}
        value={isLoading ? "—" : String(counts.total)}
        caption={isLoading ? "Loading" : "Supported integrations"}
        loading={isLoading}
        delay={0.05}
      />
      <SettingsStatCard
        title="Enabled"
        icon={Power}
        value={isLoading ? "—" : String(counts.enabled)}
        caption={isLoading ? "Loading" : "Active in calls + flows"}
        loading={isLoading}
        delay={0.1}
      />
      <SettingsStatCard
        title="Disabled"
        icon={PowerOff}
        value={isLoading ? "—" : String(counts.disabled)}
        caption={isLoading ? "Loading" : "Skipped at runtime"}
        loading={isLoading}
        delay={0.15}
      />
    </SettingsStatsGrid>
  );
}

export function ConfigModal({
  kind,
  initial,
  pending,
  onSave,
  onClose,
}: {
  kind: IntegrationKind;
  initial: Record<string, unknown>;
  pending: boolean;
  onSave: (config: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      KIND_FIELDS[kind].fields.map((field) => {
        const stored = initial[field.key];
        // Masked secrets come back as bullets: keep them empty so blanks mean "unchanged".
        const isMasked = typeof stored === "string" && /^•+$/.test(stored);
        return [field.key, field.secret && isMasked ? "" : String(stored ?? "")];
      })
    )
  );
  // Modal already closes on Escape; move focus to the first field on open/kind change.
  const firstInputRef = useRef<HTMLInputElement | null>(null);
  const firstTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    (firstInputRef.current ?? firstTextareaRef.current)?.focus();
  }, [kind]);
  return (
    <Modal
      open
      onClose={onClose}
      label={`Configure ${KIND_FIELDS[kind].label}`}
      title={<h4 className="font-semibold text-foreground">Configure {KIND_FIELDS[kind].label}</h4>}
      className="max-w-md space-y-3"
    >
          {KIND_FIELDS[kind].fields.map((field, index) =>
            field.multiline ? (
              <label key={field.key} className="flex flex-col gap-1.5 min-w-0">
                <span className="text-xs font-medium text-foreground truncate" title={field.label}>
                  {field.label}
                </span>
                <textarea
                  ref={index === 0 ? firstTextareaRef : undefined}
                  value={values[field.key] ?? ""}
                  onChange={(event) => setValues((prev) => ({ ...prev, [field.key]: event.target.value }))}
                  placeholder={field.secret && initial[field.key] ? "•••• (unchanged)" : field.placeholder}
                  aria-label={field.label}
                  rows={3}
                  className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2.5 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ember-400/50 resize-y"
                />
              </label>
            ) : (
              <label key={field.key} className="flex flex-col gap-1.5 min-w-0">
                <span className="text-xs font-medium text-foreground truncate" title={field.label}>
                  {field.label}
                </span>
                <input
                  ref={index === 0 ? firstInputRef : undefined}
                  value={values[field.key] ?? ""}
                  onChange={(event) => setValues((prev) => ({ ...prev, [field.key]: event.target.value }))}
                  type={field.secret ? "password" : "text"}
                  placeholder={field.secret && initial[field.key] ? "•••• (unchanged)" : field.placeholder}
                  aria-label={field.label}
                  autoComplete="off"
                  className={cn(fieldStyles.fieldSm, "font-mono text-xs")}
                />
              </label>
            )
          )}
          <button
            onClick={() => {
              // Blank secrets mean "keep stored value" (backend merges).
              const config: Record<string, unknown> = {};
              KIND_FIELDS[kind].fields.forEach((field) => {
                const value = (values[field.key] ?? "").trim();
                if (value) config[field.key] = value;
                else if (!field.secret && initial[field.key] !== undefined) config[field.key] = "";
              });
              onSave(config);
            }}
            disabled={pending}
            className="w-full h-11 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
          >
            {pending && <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
            Save configuration
          </button>
          <p className="text-[11px] text-muted-foreground">
            Secrets are masked in API responses. Dialing through providers is stubbed in simulation mode.
          </p>
    </Modal>
  );
}

function IntegrationCard({ integration, canManage = true }: { integration: Integration; canManage?: boolean }) {
  const updateIntegration = useUpdateIntegration();
  const deleteIntegration = useDeleteIntegration();
  const [editing, setEditing] = useState(false);
  const [naming, setNaming] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [name, setName] = useState(integration.name);

  const preview = useMemo(
    () =>
      Object.entries(integration.config)
        .filter(([, value]) => typeof value === "string" && !/^•+$/.test(value) && value)
        .slice(0, 2),
    [integration.config]
  );
  const cardError = updateIntegration.isError || deleteIntegration.isError;

  return (
    <div className="p-5 md:p-6 bg-card border border-border rounded-3xl min-w-0">
      <div className="flex items-start justify-between gap-3 mb-3 min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <ProviderIcon kind={integration.kind} />
          <div className="min-w-0">
            <h4 className="font-medium text-foreground tracking-tight truncate" title={integration.name}>{integration.name}</h4>
            <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground truncate" title={KIND_FIELDS[integration.kind].label}>
              {KIND_FIELDS[integration.kind].label}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusPill
            status={integration.enabled ? "on" : "off"}
            title={integration.enabled ? "Connected and enabled — used in calls + flows" : "Connected but off — skipped at runtime"}
          />
          <Toggle
            checked={integration.enabled}
            disabled={!canManage}
            onChange={(value) =>
              void updateIntegration.mutateAsync({ id: integration.integration_id, enabled: value })
            }
            label={`Enable ${integration.name}`}
          />
        </div>
      </div>

      {preview.length > 0 && (
        <div className="mb-3 space-y-1 min-w-0">
          {preview.map(([key, value]) => (
            <p key={key} className="text-xs font-mono text-muted-foreground truncate tabular-nums" title={`${key}: ${String(value)}`}>
              {key}: <span className="text-foreground">{String(value)}</span>
            </p>
          ))}
        </div>
      )}
      {!integration.enabled && (
        <p className="mb-3 text-xs text-muted-foreground truncate" title="Disabled — calls and workflows skip this integration.">
          Disabled — calls and workflows skip this integration.
        </p>
      )}
      {cardError && (
        <p className="flex items-center gap-2 text-xs text-destructive mb-3 min-w-0">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate" title="Could not save. Is the backend running?">
            Could not save. Is the backend running?
          </span>
        </p>
      )}

      <div className="flex flex-wrap gap-2 min-w-0">
        {naming ? (
          <div className="flex gap-2 flex-1 min-w-0">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-label="Integration name"
              className={cn(fieldStyles.fieldSm, "h-9 min-w-0")}
            />
            <button
              onClick={() => {
                if (name.trim()) void updateIntegration.mutateAsync({ id: integration.integration_id, name: name.trim() });
                setNaming(false);
              }}
              className="h-9 px-3 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
            >
              Save
            </button>
          </div>
        ) : confirmingDelete ? (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <p className="flex-1 min-w-0 text-xs text-muted-foreground truncate" title={`Delete ${integration.name}?`}>
              Delete {integration.name}?
            </p>
            <button
              onClick={() => {
                void deleteIntegration
                  .mutateAsync(integration.integration_id)
                  .catch(() => undefined);
                setConfirmingDelete(false);
              }}
              disabled={deleteIntegration.isPending}
              aria-label={`Confirm delete ${integration.name}`}
              className="flex items-center gap-1 px-2.5 h-9 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors disabled:opacity-50 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 motion-reduce:transition-none"
            >
              {deleteIntegration.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              ) : (
                <Check className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              Delete
            </button>
            <button
              onClick={() => setConfirmingDelete(false)}
              aria-label="Cancel delete"
              className="flex items-center justify-center w-9 h-9 rounded-xl bg-muted text-muted-foreground border border-border transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        ) : canManage ? (
          <>
            <button
              onClick={() => setEditing(true)}
              className="flex-1 min-w-[100px] h-9 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none truncate px-2"
            >
              Configure
            </button>
            <button
              onClick={() => {
                setName(integration.name);
                setNaming(true);
              }}
              className="h-9 px-3 rounded-xl border border-border text-xs text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none shrink-0"
            >
              Rename
            </button>
            <button
              onClick={() => setConfirmingDelete(true)}
              aria-label={`Delete ${integration.name}`}
              title={`Delete ${integration.name}`}
              className="h-9 w-9 flex items-center justify-center rounded-xl text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 motion-reduce:transition-none"
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
            </button>
          </>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            Read-only — requires {minRoleFor("keys.manage")} role.
          </p>
        )}
      </div>

      {editing && (
          <ConfigModal
            kind={integration.kind}
            initial={integration.config as Record<string, unknown>}
            pending={updateIntegration.isPending}
            onSave={(config) => {
              void updateIntegration
                .mutateAsync({ id: integration.integration_id, config })
                .then(() => setEditing(false))
                .catch(() => undefined);
            }}
            onClose={() => setEditing(false)}
          />
        )}
    </div>
  );
}

export function OrgIntegrations({
  kinds = KINDS,
  showStats = true,
  initialAddingKind = null,
}: {
  kinds?: readonly IntegrationKind[];
  showStats?: boolean;
  initialAddingKind?: IntegrationKind | null;
} = {}) {
  const { data: integrations, isLoading } = useIntegrations();
  const createIntegration = useCreateIntegration();
  const canManage = useCan("keys.manage");
  // Gated, not just seeded: `initialAddingKind` arrives from the URL
  // (`?connect=twilio`), so a viewer landing on it would otherwise get a fully
  // editable modal with a Save button that 403s.
  const [addingKind, setAddingKind] = useState<IntegrationKind | null>(
    canManage ? initialAddingKind : null
  );
  const [error, setError] = useState<string | null>(null);

  const configuredKinds = useMemo(
    () => new Set((integrations ?? []).map((item) => item.kind)),
    [integrations]
  );
  const visibleKinds = useMemo(() => kinds.filter((k) => KINDS.includes(k)), [kinds]);
  const missing = visibleKinds.filter((kind) => !configuredKinds.has(kind));
  const visibleIntegrations = useMemo(
    () => (integrations ?? []).filter((item) => visibleKinds.includes(item.kind)),
    [integrations, visibleKinds]
  );
  const showTalkoNote = visibleKinds.includes("talko");

  return (
    <div className="space-y-6 min-w-0">
      {showStats && <IntegrationsStats />}

      <section className="rounded-3xl border border-border bg-card p-5 md:p-6 min-w-0">
        <SectionHeader
          title="Connected"
          description={
            canManage
              ? "Configured integrations. Toggles control runtime use."
              : `Configured integrations. Read-only — requires ${minRoleFor("keys.manage")} role.`
          }
          className="mb-6"
        />

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-44 rounded-3xl bg-muted/50 border border-border animate-pulse motion-reduce:animate-none" />
            ))}
          </div>
        ) : visibleIntegrations.length === 0 ? (
          <p className="text-sm text-muted-foreground rounded-3xl border border-dashed border-border p-10 text-center">
            No integrations connected yet. Pick a provider below to get started.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 min-w-0">
            {visibleIntegrations.map((integration) => (
              <IntegrationCard key={integration.integration_id} integration={integration} canManage={canManage} />
            ))}
          </div>
        )}
      </section>

      {showTalkoNote && (
        <p className="text-[11px] text-muted-foreground rounded-2xl border border-border bg-muted/40 px-4 py-3">
          Talko note: the generic Talko trunk form below is legacy. For real dialing with auto-fetched
          DIDs, use the <span className="font-medium text-foreground">Talko partners</span> section
          (Telephony tab). New setups should prefer partners.
        </p>
      )}

      <section className="rounded-3xl border border-border bg-card p-5 md:p-6 min-w-0">
        <SectionHeader
          title="Add integration"
          description={
            !canManage
              ? `Read-only — requires ${minRoleFor("keys.manage")} role.`
              : isLoading
                ? "Loading provider status."
                : missing.length === 0
                  ? "Every supported provider is connected."
                  : `${missing.length} of ${visibleKinds.length} providers still available.`
          }
          className="mb-6"
        />

        {!canManage ? (
          <p className="text-sm text-muted-foreground rounded-3xl border border-dashed border-border p-10 text-center">
            You can view integrations but not connect new ones.
          </p>
        ) : isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0, 1].map((i) => (
              <div key={i} className="h-28 rounded-3xl bg-muted/50 border border-border animate-pulse motion-reduce:animate-none" />
            ))}
          </div>
        ) : missing.length === 0 ? (
          <p className="text-sm text-muted-foreground rounded-3xl border border-dashed border-border p-10 text-center">
            All providers connected.
          </p>
        ) : (
          <div className="space-y-6 min-w-0">
            {ADD_GROUPS.map((group) => {
              const inScope = group.kinds.filter((kind) => visibleKinds.includes(kind));
              const available = inScope.filter((kind) => !configuredKinds.has(kind));
              const connected = inScope.length - available.length;
              if (inScope.length === 0 || available.length === 0) return null;
              return (
                <div key={group.label} className="space-y-3 min-w-0">
                  <p
                    className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground truncate tabular-nums"
                    title={`${group.label} · ${connected} of ${inScope.length} connected`}
                  >
                    {group.label} · {connected} of {inScope.length} connected
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 min-w-0">
                    {available.map((kind) => (
                      <button
                        key={kind}
                        onClick={() => {
                          setError(null);
                          setAddingKind(kind);
                        }}
                        className="h-12 rounded-2xl border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors truncate px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none flex items-center justify-center gap-1.5 min-w-0"
                        title={`Connect ${KIND_FIELDS[kind].label}`}
                      >
                        <Plus className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span className="truncate">{KIND_FIELDS[kind].label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {error && (
          <p className="flex items-center gap-2 text-xs text-destructive mt-4 min-w-0">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate" title={error}>{error}</span>
          </p>
        )}
      </section>

      {addingKind && (
          <ConfigModal
            kind={addingKind}
            initial={{}}
            pending={createIntegration.isPending}
            onSave={(config) => {
              void createIntegration
                .mutateAsync({ kind: addingKind, name: KIND_FIELDS[addingKind].label, config })
                .then(() => setAddingKind(null))
                .catch(() => setError("Could not save. Is the backend running?"));
            }}
            onClose={() => setAddingKind(null)}
          />
        )}

      <p className="text-xs font-mono text-muted-foreground tabular-nums truncate" title="Disabled integrations are skipped at runtime">
        Disabled integrations are skipped at runtime · Secrets stay masked.
      </p>
    </div>
  );
}
