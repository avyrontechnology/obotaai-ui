"use client";

import { useMemo, useState } from "react";
import { Loader2, Plug, Trash2 } from "lucide-react";
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

interface FieldDef {
  key: string;
  label: string;
  secret?: boolean;
  multiline?: boolean;
  placeholder?: string;
}

const KIND_FIELDS: Record<IntegrationKind, { label: string; fields: FieldDef[] }> = {
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


function ConfigModal({
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
  return (
    <Modal
      open
      onClose={onClose}
      label={`Configure ${KIND_FIELDS[kind].label}`}
      title={<h4 className="font-semibold text-foreground">Configure {KIND_FIELDS[kind].label}</h4>}
      className="max-w-md space-y-3"
    >
          {KIND_FIELDS[kind].fields.map((field) =>
            field.multiline ? (
              <textarea
                key={field.key}
                value={values[field.key] ?? ""}
                onChange={(event) => setValues((prev) => ({ ...prev, [field.key]: event.target.value }))}
                placeholder={field.secret && initial[field.key] ? "•••• (unchanged)" : field.placeholder}
                aria-label={field.label}
                rows={3}
                className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2.5 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ember-400/50 resize-y"
              />
            ) : (
              <label key={field.key} className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-foreground">{field.label}</span>
                <input
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
            className="w-full h-11 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {pending && <Loader2 className="w-4 h-4 animate-spin" />}
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
  const [name, setName] = useState(integration.name);

  const preview = useMemo(
    () =>
      Object.entries(integration.config)
        .filter(([, value]) => typeof value === "string" && !/^•+$/.test(value) && value)
        .slice(0, 2),
    [integration.config]
  );

  return (
    <div className="p-5 bg-card border border-border rounded-3xl">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <Plug className="w-4 h-4 text-ember-700 dark:text-ember-300" />
          </div>
          <div className="min-w-0">
            <h4 className="font-medium text-foreground tracking-tight truncate">{integration.name}</h4>
            <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
              {KIND_FIELDS[integration.kind].label}
            </p>
          </div>
        </div>
        <Toggle
          checked={integration.enabled}
          onChange={(value) =>
            void updateIntegration.mutateAsync({ id: integration.integration_id, enabled: value })
          }
          label={`Enable ${integration.name}`}
        />
      </div>

      {preview.length > 0 && (
        <div className="mb-3 space-y-1">
          {preview.map(([key, value]) => (
            <p key={key} className="text-xs font-mono text-muted-foreground truncate">
              {key}: <span className="text-foreground">{String(value)}</span>
            </p>
          ))}
        </div>
      )}
      {!integration.enabled && (
        <p className="mb-3 text-xs text-muted-foreground">Disabled — calls and workflows skip this integration.</p>
      )}

      <div className="flex gap-2">
        {naming ? (
          <div className="flex gap-2 flex-1">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-label="Integration name"
              className={cn(fieldStyles.fieldSm, "h-9")}
            />
            <button
              onClick={() => {
                if (name.trim()) void updateIntegration.mutateAsync({ id: integration.integration_id, name: name.trim() });
                setNaming(false);
              }}
              className="h-9 px-3 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shrink-0"
            >
              Save
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={() => setEditing(true)}
              className="flex-1 h-9 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              Configure
            </button>
            <button
              onClick={() => {
                setName(integration.name);
                setNaming(true);
              }}
              className="h-9 px-3 rounded-xl border border-border text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Rename
            </button>
            <button
              onClick={() => void deleteIntegration.mutateAsync(integration.integration_id)}
              aria-label={`Delete ${integration.name}`}
              className="h-9 w-9 flex items-center justify-center rounded-xl text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
            >
              <Trash2 className="w-4 h-4" />
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

  const missing = KINDS.filter((kind) => !(integrations ?? []).some((item) => item.kind === kind));

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-medium text-foreground">Integrations</h3>
        <p className="text-sm text-muted-foreground mt-1">Connect telephony, calendars and workflow tools.</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[0, 1].map((i) => (
            <div key={i} className="h-44 rounded-3xl bg-card border border-border animate-pulse" />
          ))}
        </div>
      ) : (integrations ?? []).length === 0 && missing.length === 0 ? null : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(integrations ?? []).map((integration) => (
            <IntegrationCard key={integration.integration_id} integration={integration} />
          ))}
        </div>
      )}

      <div className="space-y-3">
        <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Add integration</p>
        {missing.length === 0 ? (
          <p className="text-sm text-muted-foreground">All providers connected.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {missing.map((kind) => (
              <button
                key={kind}
                onClick={() => {
                  setError(null);
                  setAddingKind(kind);
                }}
                className="h-12 rounded-2xl border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                + {KIND_FIELDS[kind].label}
              </button>
            ))}
          </div>
        )}
        {error && <p className="text-xs text-red-700 dark:text-red-400">{error}</p>}
      </div>

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
    </div>
  );
}
