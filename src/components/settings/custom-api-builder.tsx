"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2, Plus, Trash2, Webhook, X } from "lucide-react";
import { Modal } from "@/components/common/modal";
import { Field, FormAlert, SegmentedControl, StepDots } from "@/components/integrations/form-fields";
import { SecretOnceBox } from "@/components/integrations/secret-once-box";
import { fieldStyles } from "@/lib/field-styles";
import { cn } from "@/lib/utils";
import { notify } from "@/lib/notify";
import {
  findDuplicateToolNames,
  initialBuilderAuth,
  parseParametersJson,
  slugifyProvider,
  validateHttpUrl,
  validateProviderName,
  validateToolEntry,
  type BuilderAuthState,
  type BuilderToolEntry,
} from "@/lib/integrations/builder-utils";
import { useConnectCredential, useSaveTemplate, useSyncTools } from "@/services/platform/mcp";

const STEPS = ["Basics", "Auth", "Tools", "Review"] as const;

const AUTH_OPTIONS = [
  { value: "api_key", title: "API key", hint: "Header or query key" },
  { value: "bearer", title: "Bearer", hint: "Authorization header" },
  { value: "basic", title: "Basic", hint: "Username + password" },
  { value: "oauth2", title: "OAuth2", hint: "Paste access token" },
  { value: "custom", title: "Custom", hint: "Static headers JSON" },
  { value: "none", title: "None", hint: "Public endpoints" },
] as const;

type AuthChoice = (typeof AUTH_OPTIONS)[number]["value"];

/**
 * Builder for CUSTOM HTTP APIs — fixed transport, no MCP branching.
 * Split out of the old 4-in-1 IntegrationBuilder: this dialog never
 * asks about MCP servers or tool auto-discovery (those live in
 * McpServerBuilder). OAuth2 here means pasting an access token —
 * client registration (DCR) and popup login belong to the MCP
 * server builder and the provider connect dialog, not to a
 * hand-defined REST API.
 */
export function CustomApiBuilder({ onClose }: { onClose: () => void }) {
  const saveTemplate = useSaveTemplate();
  const connect = useConnectCredential();
  const sync = useSyncTools();

  const [step, setStep] = useState(0);
  const [provider, setProvider] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [credentialType, setCredentialType] = useState<AuthChoice>("api_key");
  const [auth, setAuth] = useState<BuilderAuthState>(initialBuilderAuth);
  const [tools, setTools] = useState<BuilderToolEntry[]>([]);
  const [keyCounter, setKeyCounter] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [secretOnce, setSecretOnce] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<{
    created: number;
    updated: number;
    tool_ids: string[];
    problems: string[];
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);

  const setAuthField = (field: keyof BuilderAuthState, value: string) =>
    setAuth((current) => ({ ...current, [field]: value }));

  const providerError = touched ? validateProviderName(provider) : null;
  const baseUrlError = touched ? validateHttpUrl(baseUrl, { required: false, label: "Base URL" }) : null;
  const slug = slugifyProvider(provider);
  const basicsValid = !validateProviderName(provider) && !validateHttpUrl(baseUrl, { required: false, label: "Base URL" });

  const authValid = useMemo(() => {
    if (credentialType === "none") return true;
    if (credentialType === "api_key") return auth.secret.trim().length > 0 && auth.headerName.trim().length > 0;
    if (credentialType === "bearer" || credentialType === "oauth2") return auth.secret.trim().length > 0;
    if (credentialType === "basic") return auth.username.trim().length > 0 && auth.secret.length > 0;
    return parseParametersJson(auth.secret).ok && auth.secret.trim().length > 0;
  }, [credentialType, auth]);

  const dupeNames = useMemo(() => findDuplicateToolNames(tools), [tools]);
  const toolsValid = useMemo(
    () =>
      tools.length > 0 &&
      dupeNames.size === 0 &&
      tools.every((entry) => validateToolEntry(entry).length === 0),
    [tools, dupeNames]
  );
  const relativeWithoutBase = useMemo(
    () => !baseUrl.trim() && tools.some((t) => t.path.trim().startsWith("/")),
    [baseUrl, tools]
  );

  const canNext =
    step === 0 ? basicsValid : step === 1 ? authValid : step === 2 ? toolsValid : true;

  const nextWithTouch = () => {
    setTouched(true);
    if (canNext) {
      setError(null);
      setStep(step + 1);
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
      const entries = tools.map((entry) => ({
        name: entry.name.trim(),
        description: entry.description.trim(),
        method: entry.method,
        ...(entry.path.trim() ? { path: entry.path.trim() } : {}),
        parameters: (parseParametersJson(entry.parametersText).ok
          ? (parseParametersJson(entry.parametersText) as { ok: true; value: Record<string, unknown> }).value
          : {}) as Record<string, unknown>,
      }));
      await saveTemplate.mutateAsync({
        provider: slug,
        credential_type: credentialType,
        transport: "http",
        tools_template: entries,
        oauth_config: {},
        client_config: baseUrl.trim() ? { base_url: baseUrl.trim() } : {},
      });
      if (credentialType !== "none") {
        const auth_config: Record<string, string> =
          credentialType === "api_key"
            ? { location: auth.location, name: auth.headerName.trim() || "X-API-Key" }
            : credentialType === "basic"
              ? { username: auth.username.trim() }
              : {};
        const result = await connect.mutateAsync({
          provider: slug,
          credential_type: credentialType,
          secret: auth.secret,
          ...(Object.keys(auth_config).length > 0 ? { auth_config } : {}),
        });
        setSecretOnce(result.secret_once);
      }
      const synced = await sync.mutateAsync(slug);
      setSyncResult({
        created: synced.created,
        updated: synced.updated,
        tool_ids: [...synced.tool_ids],
        problems: [...synced.problems],
      });
      notify.success("Custom API published", {
        description: `${synced.created} created, ${synced.updated} updated`,
      });
    } catch {
      setError("Publish failed — check the provider, auth, and tool schemas, then retry.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      label="New custom API"
      className="max-w-2xl space-y-4"
      title={
        <div className="flex items-center gap-2 min-w-0">
          <Webhook className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
          <h4 className="font-semibold text-foreground truncate">New custom API</h4>
        </div>
      }
    >
      <StepDots step={step} steps={STEPS} />

      {step === 0 && (
        <div className="space-y-3 min-w-0">
          <Field
            label="Provider name"
            hint={slug ? `Stored as “${slug}” — vault key and registry id.` : "Lowercase id, e.g. github."}
            error={providerError}
          >
            <input
              value={provider}
              onChange={(event) => setProvider(event.target.value)}
              placeholder="github"
              aria-label="Provider name"
              autoComplete="off"
              className={cn(fieldStyles.fieldSm, "font-mono text-xs min-w-0")}
            />
          </Field>
          <Field
            label="Base URL (optional)"
            hint="Tools with relative paths (/issues) resolve against this. Absolute tool URLs ignore it."
            error={baseUrlError}
          >
            <input
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder="https://api.example.com"
              aria-label="API base URL"
              autoComplete="off"
              inputMode="url"
              className={cn(fieldStyles.fieldSm, "font-mono text-xs min-w-0")}
            />
          </Field>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-3 min-w-0">
          <SegmentedControl
            label="Credential type"
            options={AUTH_OPTIONS}
            value={credentialType}
            onChange={(next) => {
              setCredentialType(next);
              setAuth((current) => ({ ...current, type: next }));
              setError(null);
            }}
          />
          {credentialType === "none" ? (
            <p className="text-sm text-muted-foreground rounded-3xl border border-dashed border-border p-6 text-center">
              No credential — synced tools call their endpoints bare.
            </p>
          ) : credentialType === "api_key" ? (
            <div className="space-y-3 min-w-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 min-w-0">
                <Field label="Location">
                  <select
                    value={auth.location}
                    onChange={(event) => setAuthField("location", event.target.value)}
                    aria-label="API key location"
                    className={cn(fieldStyles.fieldSm, "min-w-0")}
                  >
                    <option value="header">Header</option>
                    <option value="query">Query param</option>
                  </select>
                </Field>
                <Field label="Header name">
                  <input
                    value={auth.headerName}
                    onChange={(event) => setAuthField("headerName", event.target.value)}
                    placeholder="X-API-Key"
                    aria-label="API key name"
                    autoComplete="off"
                    className={cn(fieldStyles.fieldSm, "font-mono text-xs min-w-0")}
                  />
                </Field>
              </div>
              {auth.location === "query" && (
                <FormAlert tone="warn" message="Query keys can land in upstream access logs — prefer header mode when the API allows it." />
              )}
              <Field label="Key value" hint="Vault-sealed on publish and shown once.">
                <input
                  value={auth.secret}
                  onChange={(event) => setAuthField("secret", event.target.value)}
                  type="password"
                  placeholder="Paste the key"
                  aria-label="API key value"
                  autoComplete="off"
                  className={cn(fieldStyles.fieldSm, "font-mono text-xs min-w-0")}
                />
              </Field>
            </div>
          ) : credentialType === "bearer" || credentialType === "oauth2" ? (
            <Field
              label={credentialType === "bearer" ? "Bearer token" : "OAuth2 access token"}
              hint={
                credentialType === "bearer"
                  ? "Sent as Authorization: Bearer on every call."
                  : "Stored as an oauth2 credential. Need client registration or popup login instead? Use the MCP server flow."
              }
            >
              <input
                value={auth.secret}
                onChange={(event) => setAuthField("secret", event.target.value)}
                type="password"
                placeholder={credentialType === "bearer" ? "Paste the bearer token" : "Paste the access token"}
                aria-label={credentialType === "bearer" ? "Bearer token" : "OAuth2 access token"}
                autoComplete="off"
                className={cn(fieldStyles.fieldSm, "font-mono text-xs min-w-0")}
              />
            </Field>
          ) : credentialType === "basic" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 min-w-0">
              <Field label="Username">
                <input
                  value={auth.username}
                  onChange={(event) => setAuthField("username", event.target.value)}
                  placeholder="username"
                  aria-label="Basic username"
                  autoComplete="off"
                  className={cn(fieldStyles.fieldSm, "font-mono text-xs min-w-0")}
                />
              </Field>
              <Field label="Password" hint="Sealed; username rides in metadata config.">
                <input
                  value={auth.secret}
                  onChange={(event) => setAuthField("secret", event.target.value)}
                  type="password"
                  placeholder="••••••"
                  aria-label="Basic password"
                  autoComplete="off"
                  className={cn(fieldStyles.fieldSm, "font-mono text-xs min-w-0")}
                />
              </Field>
            </div>
          ) : (
            <Field
              label="Static headers (JSON object)"
              hint="Merged into every request, e.g. X-Internal: yes. Must be a JSON object."
              error={!parseParametersJson(auth.secret).ok && auth.secret.trim() ? "Must be a JSON object of string headers." : null}
            >
              <textarea
                value={auth.secret}
                onChange={(event) => setAuthField("secret", event.target.value)}
                placeholder='{"X-Internal": "yes"}'
                aria-label="Custom headers JSON"
                rows={4}
                spellCheck={false}
                className={cn(fieldStyles.fieldSm, "font-mono text-xs min-w-0 resize-y")}
              />
            </Field>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3 min-w-0">
          {relativeWithoutBase && (
            <FormAlert tone="warn" message="Some tools use relative paths but no base URL is set — those calls will fail until one is added." />
          )}
          {tools.length === 0 ? (
            <p className="text-sm text-muted-foreground rounded-3xl border border-dashed border-border p-6 text-center">
              No tools yet — add the first one. Each becomes a registry row on publish.
            </p>
          ) : (
            tools.map((entry, index) => {
              const problems = validateToolEntry(entry);
              const dupe = dupeNames.has(entry.name.trim().toLowerCase()) && entry.name.trim();
              return (
                <div key={entry.key} className="rounded-3xl border border-border bg-muted/40 p-4 space-y-2 min-w-0">
                  <p className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
                    Tool {index + 1}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 min-w-0">
                    <Field label="Name" error={problems.includes("name") ? "Lowercase, no spaces or slashes — e.g. create_issue." : dupe ? "Duplicate tool name in this API." : null}>
                      <input
                        value={entry.name}
                        onChange={(event) => patchTool(entry.key, "name", event.target.value)}
                        placeholder="create_issue"
                        aria-label={`Tool ${index + 1} name`}
                        autoComplete="off"
                        className={cn(fieldStyles.fieldSm, "font-mono text-xs min-w-0")}
                      />
                    </Field>
                    <Field label="Description">
                      <input
                        value={entry.description}
                        onChange={(event) => patchTool(entry.key, "description", event.target.value)}
                        placeholder="What it does"
                        aria-label={`Tool ${index + 1} description`}
                        autoComplete="off"
                        className={cn(fieldStyles.fieldSm, "text-xs min-w-0")}
                      />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-[140px_1fr_auto] gap-2 min-w-0">
                    <Field label="Method" error={problems.includes("method") ? "Pick a valid HTTP method." : null}>
                      <select
                        value={entry.method}
                        onChange={(event) => patchTool(entry.key, "method", event.target.value)}
                        aria-label={`Tool ${index + 1} method`}
                        className={cn(fieldStyles.fieldSm, "min-w-0")}
                      >
                        {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Path" error={problems.includes("path") ? "Relative paths must start with /." : null}>
                      <input
                        value={entry.path}
                        onChange={(event) => patchTool(entry.key, "path", event.target.value)}
                        placeholder="/issues (needs base URL)"
                        aria-label={`Tool ${index + 1} path`}
                        autoComplete="off"
                        className={cn(fieldStyles.fieldSm, "font-mono text-xs min-w-0")}
                      />
                    </Field>
                    <div className="flex items-end">
                      <button
                        onClick={() => removeTool(entry.key)}
                        aria-label={`Remove tool ${entry.name || index + 1}`}
                        title="Remove tool"
                        className="h-10 w-10 shrink-0 flex items-center justify-center rounded-xl text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 motion-reduce:transition-none"
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                  <Field label="Parameters (JSON Schema)" error={problems.includes("parameters") ? "Must be a JSON object." : null}>
                    <textarea
                      value={entry.parametersText}
                      onChange={(event) => patchTool(entry.key, "parametersText", event.target.value)}
                      placeholder='{"type":"object"}'
                      aria-label={`Tool ${index + 1} parameters JSON Schema`}
                      rows={3}
                      spellCheck={false}
                      className={cn(fieldStyles.fieldSm, "font-mono text-xs min-w-0 resize-y")}
                    />
                  </Field>
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
            <p className="text-sm text-foreground truncate" title={`Provider ${slug}`}>
              Custom API <span className="font-mono">{slug}</span> · {credentialType}
              {baseUrl.trim() ? (
                <span className="text-muted-foreground"> · <span className="font-mono">{baseUrl.trim()}</span></span>
              ) : null}
            </p>
            <p className="text-xs text-muted-foreground">
              {tools.length} {tools.length === 1 ? "tool" : "tools"} will sync into the registry
              {credentialType === "none" ? " with no credential" : " under this credential"}.
            </p>
          </div>
          {syncResult ? (
            <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-2 min-w-0">
              <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
                Published — {syncResult.created} created, {syncResult.updated} updated.
              </p>
              {secretOnce && (
                <SecretOnceBox
                  title="Secret sealed — copy it now, it will never show again."
                  secret={secretOnce}
                  onCopy={() => void copyText(secretOnce)}
                  copied={copied}
                  onDone={onClose}
                />
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
              {!secretOnce && (
                <button
                  onClick={onClose}
                  className="w-full h-10 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
                >
                  Done
                </button>
              )}
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

      {error && <FormAlert message={error} />}

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
              onClick={nextWithTouch}
              disabled={!canNext}
              title={!canNext ? "Fix the highlighted fields to continue." : `Next: ${STEPS[step + 1]}`}
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
