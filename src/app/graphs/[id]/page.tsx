"use client";

import { use, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Bot,
  Check,
  GitFork,
  History,
  Loader2,
  Megaphone,
  Play,
  Plus,
  Rocket,
  ShieldCheck,
  Split,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FlowCanvas } from "@/components/builders/flow-canvas";
import { Drawer, Modal } from "@/components/common/modal";
import { ValidationPanel } from "@/components/common/validation-panel";
import {
  useDeleteGraph,
  useDeployGraph,
  useDryRunGraph,
  useGraph,
  useGraphVersions,
  useRestoreGraphVersion,
  useUpdateGraph,
  useValidateGraph,
} from "@/services/platform/graphs";
import type {
  DryRunResult,
  GraphDefinition,
  GraphEdge,
  GraphNode,
  ValidationResult,
} from "@/lib/schemas/builders";
import { timeAgo } from "@/lib/format";
import { notify } from "@/lib/notify";
import { fieldStyles } from "@/lib/field-styles";
import { cn } from "@/lib/utils";

const NODE_META = {
  llm: { label: "LLM", icon: Bot, hint: "Generates a reply from its prompt." },
  static: { label: "Static", icon: Megaphone, hint: "Plays a fixed message, no LLM cost." },
  router: { label: "Router", icon: Split, hint: "Dispatches silently; needs a catch-all edge." },
} as const;

type NodeType = keyof typeof NODE_META;


function newNodeId(nodes: GraphNode[]): string {
  let index = nodes.length + 1;
  while (nodes.some((node) => node.id === `node-${index}`)) index++;
  return `node-${index}`;
}

function GraphNodeCard({ node }: { node: GraphNode }) {
  const meta = NODE_META[node.node_type];
  const Icon = meta.icon;
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4 text-ember-700 dark:text-ember-300 shrink-0" />
        <span className="font-mono text-xs font-semibold text-foreground truncate">{node.id}</span>
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground ml-auto shrink-0">
          {meta.label}
        </span>
      </div>
      <p className="text-xs text-muted-foreground truncate">
        {node.node_type === "static"
          ? node.static_message || "No message set"
          : node.node_type === "router"
            ? `${node.edges.length} route${node.edges.length === 1 ? "" : "s"}`
            : node.prompt
              ? `${node.prompt.slice(0, 48)}${node.prompt.length > 48 ? "…" : ""}`
              : "No prompt set"}
      </p>
    </div>
  );
}

export default function GraphBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: graph, isLoading } = useGraph(id);
  const updateGraph = useUpdateGraph();
  const deleteGraph = useDeleteGraph();
  const validateGraph = useValidateGraph();
  const dryRunGraph = useDryRunGraph();
  const deployGraph = useDeployGraph();
  const { data: versions, refetch: refetchVersions } = useGraphVersions(id, false);

  const [draft, setDraft] = useState<GraphDefinition | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const [name, setName] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [dryRun, setDryRun] = useState<DryRunResult | null>(null);
  const [showVersions, setShowVersions] = useState(false);
  const [showDeploy, setShowDeploy] = useState(false);
  const [deployName, setDeployName] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (graph && draft === null) {
    const next = graph.definition;
    setDraft(next);
    setSavedSnapshot(JSON.stringify(next));
    setName(graph.name);
  }

  const dirty = draft !== null && JSON.stringify(draft) !== savedSnapshot;
  const selected = draft?.nodes.find((node) => node.id === selectedId) ?? null;

  const patchDefinition = (update: Partial<GraphDefinition>) => {
    setDraft((prev) => (prev ? { ...prev, ...update } : prev));
    setSavedFlash(false);
    setValidation(null);
  };

  const patchNode = (nodeId: string, update: Partial<GraphNode>) => {
    setDraft((prev) =>
      prev ? { ...prev, nodes: prev.nodes.map((node) => (node.id === nodeId ? { ...node, ...update } : node)) } : prev
    );
    setSavedFlash(false);
    setValidation(null);
  };

  const addNode = (nodeType: NodeType) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const node: GraphNode = {
        id: newNodeId(prev.nodes),
        node_type: nodeType,
        description: null,
        prompt: "",
        static_message: null,
        repeat_after_silence_seconds: null,
        edges: [],
      };
      return {
        ...prev,
        nodes: [...prev.nodes, node],
        start_node_id: prev.start_node_id || node.id,
      };
    });
    setSavedFlash(false);
  };

  const deleteNode = (nodeId: string) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const nodes = prev.nodes.filter((node) => node.id !== nodeId);
      return {
        ...prev,
        nodes: nodes.map((node) => ({ ...node, edges: node.edges.filter((edge) => edge.to_node_id !== nodeId) })),
        start_node_id: prev.start_node_id === nodeId ? (nodes[0]?.id ?? "") : prev.start_node_id,
      };
    });
    if (selectedId === nodeId) setSelectedId(null);
    if (connectFrom === nodeId) setConnectFrom(null);
    setSavedFlash(false);
  };

  const addEdge = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        nodes: prev.nodes.map((node) =>
          node.id === fromId &&
          !node.edges.some((edge) => edge.to_node_id === toId)
            ? {
                ...node,
                edges: [...node.edges, { to_node_id: toId, condition: "", label: null, condition_type: "llm" as const }],
              }
            : node
        ),
      };
    });
    setSavedFlash(false);
  };

  const patchEdge = (nodeId: string, index: number, update: Partial<GraphEdge>) => {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        nodes: prev.nodes.map((node) =>
          node.id === nodeId
            ? { ...node, edges: node.edges.map((edge, i) => (i === index ? { ...edge, ...update } : edge)) }
            : node
        ),
      };
    });
    setSavedFlash(false);
  };

  const deleteEdge = (nodeId: string, index: number) => {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        nodes: prev.nodes.map((node) =>
          node.id === nodeId ? { ...node, edges: node.edges.filter((_, i) => i !== index) } : node
        ),
      };
    });
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
      const updated = await updateGraph.mutateAsync({ id, name: name ?? undefined, definition: draft });
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
      setValidation(await validateGraph.mutateAsync(id));
    } catch {
      setActionError("Validation failed. Is the backend running?");
    }
  };

  const handleDryRun = async () => {
    setActionError(null);
    try {
      if (dirty) await handleSave();
      setDryRun(await dryRunGraph.mutateAsync(id));
    } catch {
      setActionError("Dry-run failed. Is the backend running?");
    }
  };

  const handleDeploy = async () => {
    if (!deployName.trim()) return;
    setActionError(null);
    try {
      if (dirty) await handleSave();
      const agentId = await deployGraph.mutateAsync({ id, agent_name: deployName.trim() });
      notify.success("Graph deployed", { description: `${deployName.trim()} is ready to configure` });
      router.push(`/agents/${agentId}/configure`);
    } catch {
      setActionError("Deploy failed. Is the backend running?");
    }
  };

  if (isLoading || !graph || !draft) {
    return (
      <div className="max-w-7xl mx-auto w-full pt-6 md:pt-8 pb-16 px-4 md:px-8 space-y-4">
        <div className="h-12 w-64 rounded-2xl bg-card border border-border animate-pulse" />
        <div className="h-[500px] rounded-[2rem] bg-card border border-border animate-pulse" />
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-[100dvh] max-w-[1400px] mx-auto w-full pt-6 md:pt-8 pb-16 px-4 md:px-8">
      <Link
        href="/flows?tab=graphs"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4 w-fit"
      >
        <ArrowLeft className="w-4 h-4" /> Flows
      </Link>

      {/* Top bar */}
      <div className="flex flex-col xl:flex-row xl:items-center gap-4 mb-6 flex-wrap min-w-0">
        <input
          value={name ?? graph.name}
          onChange={(event) => {
            setName(event.target.value);
            setSavedFlash(false);
          }}
          aria-label="Graph name"
          className="h-12 px-4 text-xl font-semibold tracking-tight bg-transparent border border-transparent hover:border-border focus:border-border rounded-2xl text-foreground focus:outline-none transition-colors flex-1 min-w-[200px] max-w-md"
        />
        <div className="flex flex-wrap items-center gap-2 xl:ml-auto">
          {savedFlash && !dirty && (
            <span className="flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-400 mr-1">
              <Check className="w-4 h-4" /> Saved
            </span>
          )}
          <button
            onClick={() => void handleSave().catch(() => undefined)}
            disabled={!dirty || updateGraph.isPending}
            className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {updateGraph.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Save{dirty ? " *" : ""}
          </button>
          <button
            onClick={() => void handleValidate().catch(() => undefined)}
            disabled={validateGraph.isPending}
            className="h-10 px-4 rounded-xl bg-card border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors flex items-center gap-2"
          >
            <ShieldCheck className="w-4 h-4" /> Validate
          </button>
          <button
            onClick={() => void handleDryRun().catch(() => undefined)}
            disabled={dryRunGraph.isPending}
            className="h-10 px-4 rounded-xl bg-card border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors flex items-center gap-2"
          >
            <Play className="w-4 h-4" /> Dry-run
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
          <button
            onClick={() => {
              setDeployName(name || graph.name);
              setShowDeploy(true);
            }}
            className="h-10 px-4 rounded-xl bg-card border border-primary/30 text-sm text-ember-700 dark:text-ember-300 hover:bg-primary/10 transition-colors flex items-center gap-2"
          >
            <Rocket className="w-4 h-4" /> Deploy
          </button>
        </div>
      </div>

      {connectFrom && (
        <p className="mb-4 text-sm text-ember-700 dark:text-ember-300 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-2.5 w-fit">
          Connecting from <span className="font-mono font-semibold">{connectFrom}</span> — click a target node, or
          click it again to cancel.
        </p>
      )}

      {actionError && (
        <p className="mb-4 flex items-center gap-2 text-sm text-red-700 dark:text-red-400 rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-2.5 w-fit">
          <AlertCircle className="w-4 h-4 shrink-0" /> {actionError}
        </p>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        {/* Canvas */}
        <div className="xl:col-span-2 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground mr-1">Add node</span>
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
              <GitFork className="w-3.5 h-3.5" />
              {connectFrom ? "Cancel connect" : "Connect"}
            </button>
          </div>

          <FlowCanvas
            nodes={draft.nodes}
            edges={draft.nodes.flatMap((node) =>
              node.edges.map((edge) => ({ from: node.id, to: edge.to_node_id, label: edge.label || edge.condition }))
            )}
            startId={draft.start_node_id}
            selectedId={selectedId}
            connectFrom={connectFrom}
            onSelect={setSelectedId}
            onConnectClick={handleConnectClick}
            onDelete={deleteNode}
            renderNode={(node) => <GraphNodeCard node={node} />}
          />

          {/* Validation + dry-run results */}
          {validation && (
            <ValidationPanel
              valid={validation.valid}
              errors={validation.errors}
              warnings={validation.warnings}
              validLabel="Graph is valid"
            />
          )}

          {dryRun && (
            <div className="rounded-[2rem] border border-border bg-card p-5">
              <p className="text-sm font-semibold text-foreground mb-3">
                Dry-run path
                {dryRun.loop_detected && (
                  <span className="ml-2 text-xs font-mono text-amber-700 dark:text-amber-400">loop detected</span>
                )}
              </p>
              <div className="flex flex-wrap items-center gap-1.5 mb-4">
                {dryRun.path.map((nodeId, index) => (
                  <span key={index} className="flex items-center gap-1.5">
                    <span className="px-2.5 py-1 rounded-full text-xs font-mono bg-muted border border-border text-foreground">
                      {nodeId}
                    </span>
                    {index < dryRun.path.length - 1 && <span className="text-muted-foreground">→</span>}
                  </span>
                ))}
                {dryRun.path.length === 0 && <span className="text-sm text-muted-foreground">Empty path.</span>}
              </div>
              <div className="space-y-2">
                {dryRun.transcript_preview.map((turn, index) => (
                  <div key={index} className="text-sm rounded-xl bg-muted/50 border border-border px-3 py-2">
                    <span className="font-mono text-xs text-ember-700 dark:text-ember-300 mr-2">{turn.node}</span>
                    <span className="text-foreground">{turn.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Inspector */}
        <div className="space-y-4">
          <div className="rounded-[2rem] border border-border bg-card p-5 space-y-3">
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Graph settings</p>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-muted-foreground">Start node</span>
              <select
                value={draft.start_node_id}
                onChange={(event) => patchDefinition({ start_node_id: event.target.value })}
                aria-label="Start node"
                className={fieldStyles.fieldSm}
              >
                <option value="">—</option>
                {draft.nodes.map((node) => (
                  <option key={node.id} value={node.id}>
                    {node.id}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-muted-foreground">Routing model</span>
              <input
                value={draft.routing_model ?? ""}
                onChange={(event) => patchDefinition({ routing_model: event.target.value || null })}
                placeholder="groq/llama-3.1-8b-instant"
                aria-label="Routing model"
                className={cn(fieldStyles.fieldSm, "font-mono text-xs")}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-muted-foreground">Agent information</span>
              <textarea
                value={draft.agent_information}
                onChange={(event) => patchDefinition({ agent_information: event.target.value })}
                rows={3}
                placeholder="Overall persona and context…"
                aria-label="Agent information"
                className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ember-400/50 resize-y"
              />
            </label>
          </div>

          {selected ? (
            <NodeInspector
              node={selected}
              nodes={draft.nodes}
              onPatch={(update) => patchNode(selected.id, update)}
              onPatchEdge={(index, update) => patchEdge(selected.id, index, update)}
              onDeleteEdge={(index) => deleteEdge(selected.id, index)}
              onAddEdge={(toId) => addEdge(selected.id, toId)}
              onSetStart={() => patchDefinition({ start_node_id: selected.id })}
              isStart={draft.start_node_id === selected.id}
            />
          ) : (
            <div className="rounded-[2rem] border border-dashed border-border p-8 text-center">
              <p className="text-sm text-muted-foreground">Select a node to edit its prompt, message and routes.</p>
            </div>
          )}

          <button
            onClick={() => {
              if (confirm(`Delete graph "${name || graph.name}"? This cannot be undone.`)) {
                void deleteGraph.mutateAsync(id).then(() => router.push("/flows?tab=graphs"));
              }
            }}
            className="w-full h-10 rounded-xl text-xs text-muted-foreground hover:text-red-600 dark:hover:text-red-400 transition-colors flex items-center justify-center gap-2"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete graph
          </button>
        </div>
      </div>

      {/* Versions drawer */}
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
                      <RestoreVersionButton
                        graphId={id}
                        version={version.version_number}
                        onRestored={(restored) => {
                          setDraft(restored.definition);
                          setSavedSnapshot(JSON.stringify(restored.definition));
                          setName(restored.name);
                          setShowVersions(false);
                        }}
                      />
                    </div>
                  </div>
                ))}
                {(versions ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-10">No versions yet.</p>
                )}
        </div>
      </Drawer>

      {/* Deploy modal */}
      <Modal
        open={showDeploy}
        onClose={() => setShowDeploy(false)}
        label="Deploy graph as agent"
        title={<h3 className="text-lg font-semibold text-foreground">Deploy as agent</h3>}
        className="max-w-md space-y-4"
      >
                <p className="text-sm text-muted-foreground">
                  Creates a voice agent running this graph on the engine, then opens its settings.
                </p>
                <input
                  value={deployName}
                  onChange={(event) => setDeployName(event.target.value)}
                  placeholder="Agent name"
                  aria-label="Deployed agent name"
                  className="w-full h-11 px-4 bg-muted/50 border border-border rounded-2xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ember-400/50"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => void handleDeploy().catch(() => undefined)}
                    disabled={!deployName.trim() || deployGraph.isPending}
                    className="flex-1 h-11 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                  >
                    {deployGraph.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                    Deploy
                  </button>
                  <button
                    onClick={() => setShowDeploy(false)}
                    className="h-11 px-4 rounded-2xl border border-border text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                </div>
      </Modal>
    </div>
  );
}

function RestoreVersionButton({
  graphId,
  version,
  onRestored,
}: {
  graphId: string;
  version: number;
  onRestored: (graph: { definition: GraphDefinition; name: string }) => void;
}) {
  const restoreVersion = useRestoreGraphVersion();
  return (
    <button
      onClick={() =>
        void restoreVersion
          .mutateAsync({ id: graphId, version })
          .then((graph) => onRestored({ definition: graph.definition, name: graph.name }))
          .catch(() => undefined)
      }
      disabled={restoreVersion.isPending}
      className="h-9 px-3 rounded-xl border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 disabled:opacity-50 transition-colors shrink-0"
    >
      Restore
    </button>
  );
}

function NodeInspector({
  node,
  nodes,
  onPatch,
  onPatchEdge,
  onDeleteEdge,
  onAddEdge,
  onSetStart,
  isStart,
}: {
  node: GraphNode;
  nodes: GraphNode[];
  onPatch: (update: Partial<GraphNode>) => void;
  onPatchEdge: (index: number, update: Partial<GraphEdge>) => void;
  onDeleteEdge: (index: number) => void;
  onAddEdge: (toId: string) => void;
  onSetStart: () => void;
  isStart: boolean;
}) {
  const [edgeTarget, setEdgeTarget] = useState("");
  const candidates = nodes.filter((candidate) => candidate.id !== node.id);

  return (
    <div className="rounded-[2rem] border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-mono text-sm font-semibold text-foreground">{node.id}</p>
        {!isStart && (
          <button onClick={onSetStart} className="text-xs text-ember-700 dark:text-ember-300 hover:underline underline-offset-4">
            Set as start
          </button>
        )}
        {isStart && (
          <span className="text-[10px] font-mono uppercase tracking-wider text-ember-700 dark:text-ember-300">start</span>
        )}
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">Type</span>
        <select
          value={node.node_type}
          onChange={(event) => {
            const next = event.target.value as NodeType;
            onPatch(
              next === "router"
                ? { node_type: next, prompt: "", static_message: null }
                : { node_type: next }
            );
          }}
          aria-label="Node type"
          className={fieldStyles.fieldSm}
        >
          <option value="llm">LLM — generates replies</option>
          <option value="static">Static — plays a fixed message</option>
          <option value="router">Router — dispatches silently</option>
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">Description</span>
        <input
          value={node.description ?? ""}
          onChange={(event) => onPatch({ description: event.target.value || null })}
          placeholder="What this step does"
          aria-label="Node description"
          className={fieldStyles.fieldSm}
        />
      </label>

      {node.node_type === "llm" && (
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">Prompt</span>
          <textarea
            value={node.prompt}
            onChange={(event) => onPatch({ prompt: event.target.value })}
            rows={4}
            placeholder="Instructions for this step…"
            aria-label="Node prompt"
            className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ember-400/50 resize-y"
          />
        </label>
      )}

      {node.node_type === "static" && (
        <>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">Static message</span>
            <textarea
              value={node.static_message ?? ""}
              onChange={(event) => onPatch({ static_message: event.target.value || null })}
              rows={3}
              placeholder="Exact message to play…"
              aria-label="Static message"
              className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ember-400/50 resize-y"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">Repeat after silence (s)</span>
            <input
              value={node.repeat_after_silence_seconds ?? ""}
              onChange={(event) =>
                onPatch({
                  repeat_after_silence_seconds: event.target.value ? Number(event.target.value) : null,
                })
              }
              inputMode="decimal"
              placeholder="e.g. 8"
              aria-label="Repeat after silence seconds"
              className={fieldStyles.fieldSm}
            />
          </label>
        </>
      )}

      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Routes ({node.edges.length})</p>
        {node.edges.map((edge, index) => (
          <div key={index} className="rounded-xl border border-border bg-muted/40 p-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <select
                value={edge.to_node_id}
                onChange={(event) => onPatchEdge(index, { to_node_id: event.target.value })}
                aria-label={`Route ${index + 1} target`}
                className={cn(fieldStyles.fieldSm, "h-9 font-mono text-xs")}
              >
                {nodes
                  .filter((candidate) => candidate.id !== node.id)
                  .map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.id}
                    </option>
                  ))}
              </select>
              <select
                value={edge.condition_type}
                onChange={(event) =>
                  onPatchEdge(index, { condition_type: event.target.value as GraphEdge["condition_type"] })
                }
                aria-label={`Route ${index + 1} condition type`}
                className={cn(fieldStyles.fieldSm, "h-9 text-xs")}
              >
                <option value="llm">LLM intent</option>
                <option value="expression">Expression</option>
                <option value="unconditional">Always</option>
                <option value="event">Event</option>
              </select>
            </div>
            <input
              value={edge.condition}
              onChange={(event) => onPatchEdge(index, { condition: event.target.value })}
              placeholder="Condition, e.g. caller asks about billing"
              aria-label={`Route ${index + 1} condition`}
              className={cn(fieldStyles.fieldSm, "h-9 text-xs")}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                value={edge.label ?? ""}
                onChange={(event) => onPatchEdge(index, { label: event.target.value || null })}
                placeholder="Label (optional)"
                aria-label={`Route ${index + 1} label`}
                className={cn(fieldStyles.fieldSm, "h-9 text-xs")}
              />
              <div className="flex gap-2">
                <input
                  value={edge.priority ?? ""}
                  onChange={(event) =>
                    onPatchEdge(index, {
                      priority: event.target.value ? Number(event.target.value) : null,
                    })
                  }
                  placeholder="Priority"
                  inputMode="numeric"
                  aria-label={`Route ${index + 1} priority`}
                  className={cn(fieldStyles.fieldSm, "h-9 text-xs font-mono")}
                />
                <button
                  onClick={() => onDeleteEdge(index)}
                  aria-label={`Delete route ${index + 1}`}
                  className="h-9 w-9 shrink-0 flex items-center justify-center rounded-xl text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            {edge.condition_type === "event" && (
              <input
                value={edge.event_name ?? ""}
                onChange={(event) => onPatchEdge(index, { event_name: event.target.value || null })}
                placeholder="Event name"
                aria-label={`Route ${index + 1} event name`}
                className={cn(fieldStyles.fieldSm, "h-9 text-xs font-mono")}
              />
            )}
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
            {candidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.id}
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              if (edgeTarget) {
                onAddEdge(edgeTarget);
                setEdgeTarget("");
              }
            }}
            disabled={!edgeTarget}
            className="h-9 px-3 rounded-xl border border-border text-xs text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </div>
      </div>
    </div>
  );
}

