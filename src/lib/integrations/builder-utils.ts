/**
 * Shared pure helpers for the MCP / custom-integration builders.
 * Extracted from `org-integration-builder.tsx` so the three flows
 * (connect existing, build custom API, register MCP server) share
 * one validation language. No hooks here — unit-testable.
 */

export type BuilderAuthType = "none" | "api_key" | "bearer" | "basic" | "oauth2" | "custom";

export interface BuilderToolEntry {
  key: number;
  name: string;
  description: string;
  method: string;
  path: string;
  parametersText: string;
}

export interface BuilderAuthState {
  type: BuilderAuthType;
  location: string;
  headerName: string;
  username: string;
  secret: string;
  issuerUrl: string;
}

export const initialBuilderAuth = (): BuilderAuthState => ({
  type: "api_key",
  location: "header",
  headerName: "X-API-Key",
  username: "",
  secret: "",
  issuerUrl: "",
});

/** Parse a parameters textarea into a JSON object (pure, unit-tested).
 *  Empty means `{}`; anything else must decode to a JSON object. */
export function parseParametersJson(text: string): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  const trimmed = text.trim();
  if (!trimmed) return { ok: true, value: {} };
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return { ok: false, error: "Parameters must be a JSON object." };
    return { ok: true, value: parsed as Record<string, unknown> };
  } catch {
    return { ok: false, error: "Parameters are not valid JSON." };
  }
}

/** Validate one tool entry; returns identifier-only problems (never values). */
export function validateToolEntry(entry: BuilderToolEntry): string[] {
  const problems: string[] = [];
  if (!entry.name.trim() || /[/:\s]/.test(entry.name)) problems.push("name");
  if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(entry.method)) problems.push("method");
  if (entry.path && !entry.path.startsWith("/")) problems.push("path");
  if (!parseParametersJson(entry.parametersText).ok) problems.push("parameters");
  return problems;
}

/** Provider slug: lowercase, digits/hyphens only. Used as vault key + registry id. */
export function slugifyProvider(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function validateProviderName(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return "Give the provider a name.";
  if (trimmed.length < 2) return "Use at least 2 characters.";
  if (trimmed.length > 64) return "Keep it under 64 characters.";
  const slug = slugifyProvider(trimmed);
  if (!slug) return "Use letters or digits — e.g. github.";
  if (slug !== trimmed.toLowerCase().replace(/[\s_]+/g, "-"))
    return "Letters, digits and hyphens read best as an id.";
  return null;
}

export function validateHttpUrl(raw: string, { required, label }: { required: boolean; label: string }): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return required ? `${label} is required.` : null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:")
      return `${label} must start with http(s)://.`;
  } catch {
    return `${label} is not a valid URL.`;
  }
  return null;
}

/** Duplicate tool names inside one custom API (case-insensitive). */
export function findDuplicateToolNames(tools: readonly BuilderToolEntry[]): Set<string> {
  const seen = new Map<string, number>();
  const dupes = new Set<string>();
  for (const entry of tools) {
    const name = entry.name.trim().toLowerCase();
    if (!name) continue;
    seen.set(name, (seen.get(name) ?? 0) + 1);
    if ((seen.get(name) ?? 0) > 1) dupes.add(name);
  }
  return dupes;
}
