"use client";

import { use, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Bot,
  Check,
  ChevronDown,
  Clock3,
  Flag,
  Globe,
  History,
  Loader2,
  Megaphone,
  MessageCircle,
  PhoneCall,
  Play,
  PlayCircle,
  Plus,
  RotateCcw,
  ShieldCheck,
  Square,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FlowCanvas } from "@/components/builders/flow-canvas";
import { Drawer } from "@/components/common/modal";
import { ProgressBar } from "@/components/common/progress-bar";
import { ValidationPanel } from "@/components/common/validation-panel";
import { parseCsv } from "@/lib/csv";
import { timeAgo } from "@/lib/format";
import { useAgents } from "@/services/api";
import {
  useCampaignRuns,
  useCampaigns,
  useCreateCampaign,
  useDeleteWorkflow,
  useRestoreWorkflowVersion,
  useStartCampaign,
  useStopCampaign,
  useTestRunWorkflow,
  useUpdateWorkflow,
  useValidateWorkflow,
  useWorkflow,
  useWorkflowVersions,
} from "@/services/platform/workflows";
import type {
  ValidationResult,
  WorkflowDefinition,
  WorkflowEdge,
  WorkflowNode,
  WorkflowRun,
} from "@/lib/schemas/builders";
import { notify } from "@/lib/notify";
import { fieldStyles } from "@/lib/field-styles";
import { cn } from "@/lib/utils";

const NODE_META = {
  start: { label: "Start", icon: PlayCircle, hint: "Entry point. Exactly one per workflow." },
  agent: { label: "Agent Call", icon: PhoneCall, hint: "Place a simulated call with an agent." },
  extraction: { label: "Extraction", icon: Bot, hint: "Capture fields from variables." },
  api: { label: "API Call", icon: Globe, hint: "Logged only in simulation — no request sent." },
  wait: { label: "Wait", icon: Clock3, hint: "Pause between steps." },
  retry: { label: "Retry", icon: RotateCcw, hint: "Re-run a step after failures." },
  whatsapp: { label: "WhatsApp", icon: MessageCircle, hint: "Logged only in simulation." },
  end: { label: "End", icon: Flag, hint: "Terminal step." },
} as const;

type NodeType = keyof typeof NODE_META;


function newNodeId(nodes: WorkflowNode[]): string {
  let index = nodes.length + 1;
  while (nodes.some((node) => node.id === `step-${index}`)) index++;
  return `step-${index}`;
}

function WorkflowNodeCard({ node }: { node: WorkflowNode }) {
  const meta = NODE_META[node.type];
  const Icon = meta.icon;
  const subtitle =
    node.type === "agent"
      ? String(node.config.agent_id ?? "No agent set").slice(0, 24)
      : node.label || meta.hint;
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4 text-ember-700 dark:text-ember-300 shrink-0" />
        <span className="font-mono text-xs font-semibold text-foreground truncate">{node.id}</span>
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground ml-auto shrink-0">
          {meta.label}
        </span>
      </div>
      <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
    </div>
  );
}

export default function WorkflowBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: workflow, isLoading } = useWorkflow(id);
  const { data: agents } = useAgents();
  const updateWorkflow = useUpdateWorkflow();
  const deleteWorkflow = useDeleteWorkflow();
  const validateWorkflow = useValidateWorkflow();
  const testRun = useTestRunWorkflow();
  const restoreVersion = useRestoreWorkflowVersion();
  const { data: versions, refetch: refetchVersions } = useWorkflowVersions(id, false);

  const [draft, setDraft] = useState<WorkflowDefinition | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const [name, setName] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [lastRun, setLastRun] = useState<WorkflowRun | null>(null);
  const [showVersions, setShowVersions] = useState(false);
  const [showCampaigns, setShowCampaigns] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [testContact, setTestContact] = useState("+911234567890");
  const [actionError, setActionError] = useState<string | null>(null);

  if (workflow && draft === null) {
    setDraft(workflow.definition);
    setSavedSnapshot(JSON.stringify(workflow.definition));
    setName(workflow.name);
  }

  const dirty = draft !== null && JSON.stringify(draft) !== savedSnapshot;
  const selected = draft?.nodes.find((node) => node.id === selectedId) ?? null;

  const patchDefinition = (nodes: WorkflowNode[]) => {
    setDraft((prev) => (prev ? { ...prev, nodes } : prev));
    setSavedFlash(false);
    setValidation(null);
  };

  const patchNode = (nodeId: string, update: Partial<WorkflowNode>) => {
    if (!draft) return;
    patchDefinition(draft.nodes.map((node) => (node.id === nodeId ? { ...node, ...update } : node)));
  };

  const patchConfig = (nodeId: string, update: Record<string, unknown>) => {
    if (!draft) return;
    patchDefinition(
      draft.nodes.map((node) =>
        node.id === nodeId ? { ...node, config: { ...node.config, ...update } } : node
      )
    );
  };

  const addNode = (type: NodeType) => {
    if (!draft) return;
    const node: WorkflowNode = { id: newNodeId(draft.nodes), type, label: NODE_META[type].label, config: {} };
    patchDefinition([...draft.nodes, node]);
    setSelectedId(node.id);
  };

  const deleteNode = (nodeId: string) => {
    if (!draft) return;
    setDraft({
      ...draft,
      nodes: draft.nodes.filter((node) => node.id !== nodeId),
      edges: draft.edges.filter((edge) => edge.from_node !== nodeId && edge.to_node !== nodeId),
    });
    setSavedFlash(false);
    setValidation(null);
    if (selectedId === nodeId) setSelectedId(null);
    if (connectFrom === nodeId) setConnectFrom(null);
  };

  const addEdge = (fromId: string, toId: string, label = "") => {
    if (!draft || fromId === toId) return;
    if (draft.edges.some((edge) => edge.from_node === fromId && edge.to_node === toId)) return;
    setDraft((prev) =>
      prev ? { ...prev, edges: [...prev.edges, { from_node: fromId, to_node: toId, label }] } : prev
    );
    setSavedFlash(false);
  };

  const deleteEdge = (fromId: string, toId: string) => {
    if (!draft) return;
    setDraft((prev) =>
      prev
        ? { ...prev, edges: prev.edges.filter((edge) => !(edge.from_node === fromId && edge.to_node === toId)) }
        : prev
    );
    setSavedFlash(false);
  };

  const handleConnectClick = (nodeId: string) => {
    if (connectFrom === null) {
      setConnectFrom(nodeId);
      setSelectedId(nodeId);
    } else if (connectFrom === nodeId) {
      setConnectFrom(null);
    } else {
      addEdge(connectFrom, nodeId);
      setConnectFrom(null);
    }
  };

  const handleSave = async () => {
    if (!draft || !dirty) return;
    setActionError(null);
    setSavedFlash(false);
    try {
      const updated = await updateWorkflow.mutateAsync({ id, name: name ?? undefined, definition: draft });
      setDraft(updated.definition);
      setSavedSnapshot(JSON.stringify(updated.definition));
      setName(updated.name);
      setSavedFlash(true);
    } catch {
      setActionError("Save failed. Is the backend running?");
      throw new Error("save failed");
    }
  };

  const handleValidate = async () => {
    setActionError(null);
    try {
      if (dirty) await handleSave();
      setValidation(await validateWorkflow.mutateAsync(id));
    } catch {
      setActionError("Validation failed. Is the backend running?");
    }
  };

  const handleTestRun = async () => {
    setActionError(null);
    try {
      if (dirty) await handleSave();
      setLastRun(await testRun.mutateAsync({ id, to_number: testContact.trim() || undefined }));
    } catch {
      setActionError("Test-run failed. Is the backend running?");
    }
  };

  if (isLoading || !workflow || !draft) {
    return (
      <div className="max-w-7xl mx-auto w-full pt-12 pb-32 px-4 md:px-8 space-y-4">
        <div className="h-12 w-64 rounded-2xl bg-card border border-border animate-pulse" />
        <div className="h-[500px] rounded-[2rem] bg-card border border-border animate-pulse" />
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-[100dvh] max-w-[1400px] mx-auto w-full pt-12 pb-32 px-4 md:px-8">
      <Link
        href="/workflows"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4 w-fit"
      >
        <ArrowLeft className="w-4 h-4" /> Workflows
      </Link>

      <div className="flex flex-col xl:flex-row xl:items-center gap-4 mb-6">
        <input
          value={name ?? workflow.name}
          onChange={(event) => {
            setName(event.target.value);
            setSavedFlash(false);
          }}
          aria-label="Workflow name"
          className="h-12 px-4 text-xl font-semibold tracking-tight bg-transparent border border-transparent hover:border-border focus:border-border rounded-2xl text-foreground focus:outline-none transition-colors max-w-md"
        />
        <div className="flex flex-wrap items-center gap-2 xl:ml-auto">
          {savedFlash && !dirty && (
            <span className="flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-400 mr-1">
              <Check className="w-4 h-4" /> Saved
            </span>
          )}
          <button
            onClick={() => void handleSave().catch(() => undefined)}
            disabled={!dirty || updateWorkflow.isPending}
            className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {updateWorkflow.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Save{dirty ? " *" : ""}
          </button>
          <button
            onClick={() => void handleValidate().catch(() => undefined)}
            disabled={validateWorkflow.isPending}
            className="h-10 px-4 rounded-xl bg-card border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors flex items-center gap-2"
          >
            <ShieldCheck className="w-4 h-4" /> Validate
          </button>
          <button
            onClick={() => void handleTestRun().catch(() => undefined)}
            disabled={testRun.isPending}
            className="h-10 px-4 rounded-xl bg-card border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors flex items-center gap-2"
          >
            <Play className="w-4 h-4" /> Test-run
          </button>
          <button
            onClick={() => setShowCampaigns((value) => !value)}
            className={cn(
              "h-10 px-4 rounded-xl border text-sm transition-colors flex items-center gap-2",
              showCampaigns
                ? "border-primary/40 bg-primary/10 text-foreground"
                : "bg-card border-border text-muted-foreground hover:text-foreground"
            )}
          >
            <Megaphone className="w-4 h-4" /> Campaigns
          </button>
          <button
            onClick={() => {
              setShowVersions(true);
              void refetchVersions();
            }}
            className="h-10 px-4 rounded-xl bg-card border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors flex items-center gap-2"
          >
            <History className="w-4 h-4" /> Versions
          </button>
        </div>
      </div>

      {connectFrom && (
        <p className="mb-4 text-sm text-ember-700 dark:text-ember-300 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-2.5 w-fit">
          Connecting from <span className="font-mono font-semibold">{connectFrom}</span> — click a target step, or
          click it again to cancel.
        </p>
      )}

      {actionError && (
        <p className="mb-4 flex items-center gap-2 text-sm text-red-700 dark:text-red-400 rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-2.5 w-fit">
          <AlertCircle className="w-4 h-4 shrink-0" /> {actionError}
        </p>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        <div className="xl:col-span-2 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground mr-1">Add step</span>
            {(Object.keys(NODE_META) as NodeType[]).map((type) => {
              const Icon = NODE_META[type].icon;
              return (
                <button
                  key={type}
                  onClick={() => addNode(type)}
                  title={NODE_META[type].hint}
                  className="flex items-center gap-1.5 h-9 px-3 rounded-xl border border-border bg-card text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  <Icon className="w-3.5 h-3.5" /> {NODE_META[type].label}
                </button>
              );
            })}
            <button
              onClick={() => setConnectFrom((value) => (value ? null : (selectedId ?? value)))}
              disabled={!selectedId && !connectFrom}
              className={cn(
                "flex items-center gap-1.5 h-9 px-3 rounded-xl border text-xs transition-colors disabled:opacity-40",
                connectFrom
                  ? "border-ember-400/50 bg-ember-400/10 text-ember-700 dark:text-ember-300"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              )}
            >
              <GitForkIcon /> {connectFrom ? "Cancel connect" : "Connect"}
            </button>
          </div>

          <FlowCanvas
            nodes={draft.nodes}
            edges={draft.edges.map((edge) => ({ from: edge.from_node, to: edge.to_node, label: edge.label }))}
            startId={draft.nodes.find((node) => node.type === "start")?.id}
            selectedId={selectedId}
            connectFrom={connectFrom}
            onSelect={setSelectedId}
            onConnectClick={handleConnectClick}
            onDelete={deleteNode}
            renderNode={(node) => <WorkflowNodeCard node={node} />}
          />

          {validation && (
            <ValidationPanel
              valid={validation.valid}
              errors={validation.errors}
              warnings={validation.warnings}
              validLabel="Workflow is valid"
            />
          )}

          {lastRun && (
            <div className="rounded-[2rem] border border-border bg-card p-5">
              <p className="text-sm font-semibold text-foreground mb-1">
                Test run{" "}
                <span className={cn("font-mono text-xs ml-1", lastRun.status === "completed" ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400")}>
                  {lastRun.status}
                </span>
              </p>
              <p className="text-xs font-mono text-muted-foreground mb-4">{lastRun.run_id}</p>
              <div className="space-y-2">
                {lastRun.reports.map((report, index) => (
                  <div key={index} className="rounded-xl border border-border bg-muted/40 px-3 py-2.5">
                    <div className="flex items-center gap-2 text-sm">
                      <span
                        className={cn(
                          "w-2 h-2 rounded-full shrink-0",
                          report.status === "ok" ? "bg-emerald-500" : "bg-red-500"
                        )}
                      />
                      <span className="font-mono text-xs text-foreground">{report.node_id}</span>
                      <span className="text-xs text-muted-foreground">{report.type}</span>
                      <span className="text-[11px] font-mono text-muted-foreground ml-auto">
                        {reportSummary(report.detail)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {showCampaigns && <CampaignPanel workflowId={id} />}
        </div>

        <div className="space-y-4">
          <div className="rounded-[2rem] border border-border bg-card p-5 space-y-3">
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Test contact</p>
            <input
              value={testContact}
              onChange={(event) => setTestContact(event.target.value)}
              aria-label="Test contact number"
              className={cn(fieldStyles.fieldSm, "font-mono")}
            />
            <p className="text-xs text-muted-foreground">
              Test-runs execute against the simulation runner with zero delays.
            </p>
          </div>

          {selected ? (
            <StepInspector
              node={selected}
              nodes={draft.nodes}
              agents={(agents ?? []).map((agent) => ({ id: agent.agent_id, name: agent.agent_name }))}
              outgoing={draft.edges.filter((edge) => edge.from_node === selected.id)}
              onAddEdge={(toId, label) =>
                setDraft((prev) =>
                  prev
                    ? { ...prev, edges: [...prev.edges, { from_node: selected.id, to_node: toId, label }] }
                    : prev
                )
              }
              onDeleteEdge={(edge) => deleteEdge(edge.from_node, edge.to_node)}
              onPatch={(update) => patchNode(selected.id, update)}
              onPatchConfig={(update) => patchConfig(selected.id, update)}
            />
          ) : (
            <div className="rounded-[2rem] border border-dashed border-border p-8 text-center">
              <p className="text-sm text-muted-foreground">Select a step to configure it.</p>
            </div>
          )}

          <button
            onClick={() => {
              if (confirm(`Delete workflow "${name || workflow.name}"? This cannot be undone.`)) {
                void deleteWorkflow.mutateAsync(id).then(() => router.push("/workflows"));
              }
            }}
            className="w-full h-10 rounded-xl text-xs text-muted-foreground hover:text-red-600 dark:hover:text-red-400 transition-colors flex items-center justify-center gap-2"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete workflow
          </button>
        </div>
      </div>

      <Drawer
        open={showVersions}
        onClose={() => setShowVersions(false)}
        label="Version history"
        title={<h3 className="text-lg font-semibold text-foreground">Version history</h3>}
      >
        <div className="p-6 space-y-3">
                {(versions ?? []).slice().reverse().map((version) => (
                  <div key={version.version_id} className="rounded-2xl border border-border bg-muted/40 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          v{version.version_number} · {version.name}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {version.note ?? "saved"} · {timeAgo(version.created_at)}
                        </p>
                      </div>
                      <button
                        onClick={() =>
                          void restoreVersion
                            .mutateAsync({ id, version: version.version_number })
                            .then((restored) => {
                              setDraft(restored.definition);
                              setSavedSnapshot(JSON.stringify(restored.definition));
                              setName(restored.name);
                              setShowVersions(false);
                            })
                            .catch(() => undefined)
                        }
                        disabled={restoreVersion.isPending}
                        className="h-9 px-3 rounded-xl border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 disabled:opacity-50 transition-colors shrink-0"
                      >
                        Restore
                      </button>
                    </div>
                  </div>
                ))}
                {(versions ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-10">No versions yet.</p>
                )}
        </div>
      </Drawer>
    </div>
  );
}

function GitForkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="18" r="3" />
      <circle cx="6" cy="6" r="3" />
      <circle cx="18" cy="6" r="3" />
      <path d="M18 9v1a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9" />
      <path d="M12 12v3" />
    </svg>
  );
}

function reportSummary(detail: Record<string, unknown>): string {
  if (typeof detail.execution_id === "string") return `call ${String(detail.execution_id).slice(0, 12)}…`;
  if (typeof detail.decision === "string") return String(detail.decision);
  if (typeof detail.note === "string") return "stubbed";
  if (typeof detail.status === "string" && detail.status !== "ok") return String(detail.status);
  if (typeof detail.waited_s === "number") return `${detail.waited_s}s wait`;
  return "";
}

function StepInspector({
  node,
  nodes,
  agents,
  outgoing,
  onAddEdge,
  onDeleteEdge,
  onPatch,
  onPatchConfig,
}: {
  node: WorkflowNode;
  nodes: WorkflowNode[];
  agents: { id: string; name: string }[];
  outgoing: WorkflowEdge[];
  onAddEdge: (toId: string, label: string) => void;
  onDeleteEdge: (edge: WorkflowEdge) => void;
  onPatch: (update: Partial<WorkflowNode>) => void;
  onPatchConfig: (update: Record<string, unknown>) => void;
}) {
  const [edgeTarget, setEdgeTarget] = useState("");
  const [edgeLabel, setEdgeLabel] = useState("");

  return (
    <div className="rounded-[2rem] border border-border bg-card p-5 space-y-4">
      <p className="font-mono text-sm font-semibold text-foreground">{node.id}</p>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">Label</span>
        <input
          value={node.label}
          onChange={(event) => onPatch({ label: event.target.value })}
          aria-label="Step label"
          className={fieldStyles.fieldSm}
        />
      </label>

      {node.type === "agent" && (
        <>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">Agent</span>
            <select
              value={String(node.config.agent_id ?? "")}
              onChange={(event) => onPatchConfig({ agent_id: event.target.value })}
              aria-label="Step agent"
              className={fieldStyles.fieldSm}
            >
              <option value="">Select agent…</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </label>
          <JsonConfigField
            label="Variables"
            value={node.config.variables ?? {}}
            onParsed={(parsed) => onPatchConfig({ variables: parsed })}
          />
        </>
      )}

      {node.type === "extraction" && (
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">Fields (comma-separated)</span>
          <input
            value={Array.isArray(node.config.fields) ? (node.config.fields as string[]).join(", ") : ""}
            onChange={(event) =>
              onPatchConfig({
                fields: event.target.value.split(",").map((field) => field.trim()).filter(Boolean),
              })
            }
            placeholder="customer_name, interest"
            aria-label="Extraction fields"
            className={cn(fieldStyles.fieldSm, "font-mono text-xs")}
          />
        </label>
      )}

      {node.type === "api" && (
        <>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">Method</span>
            <select
              value={String(node.config.method ?? "POST")}
              onChange={(event) => onPatchConfig({ method: event.target.value })}
              aria-label="API method"
              className={fieldStyles.fieldSm}
            >
              <option value="POST">POST</option>
              <option value="GET">GET</option>
              <option value="PUT">PUT</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">URL</span>
            <input
              value={String(node.config.url ?? "")}
              onChange={(event) => onPatchConfig({ url: event.target.value })}
              placeholder="https://…"
              aria-label="API URL"
              className={cn(fieldStyles.fieldSm, "font-mono text-xs")}
            />
          </label>
          <JsonConfigField
            label="Body"
            value={node.config.body ?? {}}
            onParsed={(parsed) => onPatchConfig({ body: parsed })}
          />
        </>
      )}

      {node.type === "wait" && (
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">Seconds (max 30 in simulation)</span>
          <input
            value={String(node.config.seconds ?? 5)}
            onChange={(event) => onPatchConfig({ seconds: Number(event.target.value) || 0 })}
            inputMode="numeric"
            aria-label="Wait seconds"
            className={fieldStyles.fieldSm}
          />
        </label>
      )}

      {node.type === "retry" && (
        <>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">Target step</span>
            <select
              value={String(node.config.target_node_id ?? "")}
              onChange={(event) => onPatchConfig({ target_node_id: event.target.value })}
              aria-label="Retry target"
              className={cn(fieldStyles.fieldSm, "font-mono text-xs")}
            >
              <option value="">Select step…</option>
              {nodes
                .filter((candidate) => candidate.id !== node.id)
                .map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.id}
                  </option>
                ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">Max attempts</span>
            <input
              value={String(node.config.max_attempts ?? 1)}
              onChange={(event) => onPatchConfig({ max_attempts: Number(event.target.value) || 1 })}
              inputMode="numeric"
              aria-label="Max retry attempts"
              className={fieldStyles.fieldSm}
            />
          </label>
        </>
      )}

      {node.type === "whatsapp" && (
        <>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">To (blank = call contact)</span>
            <input
              value={String(node.config.to ?? "")}
              onChange={(event) => onPatchConfig({ to: event.target.value })}
              placeholder="+911234567890"
              aria-label="WhatsApp recipient"
              className={cn(fieldStyles.fieldSm, "font-mono text-xs")}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">Template</span>
            <input
              value={String(node.config.template ?? "")}
              onChange={(event) => onPatchConfig({ template: event.target.value })}
              placeholder="follow_up_v1"
              aria-label="WhatsApp template"
              className={cn(fieldStyles.fieldSm, "font-mono text-xs")}
            />
          </label>
        </>
      )}

      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Routes ({outgoing.length})</p>
        {outgoing.map((edge, index) => (
          <div key={index} className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2">
            <span className="font-mono text-xs text-foreground">→ {edge.to_node}</span>
            {edge.label && (
              <span className="text-[10px] font-mono uppercase tracking-wider text-ember-700 dark:text-ember-300">
                {edge.label.replace("_", " ")}
              </span>
            )}
            <button
              onClick={() => onDeleteEdge(edge)}
              aria-label={`Delete route to ${edge.to_node}`}
              className="ml-auto p-1.5 rounded-lg text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        <div className="flex gap-2">
          <select
            value={edgeTarget}
            onChange={(event) => setEdgeTarget(event.target.value)}
            aria-label="New route target"
            className={cn(fieldStyles.fieldSm, "h-9 font-mono text-xs flex-1")}
          >
            <option value="">Route to…</option>
            {nodes
              .filter((candidate) => candidate.id !== node.id)
              .map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.id}
                </option>
              ))}
          </select>
          <select
            value={edgeLabel}
            onChange={(event) => setEdgeLabel(event.target.value)}
            aria-label="Route condition"
            className={cn(fieldStyles.fieldSm, "h-9 text-xs w-32")}
          >
            <option value="">always</option>
            <option value="on_success">on success</option>
            <option value="on_failure">on failure</option>
          </select>
          <button
            onClick={() => {
              if (edgeTarget) {
                onAddEdge(edgeTarget, edgeLabel);
                setEdgeTarget("");
                setEdgeLabel("");
              }
            }}
            disabled={!edgeTarget}
            className="h-9 px-3 rounded-xl border border-border text-xs text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors flex items-center gap-1 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </div>
      </div>
    </div>
  );
}

function JsonConfigField({
  label,
  value,
  onParsed,
}: {
  label: string;
  value: unknown;
  onParsed: (parsed: Record<string, unknown>) => void;
}) {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const shown = text ?? JSON.stringify(value ?? {}, null, 2);
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-muted-foreground">{label} (JSON)</span>
      <textarea
        value={shown}
        onChange={(event) => {
          setText(event.target.value);
          try {
            const parsed = JSON.parse(event.target.value || "{}");
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
              onParsed(parsed as Record<string, unknown>);
              setError(false);
            } else {
              setError(true);
            }
          } catch {
            setError(true);
          }
        }}
        rows={3}
        aria-label={label}
        spellCheck={false}
        className={cn(
          "w-full border rounded-xl px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ember-400/50 resize-y",
          error ? "border-red-500/50 bg-red-500/5" : "bg-muted/50 border-border"
        )}
      />
      {error && <span className="text-[11px] text-red-600 dark:text-red-400">Must be a JSON object.</span>}
    </label>
  );
}

function CampaignPanel({ workflowId }: { workflowId: string }) {
  const { data: campaigns, refetch } = useCampaigns();
  const createCampaign = useCreateCampaign();
  const startCampaign = useStartCampaign();
  const stopCampaign = useStopCampaign();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setCampaignName] = useState("");
  const [csvText, setCsvText] = useState("to_number,customer_name\n+911234567890,Asha");
  const [phoneColumn, setPhoneColumn] = useState("to_number");
  const [formError, setFormError] = useState<string | null>(null);

  const mine = (campaigns ?? []).filter((campaign) => campaign.workflow_id === workflowId);
  const { data: runs } = useCampaignRuns(expandedId ?? "", expandedId !== null);

  const handleCreate = async () => {
    setFormError(null);
    try {
      const parsed = parseCsv(csvText);
      if (!parsed.headers.includes(phoneColumn)) {
        setFormError(`Column "${phoneColumn}" not found in CSV.`);
        return;
      }
      const entries = parsed.rows
        .map((row) => {
          const variables: Record<string, string> = {};
          parsed.headers.forEach((header) => {
            if (header !== phoneColumn) variables[header] = row[header];
          });
          return { to_number: (row[phoneColumn] ?? "").trim(), variables };
        })
        .filter((entry) => entry.to_number);
      if (entries.length === 0) {
        setFormError("No rows with a phone number.");
        return;
      }
      await createCampaign.mutateAsync({ workflow_id: workflowId, name: name.trim() || "Campaign", entries });
      setCampaignName("");
      setShowForm(false);
      refetch();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not parse CSV.");
    }
  };

  return (
    <div className="rounded-[2rem] border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">Campaigns</p>
        <button
          onClick={() => setShowForm((value) => !value)}
          className="h-9 px-3 rounded-xl border border-border text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" /> New
        </button>
      </div>

      {showForm && (
        <div className="space-y-2 rounded-2xl border border-border bg-muted/40 p-4">
          <input
            value={name}
            onChange={(event) => setCampaignName(event.target.value)}
            placeholder="Campaign name"
            aria-label="Campaign name"
            className={fieldStyles.fieldSm}
          />
          <textarea
            value={csvText}
            onChange={(event) => setCsvText(event.target.value)}
            rows={4}
            aria-label="Campaign CSV"
            spellCheck={false}
            className="w-full border border-border rounded-xl px-3 py-2 font-mono text-xs text-foreground bg-card placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ember-400/50 resize-y"
          />
          <input
            value={phoneColumn}
            onChange={(event) => setPhoneColumn(event.target.value)}
            aria-label="Phone column"
            placeholder="Phone column"
            className={cn(fieldStyles.fieldSm, "font-mono text-xs")}
          />
          {formError && <p className="text-xs text-red-700 dark:text-red-400">{formError}</p>}
          <button
            onClick={() => void handleCreate().catch(() => undefined)}
            disabled={createCampaign.isPending}
            className="w-full h-10 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {createCampaign.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Create campaign
          </button>
        </div>
      )}

      {mine.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground text-center py-4">No campaigns yet.</p>
      )}

      {mine.map((campaign) => {
        const done = campaign.stats.completed + campaign.stats.failed;
        const progress = campaign.stats.total > 0 ? Math.round((done / campaign.stats.total) * 100) : 0;
        const expanded = expandedId === campaign.campaign_id;
        return (
          <div key={campaign.campaign_id} className="rounded-2xl border border-border bg-muted/40 p-4 space-y-3">
            <button
              onClick={() => setExpandedId(expanded ? null : campaign.campaign_id)}
              className="w-full flex items-center justify-between gap-3 text-left"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{campaign.name}</p>
                <p className="text-xs font-mono text-muted-foreground">
                  {campaign.status} · {done}/{campaign.stats.total}
                </p>
              </div>
              <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", expanded && "rotate-180")} />
            </button>
            <ProgressBar value={progress} />
            <div className="flex gap-2">
              {(campaign.status === "draft" || campaign.status === "scheduled") && (
                <button
                  onClick={() =>
                    void startCampaign
                      .mutateAsync(campaign.campaign_id)
                      .then(() => {
                        notify.success("Campaign started");
                        refetch();
                      })
                      .catch(() => undefined)
                  }
                  disabled={startCampaign.isPending}
                  className="h-9 px-3 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5" /> Start
                </button>
              )}
              {campaign.status === "running" && (
                <button
                  onClick={() =>
                    void stopCampaign
                      .mutateAsync(campaign.campaign_id)
                      .then(() => {
                        notify.success("Campaign stopped");
                        refetch();
                      })
                      .catch(() => undefined)
                  }
                  disabled={stopCampaign.isPending}
                  className="h-9 px-3 rounded-xl border border-border text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5"
                >
                  <Square className="w-3.5 h-3.5" /> Stop
                </button>
              )}
            </div>
            {expanded && (
              <div className="space-y-1.5 pt-1">
                {(runs ?? []).map((run) => (
                  <div
                    key={run.run_id}
                    className="flex items-center justify-between gap-2 text-xs rounded-xl bg-card border border-border px-3 py-2"
                  >
                    <span className="font-mono text-muted-foreground truncate">
                      {String(run.contact.to_number ?? run.run_id)}
                    </span>
                    <span
                      className={cn(
                        "font-mono shrink-0",
                        run.status === "completed" ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"
                      )}
                    >
                      {run.status} · {run.reports.length} steps
                    </span>
                  </div>
                ))}
                {(runs ?? []).length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">No runs yet.</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
