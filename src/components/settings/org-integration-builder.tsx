"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Loader2,
  Plus,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import { Modal } from "@/components/common/modal";
import { fieldStyles } from "@/lib/field-styles";
import { cn } from "@/lib/utils";
import { notify } from "@/lib/notify";
import {
  useConnectCredential,
  useDcrRegister,
  useSaveTemplate,
  useSyncTools,
} from "@/services/platform/mcp";

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

const STEPS = ["Provider", "Auth", "Tools", "Review"] as const;

const AUTH_TYPES: { value: BuilderAuthType; label: string; hint: string }[] = [
  { value: "none", label: "None", hint: "Public endpoints, no credential." },
  { value: "api_key", label: "API key", hint: "Header or query key." },
  { value: "bearer", label: "Bearer", hint: "Authorization: Bearer token." },
  { value: "basic", label: "Basic", hint: "Username + password." },
  { value: "oauth2", label: "OAuth2", hint: "Paste a token or DCR-register." },
  { value: "custom", label: "Custom", hint: "Static header map as JSON." },
];

const initialAuth = (): BuilderAuthState => ({
  type: "api_key",
  location: "header",
  headerName: "X-API-Key",
  username: "",
  secret: "",
  issuerUrl: "",
});

function StepDots({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-1.5" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
      {STEPS.map((label, index) => (
        <span
          key={label}
          title={label}
          className={cn(
            "h-1.5 rounded-full transition-colors motion-reduce:transition-none",
            index === step ? "w-8 bg-primary" : index < step ? "w-4 bg-primary/50" : "w-4 bg-muted"
          )}
        />
      ))}
    </div>
  );
}

export function IntegrationBuilder({ onClose }: { onClose: () => void }) {
  const saveTemplate = useSaveTemplate();
  const connect = useConnectCredential();
  const dcr = useDcrRegister();
  const sync = useSyncTools();

  const [step, setStep] = useState(0);
  const [provider, setProvider] = useState("");
  const [credentialType, setCredentialType] = useState<BuilderAuthType>("api_key");
  const [transport, setTransport] = useState<"http" | "mcp">("http");
  const [baseUrl, setBaseUrl] = useState("");
  const [auth, setAuth] = useState<BuilderAuthState>(initialAuth);
  const [oauthMode, setOauthMode] = useState<"token" | "dcr">("token");
  const [tools, setTools] = useState<BuilderToolEntry[]>([]);
  const [keyCounter, setKeyCounter] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [secretOnce, setSecretOnce] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<{
    created: number;
    updated: number;
    skipped: string[];
    tool_ids: string[];
    problems: string[];
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const setAuthField = (field: keyof BuilderAuthState, value: string) =>
    setAuth((current) => ({ ...current, [field]: value }));

  const providerValid = useMemo(
    () => provider.trim().length > 0 && (transport === "http" || baseUrl.trim().length > 0),
    [provider, transport, baseUrl]
  );

  const visibleAuthTypes = useMemo(
    () =>
      transport === "mcp"
        ? AUTH_TYPES.filter((option) => option.value === "none" || option.value === "bearer" || option.value === "oauth2" || option.value === "custom")
        : AUTH_TYPES,
    [transport]
  );

  const authValid = useMemo(() => {
    if (credentialType === "none") return true;
    if (credentialType === "api_key") return auth.secret.trim().length > 0 && auth.headerName.trim().length > 0;
    if (credentialType === "bearer") return auth.secret.trim().length > 0;
    if (credentialType === "basic") return auth.username.trim().length > 0 && auth.secret.length > 0;
    if (credentialType === "oauth2")
      return oauthMode === "dcr" ? auth.issuerUrl.trim().length > 0 : auth.secret.trim().length > 0;
    return parseParametersJson(auth.secret).ok && auth.secret.trim().length > 0;
  }, [credentialType, auth, oauthMode]);

  const toolsValid = useMemo(
    () => tools.length > 0 && tools.every((entry) => validateToolEntry(entry).length === 0),
    [tools]
  );

  const canNext = step === 0 ? providerValid : step === 1 ? authValid : step === 2 ? (transport === "mcp" || toolsValid) : true;

  const switchTransport = (next: "http" | "mcp") => {
    setTransport(next);
    // MCP discovery only rides bearer/oauth2/custom (or none) — steer
    // api_key/basic picks to bearer instead of failing later at sync.
    if (next === "mcp" && (credentialType === "api_key" || credentialType === "basic")) {
      setCredentialType("bearer");
      setAuth((current) => ({ ...current, type: "bearer" }));
    }
  };

  const addTool = () =>
    setTools((current) => {
      const key = keyCounter;
      setKeyCounter(key + 1);
      return [
        ...current,
        { key, name: "", description: "", method: "POST", path: "", parametersText: '{"type":"object"}' },
      ];
    });

  const patchTool = (key: number, field: keyof BuilderToolEntry, value: string) =>
    setTools((current) => current.map((entry) => (entry.key === key ? { ...entry, [field]: value } : entry)));

  const removeTool = (key: number) => setTools((current) => current.filter((entry) => entry.key !== key));

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const handleFinish = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      // MCP templates discover live — manual entries never persist there.
      const source = transport === "mcp" ? [] : tools;
      const entries = source.map((entry) => ({
        name: entry.name.trim(),
        description: entry.description.trim(),
        method: entry.method,
        ...(entry.path.trim() ? { path: entry.path.trim() } : {}),
        parameters: (parseParametersJson(entry.parametersText).ok
          ? (parseParametersJson(entry.parametersText) as { ok: true; value: Record<string, unknown> }).value
          : {}) as Record<string, unknown>,
      }));
      await saveTemplate.mutateAsync({
        provider: provider.trim(),
        credential_type: credentialType,
        transport,
        tools_template: entries,
        oauth_config: {},
        client_config: baseUrl.trim() ? { base_url: baseUrl.trim() } : {},
      });
      if (credentialType === "oauth2" && oauthMode === "dcr") {
        const record = await dcr.mutateAsync({ issuer_url: auth.issuerUrl.trim(), provider: provider.trim() });
        if (record.client_secret_once) setSecretOnce(record.client_secret_once);
      } else if (credentialType !== "none") {
        const auth_config: Record<string, string> =
          credentialType === "api_key"
            ? { location: auth.location, name: auth.headerName.trim() || "X-API-Key" }
            : credentialType === "basic"
              ? { username: auth.username.trim() }
              : {};
        const result = await connect.mutateAsync({
          provider: provider.trim(),
          credential_type: credentialType,
          secret: auth.secret,
          ...(Object.keys(auth_config).length > 0 ? { auth_config } : {}),
        });
        setSecretOnce(result.secret_once);
      }
      const synced = await sync.mutateAsync(provider.trim());
      setSyncResult({
        created: synced.created,
        updated: synced.updated,
        skipped: [...synced.skipped],
        tool_ids: [...synced.tool_ids],
        problems: [...synced.problems],
      });
      notify.success("Integration published", {
        description: `${synced.created} created, ${synced.updated} updated`,
      });
    } catch {
      setError("Publish failed — check the provider, auth, and tool schemas, then retry.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} label="New custom integration" className="max-w-2xl space-y-4" title={
      <div className="flex items-center gap-2 min-w-0">
        <Wand2 className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
        <h4 className="font-semibold text-foreground truncate">New custom integration</h4>
      </div>
    }>
      <StepDots step={step} />

      {step === 0 && (
        <div className="space-y-3 min-w-0">
          <label className="flex flex-col gap-1.5 min-w-0">
            <span className="text-xs font-medium text-foreground">Provider</span>
            <input
              value={provider}
              onChange={(event) => setProvider(event.target.value)}
              placeholder="github"
              aria-label="Provider name"
              autoComplete="off"
              className={cn(fieldStyles.fieldSm, "font-mono text-xs min-w-0")}
            />
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {visibleAuthTypes.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  setCredentialType(option.value);
                  setAuth((current) => ({ ...current, type: option.value }));
                }}
                aria-pressed={credentialType === option.value}
                title={option.hint}
                className={cn(
                  "p-3 rounded-2xl border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none min-w-0",
                  credentialType === option.value
                    ? "border-primary/40 bg-primary/10"
                    : "border-border hover:border-muted-foreground/40"
                )}
              >
                <p className="text-xs font-semibold text-foreground truncate">{option.label}</p>
                <p className="text-[11px] text-muted-foreground truncate mt-0.5" title={option.hint}>
                  {option.hint}
                </p>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(["http", "mcp"] as const).map((option) => (
              <button
                key={option}
                onClick={() => switchTransport(option)}
                aria-pressed={transport === option}
                title={option === "http" ? "Generic REST — you define every tool schema" : "MCP server — tools auto-discover on publish"}
                className={cn(
                  "p-3 rounded-2xl border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none min-w-0",
                  transport === option
                    ? "border-primary/40 bg-primary/10"
                    : "border-border hover:border-muted-foreground/40"
                )}
              >
                <p className="text-xs font-semibold text-foreground truncate">
                  {option === "http" ? "Generic HTTP" : "MCP server"}
                </p>
                <p
                  className="text-[11px] text-muted-foreground truncate mt-0.5"
                  title={option === "http" ? "Generic REST — you define every tool schema" : "MCP server — tools auto-discover on publish"}
                >
                  {option === "http" ? "Manual tool schemas" : "Auto-discover tools"}
                </p>
              </button>
            ))}
          </div>
          <label className="flex flex-col gap-1.5 min-w-0">
            <span className="text-xs font-medium text-foreground">
              {transport === "mcp" ? "Server URL (required)" : "Base URL (optional, for relative tool paths)"}
            </span>
            <input
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder="https://api.example.com"
              aria-label="Template base URL"
              autoComplete="off"
              inputMode="url"
              className={cn(fieldStyles.fieldSm, "font-mono text-xs min-w-0")}
            />
          </label>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-3 min-w-0">
          {credentialType === "none" ? (
            <p className="text-sm text-muted-foreground rounded-3xl border border-dashed border-border p-6 text-center">
              No credential — synced tools call their endpoints bare.
            </p>
          ) : credentialType === "api_key" ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 min-w-0">
                <label className="flex flex-col gap-1.5 min-w-0">
                  <span className="text-xs font-medium text-foreground">Location</span>
                  <select
                    value={auth.location}
                    onChange={(event) => setAuthField("location", event.target.value)}
                    aria-label="API key location"
                    className={cn(fieldStyles.fieldSm, "min-w-0")}
                  >
                    <option value="header">Header</option>
                    <option value="query">Query param</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1.5 min-w-0">
                  <span className="text-xs font-medium text-foreground">Name</span>
                  <input
                    value={auth.headerName}
                    onChange={(event) => setAuthField("headerName", event.target.value)}
                    placeholder="X-API-Key"
                    aria-label="API key name"
                    autoComplete="off"
                    className={cn(fieldStyles.fieldSm, "font-mono text-xs min-w-0")}
                  />
                </label>
              </div>
              {auth.location === "query" && (
                <p className="text-[11px] text-amber-700 dark:text-amber-300">
                  Query keys can land in upstream access logs — prefer header mode when the API allows it.
                </p>
              )}
              <label className="flex flex-col gap-1.5 min-w-0">
                <span className="text-xs font-medium text-foreground">Key value</span>
                <input
                  value={auth.secret}
                  onChange={(event) => setAuthField("secret", event.target.value)}
                  type="password"
                  placeholder="Paste the key"
                  aria-label="API key value"
                  autoComplete="off"
                  className={cn(fieldStyles.fieldSm, "font-mono text-xs min-w-0")}
                />
              </label>
            </>
          ) : credentialType === "bearer" ? (
            <label className="flex flex-col gap-1.5 min-w-0">
              <span className="text-xs font-medium text-foreground">Token</span>
              <input
                value={auth.secret}
                onChange={(event) => setAuthField("secret", event.target.value)}
                type="password"
                placeholder="Paste the bearer token"
                aria-label="Bearer token"
                autoComplete="off"
                className={cn(fieldStyles.fieldSm, "font-mono text-xs min-w-0")}
              />
            </label>
          ) : credentialType === "basic" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 min-w-0">
              <label className="flex flex-col gap-1.5 min-w-0">
                <span className="text-xs font-medium text-foreground">Username</span>
                <input
                  value={auth.username}
                  onChange={(event) => setAuthField("username", event.target.value)}
                  placeholder="username"
                  aria-label="Basic username"
                  autoComplete="off"
                  className={cn(fieldStyles.fieldSm, "font-mono text-xs min-w-0")}
                />
              </label>
              <label className="flex flex-col gap-1.5 min-w-0">
                <span className="text-xs font-medium text-foreground">Password</span>
                <input
                  value={auth.secret}
                  onChange={(event) => setAuthField("secret", event.target.value)}
                  type="password"
                  placeholder="••••••"
                  aria-label="Basic password"
                  autoComplete="off"
                  className={cn(fieldStyles.fieldSm, "font-mono text-xs min-w-0")}
                />
              </label>
            </div>
          ) : credentialType === "oauth2" ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                {(["token", "dcr"] as const).map((option) => (
                  <button
                    key={option}
                    onClick={() => setOauthMode(option)}
                    aria-pressed={oauthMode === option}
                    className={cn(
                      "h-10 rounded-xl border text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none",
                      oauthMode === option
                        ? "border-primary/40 bg-primary/10 text-foreground"
                        : "border-border text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {option === "token" ? "Paste token" : "DCR register"}
                  </button>
                ))}
              </div>
              {oauthMode === "token" ? (
                <label className="flex flex-col gap-1.5 min-w-0">
                  <span className="text-xs font-medium text-foreground">Access token</span>
                  <input
                    value={auth.secret}
                    onChange={(event) => setAuthField("secret", event.target.value)}
                    type="password"
                    placeholder="Paste the access token"
                    aria-label="OAuth access token"
                    autoComplete="off"
                    className={cn(fieldStyles.fieldSm, "font-mono text-xs min-w-0")}
                  />
                </label>
              ) : (
                <label className="flex flex-col gap-1.5 min-w-0">
                  <span className="text-xs font-medium text-foreground">Issuer URL</span>
                  <input
                    value={auth.issuerUrl}
                    onChange={(event) => setAuthField("issuerUrl", event.target.value)}
                    placeholder="https://issuer.example.com"
                    aria-label="OAuth issuer URL"
                    autoComplete="off"
                    inputMode="url"
                    className={cn(fieldStyles.fieldSm, "font-mono text-xs min-w-0")}
                  />
                </label>
              )}
            </>
          ) : (
            <label className="flex flex-col gap-1.5 min-w-0">
              <span className="text-xs font-medium text-foreground">Static headers (JSON object)</span>
              <textarea
                value={auth.secret}
                onChange={(event) => setAuthField("secret", event.target.value)}
                placeholder='{"X-Internal": "yes"}'
                aria-label="Custom headers JSON"
                rows={4}
                spellCheck={false}
                className={cn(fieldStyles.fieldSm, "font-mono text-xs min-w-0 resize-y")}
              />
              {!parseParametersJson(auth.secret).ok && auth.secret.trim() && (
                <span className="text-xs text-destructive">Must be a JSON object of string headers.</span>
              )}
            </label>
          )}
          <p className="text-[11px] text-muted-foreground">
            Secrets are vault-sealed and shown once — lists only ever carry metadata.
          </p>
        </div>
      )}

      {step === 2 && transport === "mcp" && (
        <p className="text-sm text-muted-foreground rounded-3xl border border-dashed border-border p-6 text-center">
          MCP servers describe their own tools — publishing auto-discovers them. No manual schemas needed.
        </p>
      )}

      {step === 2 && transport === "http" && (
        <div className="space-y-3 min-w-0">
          {tools.length === 0 ? (
            <p className="text-sm text-muted-foreground rounded-3xl border border-dashed border-border p-6 text-center">
              No tools yet — add the first one. Each becomes a registry row on publish.
            </p>
          ) : (
            tools.map((entry) => {
              const problems = validateToolEntry(entry);
              return (
                <div key={entry.key} className="rounded-3xl border border-border bg-muted/40 p-4 space-y-2 min-w-0">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 min-w-0">
                    <input
                      value={entry.name}
                      onChange={(event) => patchTool(entry.key, "name", event.target.value)}
                      placeholder="Tool name, e.g. create_issue"
                      aria-label="Tool name"
                      autoComplete="off"
                      className={cn(fieldStyles.fieldSm, "font-mono text-xs min-w-0")}
                    />
                    <input
                      value={entry.description}
                      onChange={(event) => patchTool(entry.key, "description", event.target.value)}
                      placeholder="What it does"
                      aria-label="Tool description"
                      autoComplete="off"
                      className={cn(fieldStyles.fieldSm, "text-xs min-w-0")}
                    />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-[140px_1fr_auto] gap-2 min-w-0">
                    <select
                      value={entry.method}
                      onChange={(event) => patchTool(entry.key, "method", event.target.value)}
                      aria-label="Tool method"
                      className={cn(fieldStyles.fieldSm, "min-w-0")}
                    >
                      {["GET", "POST", "PUT", "PATCH", "DELETE"].map((method) => (
                        <option key={method} value={method}>
                          {method}
                        </option>
                      ))}
                    </select>
                    <input
                      value={entry.path}
                      onChange={(event) => patchTool(entry.key, "path", event.target.value)}
                      placeholder="/issues (needs base URL)"
                      aria-label="Tool path"
                      autoComplete="off"
                      className={cn(fieldStyles.fieldSm, "font-mono text-xs min-w-0")}
                    />
                    <button
                      onClick={() => removeTool(entry.key)}
                      aria-label={`Remove tool ${entry.name || "row"}`}
                      title="Remove tool"
                      className="h-10 w-10 shrink-0 flex items-center justify-center rounded-xl text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 motion-reduce:transition-none"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                  <textarea
                    value={entry.parametersText}
                    onChange={(event) => patchTool(entry.key, "parametersText", event.target.value)}
                    placeholder='{"type":"object"}'
                    aria-label="Tool parameters JSON Schema"
                    rows={3}
                    spellCheck={false}
                    className={cn(fieldStyles.fieldSm, "font-mono text-xs min-w-0 resize-y")}
                  />
                  {problems.length > 0 && (
                    <p className="text-xs text-destructive" role="alert">
                      Fix: {problems.join(", ")}.
                    </p>
                  )}
                </div>
              );
            })
          )}
          <button
            onClick={addTool}
            className="w-full h-10 rounded-xl border border-dashed border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-muted-foreground/40 transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
          >
            <Plus className="w-4 h-4" aria-hidden="true" /> Add tool
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3 min-w-0">
          <div className="rounded-3xl border border-border bg-muted/40 p-4 space-y-1.5 min-w-0">
            <p className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">Review</p>
            <p className="text-sm text-foreground truncate" title={`Provider ${provider}`}>
              Provider <span className="font-mono">{provider}</span> · {credentialType}
              {baseUrl.trim() ? (
                <span className="text-muted-foreground"> · <span className="font-mono">{baseUrl.trim()}</span></span>
              ) : null}
            </p>
            <p className="text-xs text-muted-foreground">
              {transport === "mcp"
                ? "Tools auto-discover from the server on publish."
                : `${tools.length} ${tools.length === 1 ? "tool" : "tools"} will sync into the registry
              ${credentialType === "none" ? " with no credential" : " under this credential"}.`}
            </p>
          </div>
          {syncResult ? (
            <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-2 min-w-0">
              <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
                Published — {syncResult.created} created, {syncResult.updated} updated
                {syncResult.skipped.length > 0 ? `, ${syncResult.skipped.length} skipped` : ""}.
              </p>
              {secretOnce && (
                <div className="flex gap-2 min-w-0">
                  <code className="flex-1 min-w-0 truncate h-10 px-3 flex items-center bg-card border border-border rounded-xl font-mono text-xs" title={secretOnce}>
                    {secretOnce}
                  </code>
                  <button
                    onClick={() => void copyText(secretOnce)}
                    aria-label="Copy one-time secret"
                    className="h-10 w-10 shrink-0 flex items-center justify-center rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 motion-reduce:transition-none"
                  >
                    {copied ? <Check className="w-4 h-4" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
                  </button>
                </div>
              )}
              {syncResult.problems.length > 0 && (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Skipped entries: {syncResult.problems.join(" · ")}
                </p>
              )}
              {syncResult.tool_ids.length > 0 && (
                <div className="flex flex-wrap gap-1.5 min-w-0">
                  {syncResult.tool_ids.map((id) => (
                    <span key={id} className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-card border border-border truncate max-w-full" title={id}>
                      {id}
                    </span>
                  ))}
                </div>
              )}
              <button
                onClick={onClose}
                className="w-full h-10 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
              >
                Done
              </button>
            </div>
          ) : (
            <button
              onClick={() => void handleFinish()}
              disabled={busy}
              className="w-full h-11 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
            >
              {busy ? (
                <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              ) : (
                <Check className="w-4 h-4" aria-hidden="true" />
              )}
              Save, connect &amp; sync tools
            </button>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="flex items-center gap-2 text-xs text-destructive min-w-0">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate" title={error}>{error}</span>
        </p>
      )}

      {!syncResult && (
        <div className="flex items-center justify-between gap-2 min-w-0">
          <button
            onClick={() => (step === 0 ? onClose() : setStep(step - 1))}
            aria-label={step === 0 ? "Cancel" : "Back"}
            className="h-10 px-4 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
          >
            {step === 0 ? <X className="w-4 h-4" aria-hidden="true" /> : <ArrowLeft className="w-4 h-4" aria-hidden="true" />}
            {step === 0 ? "Cancel" : "Back"}
          </button>
          {step < 3 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!canNext}
              aria-label={`Next: ${STEPS[step + 1]}`}
              className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-1.5 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
            >
              Next: {STEPS[step + 1]}
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          ) : (
            <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground truncate">
              Review, then publish
            </span>
          )}
        </div>
      )}
    </Modal>
  );
}
