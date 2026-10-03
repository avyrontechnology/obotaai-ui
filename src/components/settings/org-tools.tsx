"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Braces,
  Check,
  ChevronDown,
  Copy,
  Loader2,
  Lock,
  Plus,
  Trash2,
  Webhook,
  Wrench,
  X,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ApiError } from "@/lib/api-client";
import { minRoleFor, useCan } from "@/lib/rbac";
import { fieldStyles } from "@/lib/field-styles";
import { cn } from "@/lib/utils";
import { notify } from "@/lib/notify";
import { SearchInput } from "@/components/common/search-input";
import { SectionHeader } from "@/components/common/section-header";
import { SettingsStatCard, SettingsStatsGrid } from "@/components/settings/settings-stats";
import {
  createToolSchema,
  updateToolSchema,
  type AgentTool,
  type CreateToolInput,
  type UpdateToolInput,
} from "@/lib/schemas/platform";
import {
  useCreateTenantTool,
  useDeleteTenantTool,
  useTools,
  useUpdateTenantTool,
} from "@/services/platform/tools";

const KIND_LABEL: Record<string, string> = {
  function: "Function",
  webhook: "Webhook",
  internal: "Internal",
};

type KindFilter = "" | "function" | "webhook";

/** Write gate: backend tools writes need `platform:write` whose minimum role
 *  is member — `agents.write` is the UI mirror at that level (UI only, the
 *  backend re-checks every write). */
const WRITE_ACTION = "agents.write" as const;

function isSystem(tool: AgentTool): boolean {
  return tool.tenant_id === "system";
}

function ToolsStats() {
  const { data: tools, isLoading } = useTools();
  const totals = useMemo(() => {
    const list = tools ?? [];
    return {
      total: list.length,
      function: list.filter((tool) => tool.kind === "function").length,
      webhook: list.filter((tool) => tool.kind === "webhook").length,
      system: list.filter((tool) => isSystem(tool)).length,
      deprecated: list.filter((tool) => tool.deprecated).length,
    };
  }, [tools]);
  return (
    <SettingsStatsGrid label="Tool registry summary">
      <SettingsStatCard
        title="Total tools"
        icon={Wrench}
        value={isLoading ? "—" : String(totals.total)}
        caption={isLoading ? "Loading" : `${totals.total} ${totals.total === 1 ? "row" : "rows"} in registry`}
        loading={isLoading}
        delay={0}
      />
      <SettingsStatCard
        title="Function"
        icon={Braces}
        value={isLoading ? "—" : String(totals.function)}
        caption={isLoading ? "Loading" : "Tenant-authorable kind"}
        loading={isLoading}
        delay={0.05}
      />
      <SettingsStatCard
        title="Webhook"
        icon={Webhook}
        value={isLoading ? "—" : String(totals.webhook)}
        caption={isLoading ? "Loading" : "Tenant-authorable kind"}
        loading={isLoading}
        delay={0.1}
      />
      <SettingsStatCard
        title="System"
        icon={Lock}
        value={isLoading ? "—" : String(totals.system)}
        caption={isLoading ? "Loading" : "Read-only curated rows"}
        loading={isLoading}
        delay={0.15}
      />
      <SettingsStatCard
        title="Deprecated"
        icon={AlertCircle}
        value={isLoading ? "—" : String(totals.deprecated)}
        caption={isLoading ? "Loading" : "Hidden from pickers"}
        loading={isLoading}
        delay={0.2}
      />
    </SettingsStatsGrid>
  );
}

function CreateToolSection() {
  const canManage = useCan(WRITE_ACTION);
  const createTool = useCreateTenantTool();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateToolInput>({
    resolver: zodResolver(createToolSchema),
  });

  if (!canManage) return null;

  const onSubmit = async (data: CreateToolInput) => {
    setError(null);
    try {
      await createTool.mutateAsync(data);
      notify.success("Tool created", { description: data.name });
      reset();
      setShowForm(false);
    } catch {
      setError("Could not create the tool. Is the backend running?");
    }
  };

  return (
    <section className="rounded-3xl border border-border bg-card p-5 md:p-6 min-w-0">
      <SectionHeader
        title="Create tool"
        description="Tenant function or webhook tool. System rows are curated in code review, never here."
        action={
          !showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors flex items-center gap-2 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
            >
              <Plus className="w-4 h-4" aria-hidden="true" /> New tool
            </button>
          ) : undefined
        }
        className="mb-6"
      />

      <AnimatePresence>
        {showForm && (
          <motion.form
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            onSubmit={(event) => void handleSubmit(onSubmit)(event)}
            className="rounded-3xl border border-border bg-muted/40 p-5 space-y-4 min-w-0 motion-reduce:transition-none"
          >
            <p className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">New tool</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 min-w-0">
              <div className="min-w-0">
                {/* Placeholder stays selectable (never disabled): untouched it
                    submits "" which setValueAs maps to undefined so the zod
                    default ("function") applies instead of a phantom value. */}
                <select
                  {...register("kind", { setValueAs: (value) => (value === "" ? undefined : value) })}
                  aria-label="Tool kind"
                  className={cn(fieldStyles.fieldSm, "min-w-0")}
                >
                  <option value="">Select kind...</option>
                  <option value="function">Function</option>
                  <option value="webhook">Webhook</option>
                </select>
                {errors.kind?.message && <p className="text-xs text-destructive mt-1">{errors.kind.message}</p>}
              </div>
              <div className="min-w-0">
                <input
                  {...register("name")}
                  placeholder="Tool name, e.g. book_appointment"
                  aria-label="Tool name"
                  className={cn(fieldStyles.fieldSm, "min-w-0 font-mono text-xs")}
                />
                {errors.name?.message && <p className="text-xs text-destructive mt-1">{errors.name.message}</p>}
              </div>
            </div>
            <div className="min-w-0">
              <input
                {...register("description", { setValueAs: (value) => (value === "" ? undefined : value) })}
                placeholder="What this tool does"
                aria-label="Tool description"
                className={cn(fieldStyles.fieldSm, "min-w-0")}
              />
              {errors.description?.message && (
                <p className="text-xs text-destructive mt-1">{errors.description.message}</p>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 min-w-0">
              <div className="min-w-0">
                <input
                  {...register("url", { setValueAs: (value) => (value === "" ? undefined : value) })}
                  placeholder="https://api/… endpoint"
                  aria-label="Tool endpoint URL"
                  className={cn(fieldStyles.fieldSm, "min-w-0 font-mono text-xs")}
                />
                {errors.url?.message && <p className="text-xs text-destructive mt-1">{errors.url.message}</p>}
              </div>
              <div className="min-w-0">
                <input
                  {...register("method", { setValueAs: (value) => (value === "" ? undefined : value) })}
                  placeholder="POST"
                  aria-label="Tool method"
                  className={cn(fieldStyles.fieldSm, "min-w-0 font-mono text-xs")}
                />
                {errors.method?.message && <p className="text-xs text-destructive mt-1">{errors.method.message}</p>}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 min-w-0">
              <div className="min-w-0">
                <input
                  {...register("timeout_s", {
                    setValueAs: (value) => (value === "" || value === null ? undefined : Number(value)),
                  })}
                  type="number"
                  min={1}
                  max={120}
                  placeholder="Timeout seconds (10)"
                  aria-label="Tool timeout seconds"
                  className={cn(fieldStyles.fieldSm, "min-w-0 tabular-nums")}
                />
                {errors.timeout_s?.message && (
                  <p className="text-xs text-destructive mt-1">{errors.timeout_s.message}</p>
                )}
              </div>
              <div className="min-w-0">
                <input
                  {...register("auth_ref", { setValueAs: (value) => (value === "" ? undefined : value) })}
                  placeholder="Credential reference (optional)"
                  aria-label="Tool auth reference"
                  className={cn(fieldStyles.fieldSm, "min-w-0 font-mono text-xs")}
                />
                {errors.auth_ref?.message && (
                  <p className="text-xs text-destructive mt-1">{errors.auth_ref.message}</p>
                )}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
              <input type="checkbox" {...register("deprecated")} aria-label="Mark tool as deprecated" className="h-4 w-4 accent-current shrink-0" />
              <span className="truncate" title="Deprecated tools hide from pickers but keep resolving for attached agents">
                Deprecated — hide from pickers
              </span>
            </label>
            {error && (
              <p className="flex items-center gap-2 text-xs text-destructive min-w-0">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />{" "}
                <span className="truncate" title={error}>
                  {error}
                </span>
              </p>
            )}
            <div className="flex flex-wrap gap-2 min-w-0">
              <button
                type="submit"
                disabled={createTool.isPending}
                className="flex-1 min-w-[140px] h-10 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
              >
                {createTool.isPending && (
                  <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                )}
                Create tool
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setError(null);
                }}
                className="h-10 px-4 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
              >
                Cancel
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </section>
  );
}

function EditToolForm({ tool, onSaved, onCancel }: { tool: AgentTool; onSaved: () => void; onCancel: () => void }) {
  const updateTool = useUpdateTenantTool();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateToolInput>({
    resolver: zodResolver(updateToolSchema),
    defaultValues: {
      kind: tool.kind === "webhook" ? "webhook" : "function",
      name: tool.name,
      description: tool.description ?? "",
      url: tool.url ?? undefined,
      method: tool.method,
      timeout_s: tool.timeout_s,
      auth_ref: tool.auth_ref ?? undefined,
      deprecated: tool.deprecated,
    },
  });

  const onSubmit = async (data: UpdateToolInput) => {
    setError(null);
    try {
      await updateTool.mutateAsync({ id: tool.tool_id, input: data });
      notify.success("Tool updated", { description: tool.name });
      onSaved();
    } catch {
      setError("Could not save the tool. Is the backend running?");
    }
  };

  return (
    <motion.form
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      onSubmit={(event) => void handleSubmit(onSubmit)(event)}
      className="rounded-3xl border border-border bg-muted/40 p-5 space-y-4 min-w-0 motion-reduce:transition-none"
    >
      <p className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground truncate" title={`Editing ${tool.name}`}>
        Editing {tool.name}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 min-w-0">
        <div className="min-w-0">
          <select
            {...register("kind", { setValueAs: (value) => (value === "" ? undefined : value) })}
            aria-label="Tool kind"
            className={cn(fieldStyles.fieldSm, "min-w-0")}
          >
            <option value="">Select kind...</option>
            <option value="function">Function</option>
            <option value="webhook">Webhook</option>
          </select>
          {errors.kind?.message && <p className="text-xs text-destructive mt-1">{errors.kind.message}</p>}
        </div>
        <div className="min-w-0">
          <input
            {...register("name", { setValueAs: (value) => (value === "" ? undefined : value) })}
            placeholder="Tool name, e.g. book_appointment"
            aria-label="Tool name"
            className={cn(fieldStyles.fieldSm, "min-w-0 font-mono text-xs")}
          />
          {errors.name?.message && <p className="text-xs text-destructive mt-1">{errors.name.message}</p>}
        </div>
      </div>
      <div className="min-w-0">
        <input
          {...register("description", { setValueAs: (value) => (value === "" ? undefined : value) })}
          placeholder="What this tool does"
          aria-label="Tool description"
          className={cn(fieldStyles.fieldSm, "min-w-0")}
        />
        {errors.description?.message && (
          <p className="text-xs text-destructive mt-1">{errors.description.message}</p>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 min-w-0">
        <div className="min-w-0">
          <input
            {...register("url", { setValueAs: (value) => (value === "" ? undefined : value) })}
            placeholder="https://api/… endpoint"
            aria-label="Tool endpoint URL"
            className={cn(fieldStyles.fieldSm, "min-w-0 font-mono text-xs")}
          />
          {errors.url?.message && <p className="text-xs text-destructive mt-1">{errors.url.message}</p>}
        </div>
        <div className="min-w-0">
          <input
            {...register("method", { setValueAs: (value) => (value === "" ? undefined : value) })}
            placeholder="POST"
            aria-label="Tool method"
            className={cn(fieldStyles.fieldSm, "min-w-0 font-mono text-xs")}
          />
          {errors.method?.message && <p className="text-xs text-destructive mt-1">{errors.method.message}</p>}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 min-w-0">
        <div className="min-w-0">
          <input
            {...register("timeout_s", {
              setValueAs: (value) => (value === "" || value === null ? undefined : Number(value)),
            })}
            type="number"
            min={1}
            max={120}
            placeholder="Timeout seconds (10)"
            aria-label="Tool timeout seconds"
            className={cn(fieldStyles.fieldSm, "min-w-0 tabular-nums")}
          />
          {errors.timeout_s?.message && (
            <p className="text-xs text-destructive mt-1">{errors.timeout_s.message}</p>
          )}
        </div>
        <div className="min-w-0">
          <input
            {...register("auth_ref", { setValueAs: (value) => (value === "" ? undefined : value) })}
            placeholder="Credential reference (optional)"
            aria-label="Tool auth reference"
            className={cn(fieldStyles.fieldSm, "min-w-0 font-mono text-xs")}
          />
          {errors.auth_ref?.message && (
            <p className="text-xs text-destructive mt-1">{errors.auth_ref.message}</p>
          )}
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
        <input type="checkbox" {...register("deprecated")} aria-label="Mark tool as deprecated" className="h-4 w-4 accent-current shrink-0" />
        <span className="truncate" title="Deprecated tools hide from pickers but keep resolving for attached agents">
          Deprecated — hide from pickers
        </span>
      </label>
      {error && (
        <p className="flex items-center gap-2 text-xs text-destructive min-w-0">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />{" "}
          <span className="truncate" title={error}>
            {error}
          </span>
        </p>
      )}
      <div className="flex flex-wrap gap-2 min-w-0">
        <button
          type="submit"
          disabled={updateTool.isPending}
          className="flex-1 min-w-[140px] h-10 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
        >
          {updateTool.isPending && (
            <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          )}
          Save tool
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="h-10 px-4 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
        >
          Cancel
        </button>
      </div>
    </motion.form>
  );
}

function ToolsListSection() {
  const canManage = useCan(WRITE_ACTION);
  const { data: tools, isLoading } = useTools();
  const deleteTool = useDeleteTenantTool();

  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<KindFilter>("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (tools ?? []).filter((tool) => {
      if (kindFilter && tool.kind !== kindFilter) return false;
      if (!needle) return true;
      return [tool.name, tool.description ?? "", tool.tool_id].join(" ").toLowerCase().includes(needle);
    });
  }, [tools, query, kindFilter]);

  const showFilter = (tools ?? []).length > 1;

  const copyToolId = async (tool: AgentTool) => {
    try {
      await navigator.clipboard.writeText(tool.tool_id);
      setCopiedId(tool.tool_id);
    } catch {
      setCopiedId(null);
    }
  };

  const handleDelete = (tool: AgentTool) => {
    deleteTool.mutate(tool.tool_id, {
      onSuccess: () => {
        setConfirmDeleteId(null);
        notify.success("Tool deleted", { description: tool.name });
      },
      onError: (error: unknown) => {
        setConfirmDeleteId(null);
        if (error instanceof ApiError && error.status === 409) {
          // Backend refuses while agents reference the row: details carry
          // `referencing_agents` (the attached-agent count) and the message
          // names the tool. Surface both — never a bare failure.
          const count = error.details?.referencing_agents;
          const suffix =
            typeof count === "number" ? ` (${count} agent${count === 1 ? "" : "s"} attached)` : "";
          notify.error(`Cannot delete — detach from agents first${suffix}`, error);
        } else {
          notify.error("Could not delete tool", error);
        }
      },
    });
  };

  return (
    <section className="rounded-3xl border border-border bg-card p-5 md:p-6 min-w-0">
      <SectionHeader
        title="Tools"
        description={
          <>
            Tenant + system registry rows. System rows are read-only; deprecated rows hide from pickers.
            {!canManage && ` Read-only — requires ${minRoleFor(WRITE_ACTION)} role.`}
          </>
        }
        className="mb-6"
      />

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-20 rounded-3xl bg-muted/50 border border-border animate-pulse motion-reduce:animate-none"
            />
          ))}
        </div>
      ) : (tools ?? []).length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border p-10 text-center min-w-0">
          <div
            className="w-11 h-11 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3"
            aria-hidden="true"
          >
            <Wrench className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
          </div>
          <p className="text-sm font-medium text-foreground truncate" title="No tools yet">
            No tools yet.
          </p>
          <p className="text-xs text-muted-foreground mt-1 truncate" title="Create one above to share tools across agents">
            {canManage ? "Create one above to share tools across agents." : "A member can create the first tool."}
          </p>
        </div>
      ) : (
        <>
          {showFilter && (
            <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <SearchInput
                value={query}
                onChange={setQuery}
                placeholder="Filter by name, description or id…"
                label="Filter tools"
                className="!w-full max-w-none sm:max-w-xs"
              />
              {/* Placeholder stays selectable (never disabled) so the untouched
                  filter means "all kinds" instead of a phantom first option. */}
              <select
                value={kindFilter}
                onChange={(event) => setKindFilter(event.target.value as KindFilter)}
                aria-label="Filter by tool kind"
                className={cn(fieldStyles.fieldSm, "min-w-0 sm:max-w-xs")}
              >
                <option value="">All kinds</option>
                <option value="function">Function</option>
                <option value="webhook">Webhook</option>
              </select>
            </div>
          )}
          {visible.length === 0 ? (
            <p className="text-sm text-muted-foreground rounded-3xl border border-dashed border-border p-10 text-center">
              No tools match this filter.
            </p>
          ) : (
            <>
              <div className="hidden lg:grid lg:grid-cols-12 gap-3 px-5 py-2 text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
                <div className="lg:col-span-5 truncate">Tool</div>
                <div className="lg:col-span-5 truncate">Endpoint · Config</div>
                <div className="lg:col-span-2 text-right truncate">Actions</div>
              </div>
              <div className="flex flex-col gap-3 min-w-0">
                {visible.map((tool) => {
                  const system = isSystem(tool);
                  const endpoint = tool.url ? `${tool.method} ${tool.url}` : `${tool.method} · no endpoint`;
                  const metaTitle = `${tool.tool_id} · timeout ${tool.timeout_s}s${tool.auth_ref ? ` · auth ${tool.auth_ref}` : " · no auth ref"}`;
                  return (
                    <div key={tool.tool_id} className="space-y-2 min-w-0">
                      <div
                        className={cn(
                          "grid grid-cols-1 lg:grid-cols-12 gap-3 items-center p-4 md:px-5 bg-muted/40 border rounded-3xl min-w-0",
                          tool.deprecated ? "border-amber-500/25" : "border-border"
                        )}
                      >
                        <div className="lg:col-span-5 flex items-center gap-3 min-w-0">
                          <div
                            className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0"
                            aria-hidden="true"
                          >
                            <Wrench className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="flex items-center gap-2 min-w-0">
                              <span className="text-sm font-medium text-foreground truncate font-mono" title={tool.name}>
                                {tool.name}
                              </span>
                              <span
                                className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-muted text-muted-foreground border border-border shrink-0"
                                title={`Kind: ${tool.kind}`}
                              >
                                {KIND_LABEL[tool.kind] ?? tool.kind}
                              </span>
                              {system ? (
                                <span
                                  className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-muted text-muted-foreground border border-border shrink-0"
                                  title="System row — read-only, curated in code review"
                                >
                                  System
                                </span>
                              ) : null}
                              {tool.deprecated ? (
                                <span
                                  className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 shrink-0"
                                  title="Deprecated — hidden from pickers; existing attaches keep resolving"
                                >
                                  Deprecated
                                </span>
                              ) : null}
                            </p>
                            <p
                              className="text-xs text-muted-foreground truncate mt-1"
                              title={tool.description || tool.tool_id}
                            >
                              {tool.description || tool.tool_id}
                            </p>
                          </div>
                        </div>
                        <div className="lg:col-span-5 min-w-0">
                          <p
                            className="text-[11px] font-mono text-muted-foreground truncate tabular-nums"
                            title={endpoint}
                          >
                            {endpoint}
                          </p>
                          <p
                            className="text-[11px] font-mono text-muted-foreground truncate mt-0.5 tabular-nums"
                            title={metaTitle}
                          >
                            timeout {tool.timeout_s}s{tool.auth_ref ? ` · auth ${tool.auth_ref}` : " · no auth ref"}
                          </p>
                          {tool.deprecated ? (
                            <p
                              className="text-[11px] font-mono text-amber-700 dark:text-amber-300 truncate mt-0.5"
                              title="Deprecated — hidden from pickers; existing attaches keep resolving until detached"
                            >
                              Stale — hidden from pickers, attached agents keep resolving.
                            </p>
                          ) : null}
                        </div>
                        <div className="lg:col-span-2 flex lg:justify-end min-w-0">
                          {system ? (
                            <span className="flex items-center gap-1 min-w-0">
                              <button
                                onClick={() => setExpandedId(expandedId === tool.tool_id ? null : tool.tool_id)}
                                aria-expanded={expandedId === tool.tool_id}
                                aria-label={`${expandedId === tool.tool_id ? "Hide" : "Show"} ${tool.name} schema`}
                                title={`${expandedId === tool.tool_id ? "Hide" : "Show"} parameters schema`}
                                className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
                              >
                                <ChevronDown
                                  className={cn(
                                    "w-4 h-4 transition-transform motion-reduce:transition-none",
                                    expandedId === tool.tool_id && "rotate-180"
                                  )}
                                  aria-hidden="true"
                                />
                              </button>
                              <span
                                className="p-2 text-muted-foreground shrink-0"
                                title="System rows are read-only"
                                aria-label={`System tool ${tool.name} is read-only`}
                              >
                                <Lock className="w-4 h-4" aria-hidden="true" />
                              </span>
                            </span>
                          ) : (
                            canManage &&
                            (confirmDeleteId === tool.tool_id ? (
                              <span className="flex items-center gap-1.5 min-w-0">
                                <button
                                  onClick={() => handleDelete(tool)}
                                  disabled={deleteTool.isPending}
                                  aria-label={`Confirm delete ${tool.name}`}
                                  title={deleteTool.isPending ? "Deleting…" : `Delete ${tool.name} (refused while agents attach it)`}
                                  className="h-8 px-3 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-semibold transition-colors shrink-0 flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 motion-reduce:transition-none"
                                >
                                  {deleteTool.isPending && (
                                    <Loader2
                                      className="w-3.5 h-3.5 animate-spin motion-reduce:animate-none"
                                      aria-hidden="true"
                                    />
                                  )}
                                  Confirm
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteId(null)}
                                  aria-label={`Cancel deleting ${tool.name}`}
                                  title={`Cancel deleting ${tool.name}`}
                                  className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
                                >
                                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                                </button>
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 min-w-0">
                                <button
                                  onClick={() => setExpandedId(expandedId === tool.tool_id ? null : tool.tool_id)}
                                  aria-expanded={expandedId === tool.tool_id}
                                  aria-label={`${expandedId === tool.tool_id ? "Hide" : "Show"} ${tool.name} schema`}
                                  title={`${expandedId === tool.tool_id ? "Hide" : "Show"} parameters schema`}
                                  className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
                                >
                                  <ChevronDown
                                    className={cn(
                                      "w-4 h-4 transition-transform motion-reduce:transition-none",
                                      expandedId === tool.tool_id && "rotate-180"
                                    )}
                                    aria-hidden="true"
                                  />
                                </button>
                                <button
                                  onClick={() => setEditingId(editingId === tool.tool_id ? null : tool.tool_id)}
                                  aria-label={`Edit tool ${tool.name}`}
                                  title={`Edit tool ${tool.name}`}
                                  className="h-9 px-3 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteId(tool.tool_id)}
                                  aria-label={`Delete tool ${tool.name}`}
                                  title={`Delete tool ${tool.name}`}
                                  className="p-2 rounded-xl text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 motion-reduce:transition-none"
                                >
                                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                                </button>
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                      <AnimatePresence>
                        {expandedId === tool.tool_id && (
                          <motion.div
                            key={`detail-${tool.tool_id}`}
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            className="rounded-3xl border border-border bg-muted/40 p-4 md:px-5 space-y-3 min-w-0 motion-reduce:transition-none"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <code
                                className="flex-1 min-w-0 truncate font-mono text-[11px] text-muted-foreground tabular-nums"
                                title={tool.tool_id}
                              >
                                {tool.tool_id}
                              </code>
                              <button
                                onClick={() => void copyToolId(tool)}
                                aria-label={`Copy tool id ${tool.tool_id}`}
                                title="Copy tool id"
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
                              >
                                {copiedId === tool.tool_id ? (
                                  <Check className="w-3.5 h-3.5" aria-hidden="true" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                                )}
                              </button>
                            </div>
                            <div>
                              <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">
                                Parameters schema
                              </p>
                              <pre
                                className="max-h-56 overflow-auto rounded-2xl border border-border bg-card p-3 font-mono text-[11px] leading-relaxed text-foreground whitespace-pre-wrap break-words tabular-nums"
                                title="JSON-Schema contract validated on every call"
                              >
                                {JSON.stringify(tool.parameters ?? {}, null, 2)}
                              </pre>
                            </div>
                            <p
                              className="text-[11px] font-mono text-muted-foreground truncate tabular-nums"
                              title={`Created ${tool.created_at}`}
                            >
                              created {tool.created_at}
                            </p>
                          </motion.div>
                        )}
                        {editingId === tool.tool_id && !system && canManage && (
                          <EditToolForm
                            key={tool.tool_id}
                            tool={tool}
                            onSaved={() => setEditingId(null)}
                            onCancel={() => setEditingId(null)}
                          />
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </>
          )}
          {!canManage && (
            <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground min-w-0">
              <Lock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">Read-only — tool management needs a member role.</span>
            </p>
          )}
        </>
      )}
    </section>
  );
}

export function OrgTools() {
  return (
    <div className="space-y-6 min-w-0">
      <ToolsStats />

      <CreateToolSection />

      <ToolsListSection />

      <p
        className="text-xs font-mono text-muted-foreground tabular-nums truncate"
        title="System rows are read-only · Deprecated rows are hidden from pickers"
      >
        System rows are read-only · Deprecated rows are hidden from pickers.
      </p>
    </div>
  );
}
