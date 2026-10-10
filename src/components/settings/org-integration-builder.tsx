"use client";

import { useState } from "react";
import { PlugZap, Webhook } from "lucide-react";
import { Modal } from "@/components/common/modal";
import { CustomApiBuilder } from "@/components/settings/custom-api-builder";
import { McpServerBuilder } from "@/components/settings/mcp-server-builder";
import { cn } from "@/lib/utils";

/**
 * Pure helpers stay importable from this module (existing tests).
 * New code should import from `@/lib/integrations/builder-utils`.
 */
export {
  findDuplicateToolNames,
  initialBuilderAuth as initialAuth,
  parseParametersJson,
  slugifyProvider,
  validateHttpUrl,
  validateProviderName,
  validateToolEntry,
  type BuilderAuthState,
  type BuilderAuthType,
  type BuilderToolEntry,
} from "@/lib/integrations/builder-utils";

/**
 * Backward-compatible entry point: the old 4-in-1 wizard is now a
 * mode picker over two focused builders (one modal at a time).
 * Prefer rendering CustomApiBuilder / McpServerBuilder directly.
 */
export function IntegrationBuilder({
  onClose,
  initialMode = "http",
}: {
  onClose: () => void;
  initialMode?: "http" | "mcp";
}) {
  const [mode, setMode] = useState<"http" | "mcp">(initialMode);
  const [launched, setLaunched] = useState(false);

  if (launched) {
    return mode === "http" ? <CustomApiBuilder onClose={onClose} /> : <McpServerBuilder onClose={onClose} />;
  }

  return (
    <Modal
      open
      onClose={onClose}
      label="New integration"
      className="max-w-md space-y-4"
      title={<h4 className="font-semibold text-foreground">New integration</h4>}
    >
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Integration type">
        {(
          [
            { value: "http", title: "Custom API", hint: "REST + your tool schemas", Icon: Webhook },
            { value: "mcp", title: "MCP server", hint: "Auto-discover tools", Icon: PlugZap },
          ] as const
        ).map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={mode === option.value}
            onClick={() => setMode(option.value)}
            className={cn(
              "p-4 rounded-2xl border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none min-w-0",
              mode === option.value
                ? "border-primary/40 bg-primary/10"
                : "border-border hover:border-muted-foreground/40"
            )}
          >
            <option.Icon className="w-4 h-4 text-primary mb-2" aria-hidden="true" />
            <span className="block text-sm font-semibold text-foreground">{option.title}</span>
            <span className="block text-[11px] text-muted-foreground mt-0.5">{option.hint}</span>
          </button>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        {mode === "http"
          ? "Define every tool schema yourself — best for REST APIs."
          : "Point at an MCP server — tools discover themselves on publish."}
      </p>
      <button
        onClick={() => setLaunched(true)}
        className="w-full h-11 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
      >
        Continue
      </button>
    </Modal>
  );
}
