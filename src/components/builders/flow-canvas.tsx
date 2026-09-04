"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CanvasEdge {
  from: string;
  to: string;
  label?: string;
}

interface FlowCanvasProps<T extends { id: string }> {
  nodes: T[];
  edges: CanvasEdge[];
  startId?: string;
  selectedId: string | null;
  connectFrom: string | null;
  onSelect: (id: string | null) => void;
  onConnectClick: (id: string) => void;
  onDelete: (id: string) => void;
  renderNode: (node: T) => ReactNode;
}

const NODE_W = 240;
const NODE_H = 96;
const GAP_X = 72;
const GAP_Y = 28;

interface Position {
  x: number;
  y: number;
}

function layout<T extends { id: string }>(nodes: T[], edges: CanvasEdge[], startId?: string): Map<string, Position> {
  const positions = new Map<string, Position>();
  const idSet = new Set(nodes.map((node) => node.id));
  const start = (startId && idSet.has(startId) ? startId : nodes[0]?.id) ?? null;

  const depth = new Map<string, number>();
  const queue: string[] = start ? [start] : [];
  if (start) depth.set(start, 0);
  while (queue.length > 0) {
    const current = queue.shift() as string;
    const currentDepth = depth.get(current) as number;
    for (const edge of edges) {
      if (edge.from === current && idSet.has(edge.to) && !depth.has(edge.to)) {
        depth.set(edge.to, currentDepth + 1);
        queue.push(edge.to);
      }
    }
  }
  nodes.forEach((node) => {
    if (!depth.has(node.id)) depth.set(node.id, 0);
  });

  const columns = new Map<number, string[]>();
  nodes.forEach((node) => {
    const column = depth.get(node.id) as number;
    if (!columns.has(column)) columns.set(column, []);
    (columns.get(column) as string[]).push(node.id);
  });
  columns.forEach((ids, column) => {
    ids.forEach((id, row) => {
      positions.set(id, { x: 24 + column * (NODE_W + GAP_X), y: 24 + row * (NODE_H + GAP_Y) });
    });
  });
  return positions;
}

function EdgePath({ from, to, label, active }: { from: Position; to: Position; label?: string; active: boolean }) {
  const x1 = from.x + NODE_W;
  const y1 = from.y + NODE_H / 2;
  const x2 = to.x;
  const y2 = to.y + NODE_H / 2;
  const midX = (x1 + x2) / 2;
  const path = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
  return (
    <g>
      <path
        d={path}
        fill="none"
        strokeWidth={active ? 2.5 : 1.5}
        className={active ? "stroke-primary" : "stroke-border"}
      />
      <circle cx={x2} cy={y2} r={3.5} className={active ? "fill-primary" : "fill-muted-foreground/50"} />
      {label && (
        <g transform={`translate(${(x1 + x2) / 2},${(y1 + y2) / 2 - 10})`}>
          <rect x={-34} y={-11} width={68} height={20} rx={10} className="fill-card stroke-border" strokeWidth={1} />
          <text textAnchor="middle" dominantBaseline="central" className="fill-muted-foreground" fontSize={10} fontFamily="monospace">
            {label.length > 12 ? `${label.slice(0, 11)}…` : label}
          </text>
        </g>
      )}
    </g>
  );
}

export function FlowCanvas<T extends { id: string }>({
  nodes,
  edges,
  startId,
  selectedId,
  connectFrom,
  onSelect,
  onConnectClick,
  onDelete,
  renderNode,
}: FlowCanvasProps<T>) {
  const positions = layout(nodes, edges, startId);
  const columns = positions.size > 0 ? Math.max(...[...positions.values()].map((p) => p.x)) : 0;
  const rows = positions.size > 0 ? Math.max(...[...positions.values()].map((p) => p.y)) : 0;
  const width = columns + NODE_W + 48;
  const height = Math.max(rows + NODE_H + 48, 320);

  return (
    <div
      className="relative w-full overflow-auto custom-scrollbar rounded-[2rem] border border-border bg-muted/30"
      style={{
        backgroundImage: "radial-gradient(circle, rgba(100,116,139,0.25) 1px, transparent 1px)",
        backgroundSize: "22px 22px",
      }}
      onClick={() => onSelect(null)}
    >
      <div className="relative" style={{ width, height }}>
        <svg className="absolute inset-0" width={width} height={height}>
          {edges.map((edge, index) => {
            const from = positions.get(edge.from);
            const to = positions.get(edge.to);
            if (!from || !to) return null;
            const active = selectedId === edge.from || selectedId === edge.to;
            return <EdgePath key={index} from={from} to={to} label={edge.label} active={active} />;
          })}
        </svg>
        {nodes.map((node) => {
          const position = positions.get(node.id);
          if (!position) return null;
          const selected = selectedId === node.id;
          const isConnectSource = connectFrom === node.id;
          return (
            <div
              key={node.id}
              className="absolute"
              style={{ left: position.x, top: position.y, width: NODE_W }}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                onClick={() => onConnectClick(node.id)}
                className={cn(
                  "relative w-full text-left rounded-2xl border bg-card shadow-sm transition-all hover:shadow-md",
                  selected
                    ? "border-primary/60 shadow-lg shadow-primary/10"
                    : "border-border hover:border-muted-foreground/40",
                  isConnectSource && "border-ember-400 shadow-[0_0_20px_rgba(251,108,0,0.3)]"
                )}
              >
                <div className="p-3 min-h-[96px]">{renderNode(node)}</div>
                {selected && (
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label={`Delete node ${node.id}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onDelete(node.id);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.stopPropagation();
                        onDelete(node.id);
                      }
                    }}
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center shadow hover:bg-red-700 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </span>
                )}
              </button>
              {startId === node.id && (
                <span className="absolute -top-2 left-3 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-primary text-primary-foreground">
                  Start
                </span>
              )}
            </div>
          );
        })}
        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-sm text-muted-foreground">Add your first node to begin.</p>
          </div>
        )}
      </div>
    </div>
  );
}
