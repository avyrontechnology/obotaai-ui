import {
  BarChart3,
  Cpu,
  Database,
  MessageSquareText,
  Mic,
  PhoneIncoming,
  Settings,
  Volume2,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export type AgentType = "voice" | "text" | "s2s";

export type SectionId =
  | "persona"
  | "transcriber"
  | "synthesizer"
  | "llm"
  | "tools"
  | "rag"
  | "behavior"
  | "inbound"
  | "analytics";

export interface ConfigSection {
  id: SectionId;
  label: string;
  icon: LucideIcon;
  /**
   * Agent types this section applies to. Core pipeline sections are gated
   * because the backend record only carries the blocks for its own pipeline
   * (e.g. s2s records have transcriber: null) and the save transform omits
   * foreign blocks — showing them would display empty fields whose edits
   * are silently dropped. Platform panels (tools/KB/webhooks/inbound and
   * call behavior, which lives in task_config for every type) stay visible
   * for all types.
   */
  types: readonly AgentType[];
}

export interface ConfigGroup {
  id: string;
  label: string;
  sections: ConfigSection[];
}

const ALL: readonly AgentType[] = ["voice", "text", "s2s"];

export const CONFIG_GROUPS: ConfigGroup[] = [
  {
    id: "identity",
    label: "Identity & Persona",
    sections: [{ id: "persona", label: "Persona & Languages", icon: MessageSquareText, types: ALL }],
  },
  {
    id: "voice",
    label: "Voice Pipeline",
    sections: [
      { id: "transcriber", label: "Transcriber (STT)", icon: Mic, types: ["voice"] },
      { id: "synthesizer", label: "Voice (TTS / Realtime)", icon: Volume2, types: ["voice", "s2s"] },
    ],
  },
  {
    id: "brain",
    label: "Brain & Knowledge",
    sections: [
      { id: "llm", label: "LLM", icon: Cpu, types: ["voice", "text"] },
      { id: "tools", label: "Tools · /tools", icon: Wrench, types: ALL },
      { id: "rag", label: "Knowledge · /knowledgebases", icon: Database, types: ALL },
    ],
  },
  {
    id: "telephony",
    label: "Telephony & Inbound",
    sections: [
      { id: "behavior", label: "Call Behavior", icon: Settings, types: ALL },
      { id: "inbound", label: "Inbound · /inbound", icon: PhoneIncoming, types: ALL },
    ],
  },
  {
    id: "observe",
    label: "Observability",
    sections: [{ id: "analytics", label: "Webhooks · /webhooks", icon: BarChart3, types: ALL }],
  },
];

/**
 * Groups with sections filtered to the agent type; groups left empty are
 * dropped. Unknown types (e.g. legacy `other`) get every section: an empty
 * sidebar would leave the page with nowhere to go, while showing all
 * sections degrades to the pre-gating behavior.
 */
export function visibleGroupsFor(agentType: string): ConfigGroup[] {
  const known = CONFIG_GROUPS.some((group) =>
    group.sections.some((section) => (section.types as readonly string[]).includes(agentType))
  );
  if (!known) return CONFIG_GROUPS;
  return CONFIG_GROUPS.map((group) => ({
    ...group,
    sections: group.sections.filter((section) =>
      (section.types as readonly string[]).includes(agentType)
    ),
  })).filter((group) => group.sections.length > 0);
}

/** Flat list of visible section labels (screen-reader summary, tests). */
export function visibleSectionLabels(agentType: string): string[] {
  return visibleGroupsFor(agentType).flatMap((group) => group.sections.map((s) => s.label));
}
