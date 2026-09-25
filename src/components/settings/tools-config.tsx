"use client";

import { useMemo, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { Braces, Loader2, Lock, Plus, Trash2, Webhook } from "lucide-react";
import { FormSection } from "./form-controls";
import { AgentSaveBanner, CatalogProblems } from "./catalog-fields";
import {
  useCreateTenantTool,
  useDeleteTenantTool,
  usePickerTools,
  useTools,
  useUpdateTenantTool,
  type AttachedTool,
} from "@/services/platform/tools";
import { queryKeys, usePatchAgent, type Agent } from "@/services/api";
import { ApiError } from "@/lib/api-client";
import type { AgentTool } from "@/lib/schemas/platform";
import type { ApiToolsConfig } from "@/lib/schemas/agent";
import { buildApiToolsPayload } from "@/services/api-transforms";
import { fieldStyles } from "@/lib/field-styles";
import { cn } from "@/lib/utils";

function readAttachments(value: ApiToolsConfig | undefined): Required<ApiToolsConfig> {
  return {
    tool_refs: [...(value?.tool_refs ?? [])],
    webhooks: Object.fromEntries(
      Object.entries(value?.webhooks ?? {}).map(([name, attach]) => [
        name,
        { ref: attach.ref, ...(attach.param !== undefined ? { param: attach.param } : {}) },
      ])
    ),
    embedded_tools: [...(value?.embedded_tools ?? [])],
    embedded_params: { ...(value?.embedded_params ?? {}) },
  };
}

const KIND_LABEL: Record<string, string> = {
  function: "Function",
  webhook: "Webhook",
  internal: "Internal",
  custom: "Custom",
  unknown: "Unknown",
};

function ToolRow({
  title,
  subtitle,
  badges,
  action,
}: {
  title: string;
  subtitle: string;
  badges: string[];
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-muted/40 p-3">
      <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
        <Braces className="w-4 h-4 text-ember-700 dark:text-ember-300" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{title}</p>
        <p className="text-xs font-mono text-muted-foreground truncate">{subtitle}</p>
      </div>
      {badges.map((badge) => (
        <span
          key={badge}
          className="px-2 py-0.5 rounded-full bg-muted text-[10px] font-mono uppercase tracking-widest text-muted-foreground shrink-0"
        >
          {badge}
        </span>
      ))}
      {action}
    </div>
  );
}

function AttachedSection({
  attached,
  refs,
  webhooks,
  onDetach,
  onRemoveWebhook,
  pending,
}: {
  attached: AttachedTool[];
  refs: string[];
  webhooks: Record<string, { ref: string; param?: unknown }>;
  onDetach: (ref: string) => void;
  onRemoveWebhook: (name: string) => void;
  pending: boolean;
}) {
  const webhookNames = Object.keys(webhooks);
  if (attached.length === 0 && webhookNames.length === 0) {
    return (
      <p className="text-sm text-muted-foreground rounded-2xl border border-dashed border-border p-5 text-center">
        No tools attached. Pick shared tools below — attachments resolve at save time.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {attached.map((tool) => (
        <ToolRow
          key={tool.ref ?? `embedded:${tool.name}`}
          title={tool.name}
          subtitle={`${tool.kind}${tool.missing ? " · id not visible" : ""}`}
          badges={[
            ...(tool.missing ? ["missing"] : []),
            ...(tool.deprecated ? ["deprecated"] : []),
            ...(tool.embedded ? ["embedded"] : []),
          ]}
          action={
            tool.ref && refs.includes(tool.ref) ? (
              <button
                onClick={() => onDetach(tool.ref as string)}
                disabled={pending}
                aria-label={`Detach ${tool.name}`}
                className="p-2 rounded-xl text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            ) : undefined
          }
        />
      ))}
      {webhookNames.map((name) => (
        <ToolRow
          key={`webhook:${name}`}
          title={name}
          subtitle={`webhook · ${webhooks[name].ref}`}
          badges={["webhook"]}
          action={
            <button
              onClick={() => onRemoveWebhook(name)}
              disabled={pending}
              aria-label={`Remove webhook ${name}`}
              className="p-2 rounded-xl text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          }
        />
      ))}
    </div>
  );
}

function PickerBrowser({
  attachedRefs,
  onAttach,
  pending,
}: {
  attachedRefs: string[];
  onAttach: (row: AgentTool) => void;
  pending: boolean;
}) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<string>("");
  const browser = usePickerTools(kind || undefined);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (browser.data ?? []).filter(
      (row) => !q || row.name.toLowerCase().includes(q) || row.description.toLowerCase().includes(q)
    );
  }, [browser.data, query]);

  if (browser.isError) {
    const missing =
      browser.error instanceof ApiError && browser.error.status === 404;
    return (
      <p className="text-sm text-muted-foreground rounded-2xl border border-dashed border-border p-5 text-center">
        {missing
          ? "Tool registry unavailable on this backend — attach via the agent save once upgraded."
          : `Could not load the registry: ${
              browser.error instanceof Error ? browser.error.message : "unknown error"
            }`}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search tools…"
          aria-label="Search registry tools"
          className={cn(fieldStyles.fieldSm, "min-w-0")}
        />
        <select
          value={kind}
          onChange={(event) => setKind(event.target.value)}
          aria-label="Filter by tool kind"
          className={fieldStyles.fieldSm}
        >
          <option value="">All kinds</option>
          <option value="function">Function</option>
          <option value="webhook">Webhook</option>
          <option value="internal">Internal</option>
        </select>
      </div>
      {browser.isLoading ? (
        <div className="h-16 rounded-2xl bg-muted/50 animate-pulse" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground rounded-2xl border border-dashed border-border p-5 text-center">
          No registry tools match.
        </p>
      ) : (
        rows.map((row) => {
          const attached = attachedRefs.includes(row.tool_id);
          const system = row.tenant_id === "system";
          return (
            <ToolRow
              key={row.tool_id}
              title={row.name}
              subtitle={`${KIND_LABEL[row.kind] ?? row.kind} · ${row.tool_id}`}
              badges={[system ? "system" : "tenant"]}
              action={
                attached ? (
                  <span className="text-[11px] font-mono uppercase tracking-widest text-emerald-700 dark:text-emerald-400 shrink-0">
                    attached
                  </span>
                ) : (
                  <button
                    onClick={() => onAttach(row)}
                    disabled={pending}
                    className="h-9 px-3 rounded-xl text-xs font-semibold bg-primary/10 text-ember-700 dark:text-ember-300 border border-primary/20 hover:bg-primary/20 transition-colors disabled:opacity-50"
                  >
                    Attach
                  </button>
                )
              }
            />
          );
        })
      )}
    </div>
  );
}

function WebhookParamsEditor({
  webhooks,
  onParamCommit,
  pending,
}: {
  webhooks: Record<string, { ref: string; param?: unknown }>;
  onParamCommit: (name: string, raw: string) => string | null;
  pending: boolean;
}) {
  const names = Object.keys(webhooks);
  if (names.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
        Webhook params (per-attachment overrides)
      </p>
      {names.map((name) => (
        <ParamRow
          key={name}
          name={name}
          initial={webhooks[name].param === undefined ? "" : JSON.stringify(webhooks[name].param, null, 2)}
          onCommit={onParamCommit}
          pending={pending}
        />
      ))}
    </div>
  );
}

function ParamRow({
  name,
  initial,
  onCommit,
  pending,
}: {
  name: string;
  initial: string;
  onCommit: (name: string, raw: string) => string | null;
  pending: boolean;
}) {
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="rounded-2xl border border-border bg-muted/40 p-3 space-y-2">
      <p className="text-xs font-mono text-foreground truncate">{name}</p>
      <textarea
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
          setError(null);
        }}
        onBlur={() => {
          if (draft === initial) return;
          setError(onCommit(name, draft));
        }}
        rows={2}
        disabled={pending}
        placeholder='{} — JSON params merged at call time'
        aria-label={`Params for webhook ${name}`}
        className="w-full bg-card border border-border rounded-xl px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ember-400/50 resize-y disabled:opacity-50"
      />
      {error && <p className="text-xs text-red-700 dark:text-red-400">{error}</p>}
    </div>
  );
}

function TenantToolForm({
  editing,
  onSaved,
}: {
  editing?: AgentTool;
  onSaved: () => void;
}) {
  const createTool = useCreateTenantTool();
  const updateTool = useUpdateTenantTool();
  const [kind, setKind] = useState<"function" | "webhook">(
    editing?.kind === "webhook" ? "webhook" : "function"
  );
  const [name, setName] = useState(editing?.name ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [url, setUrl] = useState(editing?.url ?? "");
  const [parameters, setParameters] = useState(
    editing && Object.keys(editing.parameters).length > 0
      ? JSON.stringify(editing.parameters, null, 2)
      : ""
  );
  const [formError, setFormError] = useState<string | null>(null);
  const pending = createTool.isPending || updateTool.isPending;

  const handleCreate = async () => {
    setFormError(null);
    if (!name.trim()) {
      setFormError("Give the tool a name.");
      return;
    }
    let parsed: Record<string, unknown> = {};
    if (parameters.trim()) {
      try {
        const value: unknown = JSON.parse(parameters);
        if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("not an object");
        parsed = value as Record<string, unknown>;
      } catch {
        setFormError("Parameters must be a JSON object.");
        return;
      }
    }
    try {
      if (editing) {
        await updateTool.mutateAsync({
          id: editing.tool_id,
          input: {
            kind,
            name: name.trim(),
            description: description.trim(),
            parameters: parsed,
            url: url.trim() || undefined,
          },
        });
      } else {
        await createTool.mutateAsync({
          kind,
          name: name.trim(),
          description: description.trim(),
          parameters: parsed,
          url: url.trim() || undefined,
        });
      }
      onSaved();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Could not save the tool.");
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {(["function", "webhook"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setKind(option)}
            className={cn(
              "h-10 rounded-xl border text-xs font-semibold transition-colors",
              kind === option
                ? "border-primary/40 bg-primary/10 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {option === "function" ? "Function" : "Webhook"}
          </button>
        ))}
      </div>
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Tool name, e.g. book_appointment"
        aria-label="Tenant tool name"
        className={cn(fieldStyles.fieldSm, "font-mono text-xs")}
      />
      <input
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        placeholder="What this tool does"
        aria-label="Tenant tool description"
        className={fieldStyles.fieldSm}
      />
      <input
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        placeholder="https://api/… endpoint"
        aria-label="Tenant tool endpoint URL"
        className={cn(fieldStyles.fieldSm, "font-mono text-xs")}
      />
      <textarea
        value={parameters}
        onChange={(event) => setParameters(event.target.value)}
        rows={2}
        placeholder='Parameters JSON schema, e.g. {"type":"object","properties":{}}'
        aria-label="Tenant tool parameters JSON schema"
        className="w-full bg-card border border-border rounded-xl px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ember-400/50 resize-y"
      />
      {formError && <p className="text-xs text-red-700 dark:text-red-400">{formError}</p>}
      <button
        onClick={() => void handleCreate()}
        disabled={pending}
        className="w-full h-10 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
      >
        {pending && <Loader2 className="w-4 h-4 animate-spin" />}
        {editing ? "Save tenant tool" : "Create tenant tool"}
      </button>
    </div>
  );
}

export function ToolsConfigForm({ agentId, problems = [] }: { agentId: string; problems?: string[] }) {
  const { control, setValue } = useFormContext();
  const attachments = useWatch({ control, name: "agent_config.api_tools" }) as ApiToolsConfig | undefined;
  const current = readAttachments(attachments);
  // Attached display resolves form refs against the registry (form is the
  // source of truth post-attach — no refetch round-trip needed for feedback).
  const { data: registryRows, isLoading: registryLoading } = useTools();
  const registryById = useMemo(
    () => new Map((registryRows ?? []).map((row) => [row.tool_id, row])),
    [registryRows]
  );
  const attached: AttachedTool[] = useMemo(
    () => [
      ...current.tool_refs.map((ref): AttachedTool => {
        const row = registryById.get(ref);
        return row
          ? {
              ref,
              name: row.name,
              kind: row.kind,
              description: row.description,
              deprecated: row.deprecated,
              missing: false,
              embedded: false,
            }
          : { ref, name: ref, kind: "unknown", description: "", deprecated: false, missing: true, embedded: false };
      }),
      ...current.embedded_tools.flatMap((entry): AttachedTool[] => {
        const record = entry && typeof entry === "object" && !Array.isArray(entry)
          ? (entry as Record<string, unknown>)
          : null;
        const fn = record?.function;
        const name =
          (fn && typeof fn === "object" && !Array.isArray(fn) && typeof (fn as Record<string, unknown>).name === "string"
            ? ((fn as Record<string, unknown>).name as string)
            : null) ??
          (typeof record?.name === "string" && (record.name as string).length > 0
            ? (record.name as string)
            : null);
        return name
          ? [{ ref: null, name, kind: "custom", description: "", deprecated: false, missing: false, embedded: true }]
          : [];
      }),
    ],
    [current.tool_refs, current.embedded_tools, registryById]
  );
  const { data: webhookRows } = useTools("webhook");
  const patch = usePatchAgent();
  const queryClient = useQueryClient();
  const [saveError, setSaveError] = useState<unknown>(null);
  const [showCreate, setShowCreate] = useState(false);

  /** Attach-path write: form state first (PUT round-trip safety), then PATCH
   *  the full api_tools value (component replaces wholesale server-side).
   *  The agent-detail cache is merged manually — invalidating would refetch
   *  and reset unrelated dirty fields. */
  const commitAttachments = async (next: Required<ApiToolsConfig>) => {
    setSaveError(null);
    setValue("agent_config.api_tools", next, { shouldDirty: true, shouldValidate: true });
    const payload = buildApiToolsPayload(next) ?? { tool_refs: [], tools: [], tools_params: {} };
    try {
      await patch.mutateAsync({
        id: agentId,
        patch: { tasks_patch: [{ task_index: 0, tools_config: { api_tools: payload } }] },
      });
      queryClient.setQueryData(queryKeys.agents.detail(agentId), (old: Agent | undefined) =>
        old ? { ...old, agent_config: { ...old.agent_config, api_tools: next } } : old
      );
    } catch (e) {
      setSaveError(e);
    }
  };

  const attachRef = (row: AgentTool) => {
    if (current.tool_refs.includes(row.tool_id)) return;
    void commitAttachments({ ...current, tool_refs: [...current.tool_refs, row.tool_id] });
  };

  const detachRef = (ref: string) => {
    void commitAttachments({ ...current, tool_refs: current.tool_refs.filter((r) => r !== ref) });
  };

  const attachWebhook = (row: AgentTool) => {
    if (current.webhooks[row.name]) return;
    void commitAttachments({ ...current, webhooks: { ...current.webhooks, [row.name]: { ref: row.tool_id } } });
  };

  const removeWebhook = (name: string) => {
    const webhooks = { ...current.webhooks };
    delete webhooks[name];
    void commitAttachments({ ...current, webhooks });
  };

  const commitParam = (name: string, raw: string): string | null => {
    const trimmed = raw.trim();
    if (trimmed === "") {
      const webhooks = { ...current.webhooks };
      const entry = { ...webhooks[name] };
      delete entry.param;
      webhooks[name] = entry;
      void commitAttachments({ ...current, webhooks });
      return null;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return "Params must be valid JSON.";
    }
    void commitAttachments({
      ...current,
      webhooks: { ...current.webhooks, [name]: { ...current.webhooks[name], param: parsed } },
    });
    return null;
  };

  const webhookOptions = (webhookRows ?? []).filter((row) => !row.deprecated);

  return (
    <div className="space-y-10">
      <FormSection
        title="Attached Tools"
        description="Shared registry tools attached by id. Attachments resolve at save time; embedded entries stay read-only."
      >
        <div className="col-span-1 md:col-span-2 space-y-3">
          <CatalogProblems problems={problems} prefix=".api_tools" />
          <AgentSaveBanner error={saveError} problems={problems} />
          {registryLoading ? (
            <div className="h-20 rounded-2xl bg-muted/50 animate-pulse" />
          ) : (
            <AttachedSection
              attached={attached}
              refs={current.tool_refs}
              webhooks={current.webhooks}
              onDetach={detachRef}
              onRemoveWebhook={removeWebhook}
              pending={patch.isPending}
            />
          )}
          <PickerBrowser attachedRefs={current.tool_refs} onAttach={attachRef} pending={patch.isPending} />
          <WebhookParamsEditor webhooks={current.webhooks} onParamCommit={commitParam} pending={patch.isPending} />
          {webhookOptions.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
                Attach webhook
              </p>
              <div className="flex flex-wrap gap-2">
                {webhookOptions
                  .filter((row) => !current.webhooks[row.name])
                  .map((row) => (
                    <button
                      key={row.tool_id}
                      onClick={() => attachWebhook(row)}
                      disabled={patch.isPending}
                      className="h-9 px-3 rounded-xl text-xs font-semibold bg-muted/60 border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <Webhook className="w-3.5 h-3.5" /> {row.name}
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>
      </FormSection>

      <FormSection
        title="Tenant Registry"
        description="Your own function and webhook tools. System rows are read-only."
      >
        <div className="col-span-1 md:col-span-2 space-y-3">
          <TenantRows />
          {!showCreate ? (
            <button
              onClick={() => setShowCreate(true)}
              className="w-full h-11 rounded-2xl border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" /> New tenant tool
            </button>
          ) : (
            <>
              <TenantToolForm onSaved={() => setShowCreate(false)} />
              <button
                onClick={() => setShowCreate(false)}
                className="w-full h-10 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </FormSection>
    </div>
  );
}

function TenantRows() {
  const { data: rows, isLoading } = useTools();
  const deleteTenantTool = useDeleteTenantTool();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  if (isLoading) return <div className="h-16 rounded-2xl bg-muted/50 animate-pulse" />;
  const tenantRows = (rows ?? []).filter((row) => row.tenant_id !== "system");
  const systemRows = (rows ?? []).filter((row) => row.tenant_id === "system" && !row.deprecated);
  return (
    <div className="space-y-2">
      {deleteError && <p className="text-xs text-red-700 dark:text-red-400">{deleteError}</p>}
      {tenantRows.map((row) => (
        <div key={row.tool_id} className="space-y-2">
          <ToolRow
            title={row.name}
            subtitle={`${KIND_LABEL[row.kind] ?? row.kind} · ${row.tool_id}`}
            badges={["tenant"]}
            action={
              <span className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => setEditingId(editingId === row.tool_id ? null : row.tool_id)}
                  aria-label={`Edit tenant tool ${row.name}`}
                  className="h-9 px-3 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => {
                    setDeleteError(null);
                    deleteTenantTool.mutate(row.tool_id, {
                      onError: (e) => setDeleteError(e instanceof Error ? e.message : "Delete failed."),
                    });
                  }}
                  aria-label={`Delete tenant tool ${row.name}`}
                  className="p-2 rounded-xl text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </span>
            }
          />
          {editingId === row.tool_id && (
            <TenantToolForm editing={row} onSaved={() => setEditingId(null)} />
          )}
        </div>
      ))}
      {systemRows.map((row) => (
        <ToolRow
          key={row.tool_id}
          title={row.name}
          subtitle={`${KIND_LABEL[row.kind] ?? row.kind} · ${row.tool_id}`}
          badges={["system"]}
          action={
            <span className="p-2 text-muted-foreground" title="System rows are read-only">
              <Lock className="w-4 h-4" />
            </span>
          }
        />
      ))}
      {tenantRows.length === 0 && systemRows.length === 0 && (
        <p className="text-sm text-muted-foreground rounded-2xl border border-dashed border-border p-5 text-center">
          Registry unavailable or empty.
        </p>
      )}
    </div>
  );
}
