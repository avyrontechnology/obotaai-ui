"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { GitFork, Loader2, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/common/page-header";
import { timeAgo } from "@/lib/format";
import { ErrorState } from "@/components/common/error-state";
import { useCreateGraph, useDeleteGraph, useGraphs } from "@/services/platform/graphs";
import { useRouter } from "next/navigation";

export default function GraphsPage() {
  const router = useRouter();
  const { data: graphs, isLoading, error, refetch } = useGraphs();
  const createGraph = useCreateGraph();
  const deleteGraph = useDeleteGraph();
  const [name, setName] = useState("");
  const [showForm, setShowForm] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    const graph = await createGraph.mutateAsync({
      name: name.trim(),
      definition: {
        agent_information: "",
        start_node_id: "greet",
        variables: {},
        nodes: [
          {
            id: "greet",
            node_type: "llm",
            prompt: "Greet the caller warmly.",
            edges: [],
          },
        ],
      },
    });
    router.push(`/graphs/${graph.graph_id}`);
  };

  return (
    <div className="flex flex-col flex-1 min-h-[100dvh] max-w-7xl mx-auto w-full pt-12 pb-32 px-4 md:px-8">
      <PageHeader
        title="Graph"
        accent="Agents"
        description="Structured multi-step conversations. Build visually, dry-run, deploy to the engine."
        actions={
          <button
            onClick={() => setShowForm((value) => !value)}
            className="h-11 px-6 rounded-2xl bg-primary text-primary-foreground font-medium text-sm shadow-lg transition-all hover:bg-primary/90 flex items-center gap-2 self-start md:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>New Graph</span>
          </button>
        }
      />

      {showForm && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex gap-2 max-w-xl"
        >
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void handleCreate().catch(() => undefined);
            }}
            placeholder="Graph name, e.g. Support triage"
            aria-label="Graph name"
            className="flex-1 h-11 px-4 bg-card border border-border rounded-2xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ember-400/50"
          />
          <button
            onClick={() => void handleCreate().catch(() => undefined)}
            disabled={createGraph.isPending || !name.trim()}
            className="h-11 px-5 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 flex items-center gap-2"
          >
            {createGraph.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Create
          </button>
        </motion.div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-48 rounded-[2rem] bg-card border border-border animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message="Failed to load graphs." onRetry={() => refetch()} />
      ) : (graphs ?? []).length === 0 && !showForm ? (
        <p className="text-sm text-muted-foreground rounded-[2rem] border border-dashed border-border p-10 text-center">
          No graphs yet. Create one to design a structured conversation.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(graphs ?? []).map((graph) => (
            <div
              key={graph.graph_id}
              className="group relative p-6 bg-card border border-border rounded-[2rem] transition-colors hover:bg-muted/40"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <GitFork className="w-4 h-4 text-ember-700 dark:text-ember-300" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold tracking-tight text-foreground truncate">{graph.name}</h3>
                  <p className="text-xs font-mono text-muted-foreground">
                    {graph.definition.nodes.length} nodes · {timeAgo(graph.updated_at)}
                  </p>
                </div>
                <button
                  onClick={() => void deleteGraph.mutateAsync(graph.graph_id)}
                  aria-label={`Delete ${graph.name}`}
                  className="p-2 rounded-xl text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <Link
                href={`/graphs/${graph.graph_id}`}
                className="block h-10 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors text-center leading-10"
              >
                Open builder
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
