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
import { Modal } from "@/components/common/modal";
import { Toggle } from "@/components/common/toggle";
import { fieldStyles } from "@/lib/field-styles";
import { cn } from "@/lib/utils";
import { SectionHeader } from "@/components/common/section-header";
import { SettingsStatCard, SettingsStatsGrid } from "@/components/settings/settings-stats";

interface FieldDef {
  key: string;
  label: string;
  secret?: boolean;
  multiline?: boolean;
  placeholder?: string;
}

export const KIND_FIELDS: Record<IntegrationKind, { label: string; fields: FieldDef[] }> = {
  twilio: {
    label: "Twilio",
    fields: [
      { key: "account_sid", label: "Account SID", placeholder: "AC…" },
      { key: "auth_token", label: "Auth Token", secret: true },
      { key: "phone_number", label: "Phone Number", placeholder: "+1…" },
    ],
  },
  plivo: {
    label: "Plivo",
    fields: [
      { key: "auth_id", label: "Auth ID" },
      { key: "auth_token", label: "Auth Token", secret: true },
    ],
  },
  exotel: {
    label: "Exotel",
    fields: [
      { key: "sid", label: "SID" },
      { key: "api_key", label: "API Key", secret: true },
      { key: "api_token", label: "API Token", secret: true },
    ],
  },
  vobiz: {
    label: "Vobiz",
    fields: [{ key: "api_key", label: "API Key", secret: true }],
  },
  talko: {
    label: "Talko (Tata Tele trunk)",
    fields: [
      { key: "trunk_url", label: "Trunk URL", placeholder: "http://talko-app:8004" },
      { key: "caller_did", label: "Default caller DID", placeholder: "9179…" },
      { key: "api_key", label: "Talko API Key (default)", secret: true, placeholder: "tkp_live_…" },
    ],
  },
  calcom: {
    label: "Cal.com",
    fields: [
      { key: "api_key", label: "API Key", secret: true },
      { key: "event_type_id", label: "Event Type ID" },
    ],
  },
  n8n: {
    label: "n8n",
    fields: [
      { key: "base_url", label: "Base URL", placeholder: "https://…" },
      { key: "api_key", label: "API Key", secret: true },
    ],
  },
  zapier: {
    label: "Zapier",
    fields: [{ key: "webhook_url", label: "Webhook URL", placeholder: "https://hooks.zapier.com/…" }],
  },
  sheets: {
    label: "Google Sheets",
    fields: [
      { key: "sheet_url", label: "Sheet URL" },
      { key: "service_account_json", label: "Service Account JSON", secret: true, multiline: true },
    ],
  },
  sip: {
    label: "SIP Trunk",
    fields: [
      { key: "host", label: "Host" },
      { key: "username", label: "Username" },
      { key: "password", label: "Password", secret: true },
    ],
  },
  truecaller: {
    label: "Truecaller",
    fields: [
      { key: "api_key", label: "API Key", secret: true },
      { key: "business_name", label: "Business Name" },
    ],
  },
};

const KINDS = Object.keys(KIND_FIELDS) as IntegrationKind[];

/** Telephony providers that can carry numbers. Reused by the Numbers section. */
export const TELEPHONY_KINDS: IntegrationKind[] = ["twilio", "plivo", "exotel", "vobiz", "talko", "sip"];

/** Add-integration groupings for the picker. Counts stay honest via useIntegrations(). */
const ADD_GROUPS: { label: string; kinds: IntegrationKind[] }[] = [
  { label: "Telephony", kinds: ["twilio", "plivo", "exotel", "vobiz", "talko", "sip"] },
  { label: "Productivity", kinds: ["calcom", "sheets", "n8n", "zapier"] },
  { label: "Other", kinds: ["truecaller"] },
];

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

function IntegrationCard({ integration }: { integration: Integration }) {
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
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <Plug className="w-4 h-4 text-ember-700 dark:text-ember-300" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h4 className="font-medium text-foreground tracking-tight truncate" title={integration.name}>{integration.name}</h4>
            <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground truncate" title={KIND_FIELDS[integration.kind].label}>
              {KIND_FIELDS[integration.kind].label}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider border",
              integration.enabled
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                : "bg-muted text-muted-foreground border-border"
            )}
            title={integration.enabled ? "Connected and enabled — used in calls + flows" : "Connected but off — skipped at runtime"}
          >
            {integration.enabled && <Check className="w-3 h-3" aria-hidden="true" />}
            {integration.enabled ? "On" : "Off"}
          </span>
          <Toggle
            checked={integration.enabled}
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
        ) : (
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

export function OrgIntegrations() {
  const { data: integrations, isLoading } = useIntegrations();
  const createIntegration = useCreateIntegration();
  const [addingKind, setAddingKind] = useState<IntegrationKind | null>(null);
  const [error, setError] = useState<string | null>(null);

  const configuredKinds = useMemo(
    () => new Set((integrations ?? []).map((item) => item.kind)),
    [integrations]
  );
  const missing = KINDS.filter((kind) => !configuredKinds.has(kind));

  return (
    <div className="space-y-6 min-w-0">
      <IntegrationsStats />

      <section className="rounded-3xl border border-border bg-card p-5 md:p-6 min-w-0">
        <SectionHeader
          title="Connected"
          description="Configured integrations. Toggles control runtime use."
          className="mb-6"
        />

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-44 rounded-3xl bg-muted/50 border border-border animate-pulse motion-reduce:animate-none" />
            ))}
          </div>
        ) : (integrations ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground rounded-3xl border border-dashed border-border p-10 text-center">
            No integrations connected yet. Pick a provider below to get started.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 min-w-0">
            {(integrations ?? []).map((integration) => (
              <IntegrationCard key={integration.integration_id} integration={integration} />
            ))}
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-border bg-card p-5 md:p-6 min-w-0">
        <SectionHeader
          title="Add integration"
          description={
            isLoading
              ? "Loading provider status."
              : missing.length === 0
                ? "Every supported provider is connected."
                : `${missing.length} of ${KINDS.length} providers still available.`
          }
          className="mb-6"
        />

        {isLoading ? (
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
              const available = group.kinds.filter((kind) => !configuredKinds.has(kind));
              const connected = group.kinds.length - available.length;
              if (available.length === 0) return null;
              return (
                <div key={group.label} className="space-y-3 min-w-0">
                  <p
                    className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground truncate tabular-nums"
                    title={`${group.label} · ${connected} of ${group.kinds.length} connected`}
                  >
                    {group.label} · {connected} of {group.kinds.length} connected
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
