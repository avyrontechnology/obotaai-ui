"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2, PlugZap, X } from "lucide-react";
import { Modal } from "@/components/common/modal";
import { Field, FormAlert, SegmentedControl, StepDots } from "@/components/integrations/form-fields";
import { SecretOnceBox } from "@/components/integrations/secret-once-box";
import { fieldStyles } from "@/lib/field-styles";
import { cn } from "@/lib/utils";
import { notify } from "@/lib/notify";
import {
  initialBuilderAuth,
  slugifyProvider,
  validateHttpUrl,
  validateProviderName,
  type BuilderAuthState,
} from "@/lib/integrations/builder-utils";
import { useOAuthPopup } from "@/lib/integrations/use-oauth-popup";
import {
  useAuthorizeUrl,
  useConnectCredential,
  useDcrRegister,
  useSaveTemplate,
  useSyncTools,
} from "@/services/platform/mcp";

const STEPS = ["Server", "Auth", "Review"] as const;

const AUTH_OPTIONS = [
  { value: "bearer", title: "Bearer", hint: "Authorization header" },
  { value: "oauth2", title: "OAuth2", hint: "Token, DCR or login" },
  { value: "custom", title: "Custom", hint: "Static headers" },
  { value: "none", title: "None", hint: "Public server" },
] as const;

type AuthChoice = (typeof AUTH_OPTIONS)[number]["value"];
type OauthMode = "token" | "dcr" | "login";

/**
 * Builder for MCP SERVERS — fixed transport, tools auto-discover.
 * Split out of the old 4-in-1 IntegrationBuilder: this dialog never
 * shows the manual tool-schema editor (that lives in CustomApiBuilder).
 */
export function McpServerBuilder({ onClose }: { onClose: () => void }) {
  const saveTemplate = useSaveTemplate();
  const connect = useConnectCredential();
  const dcr = useDcrRegister();
  const authorize = useAuthorizeUrl();
  const sync = useSyncTools();

  const [step, setStep] = useState(0);
  const [provider, setProvider] = useState("");
  const [serverUrl, setServerUrl] = useState("");
  const [credentialType, setCredentialType] = useState<AuthChoice>("bearer");
  const [auth, setAuth] = useState<BuilderAuthState>(initialBuilderAuth);
  const [oauthMode, setOauthMode] = useState<OauthMode>("token");
  const [loginScope, setLoginScope] = useState("");
  const [dcrDone, setDcrDone] = useState<string | null>(null);
  const [oauthConnected, setOauthConnected] = useState<string | null>(null);
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

  const popupRef = useOAuthPopup({
    provider: slugifyProvider(provider),
    onConnected: () => {
      setOauthConnected(slugifyProvider(provider));
      setCopied(false);
    },
    onFailed: () => setError("Provider login did not complete — retry."),
  });

  const slug = slugifyProvider(provider);
  const providerError = touched ? validateProviderName(provider) : null;
  const serverUrlError = touched
    ? validateHttpUrl(serverUrl, { required: true, label: "Server URL" })
    : null;
  const serverValid =
    !validateProviderName(provider) &&
    !validateHttpUrl(serverUrl, { required: true, label: "Server URL" });

  const authValid = useMemo(() => {
    if (credentialType === "none") return true;
    if (credentialType === "bearer" || credentialType === "custom")
      return auth.secret.trim().length > 0;
    if (oauthMode === "dcr") return auth.issuerUrl.trim().length > 0;
    if (oauthMode === "login") return true;
    return auth.secret.trim().length > 0;
  }, [credentialType, auth, oauthMode]);

  const canNext = step === 0 ? serverValid : step === 1 ? authValid : true;

  const nextWithTouch = () => {
    setTouched(true);
    if (canNext) {
      setError(null);
      setStep(step + 1);
    }
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const openLogin = async () => {
    if (busy || authorize.isPending) return;
    setError(null);
    // The popup opens inside the click handler, before the await, so it is
    // still user-activated and the browser does not block it. Endpoints +
    // client credentials resolve server-side from the vault DCR record —
    // the caller only picks scopes.
    const popup = popupRef.start();
    if (!popup) {
      setError("Popup blocked — allow popups and retry.");
      return;
    }
    try {
      const result = await authorize.mutateAsync({ provider: slug, scope: loginScope.trim() });
      popupRef.navigate(result.authorization_url);
    } catch {
      popupRef.close();
      setError("Could not start the provider login — register with DCR first, then retry.");
    }
  };

  const registerDcr = async () => {
    if (busy || dcr.isPending || !auth.issuerUrl.trim()) return;
    setError(null);
    try {
      const record = await dcr.mutateAsync({ issuer_url: auth.issuerUrl.trim(), provider: slug });
      // The secret seals server-side — nothing to copy. Move to the login
      // step: only a completed login seals the access token sync needs.
      setDcrDone(record.client_id);
      setOauthMode("login");
    } catch {
      setError("Registration failed — the issuer may be undiscoverable or manual-only.");
    }
  };

  const handleFinish = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      // MCP templates discover live — manual entries never persist there.
      await saveTemplate.mutateAsync({
        provider: slug,
        credential_type: credentialType,
        transport: "mcp",
        tools_template: [],
        oauth_config: {},
        client_config: { base_url: serverUrl.trim() },
      });
      if (credentialType === "oauth2" && oauthMode === "dcr") {
        // DCR normally runs inline from the Auth step (registerDcr moves to
        // login on success). Publishing straight from here registers now —
        // but sync still needs the login afterwards.
        if (!dcrDone) {
          const record = await dcr.mutateAsync({ issuer_url: auth.issuerUrl.trim(), provider: slug });
          setDcrDone(record.client_id);
        }
        setOauthMode("login");
        setError("Registered — complete the provider login, then publish again to discover tools.");
        return;
      } else if (credentialType === "oauth2") {
        if (oauthConnected !== slug) {
          setError("Complete the provider login first — open it from step 2.");
          return;
        }
        // Credential already sealed by the callback (auto-sync ran there too,
        // so the publish sync below is usually a cheap no-op refresh).
      } else if (credentialType !== "none") {
        const result = await connect.mutateAsync({
          provider: slug,
          credential_type: credentialType,
          secret: auth.secret,
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
      notify.success("MCP server published", {
        description: `${synced.created} discovered, ${synced.updated} updated`,
      });
    } catch {
      setError("Publish failed — check the server URL, auth, and discovery, then retry.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      label="New MCP server"
      className="max-w-2xl space-y-4"
      title={
        <div className="flex items-center gap-2 min-w-0">
          <PlugZap className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
          <h4 className="font-semibold text-foreground truncate">New MCP server</h4>
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
            label="Server URL (required)"
            hint="The MCP server endpoint. Tools auto-discover from it on publish — no manual schemas."
            error={serverUrlError}
          >
            <input
              value={serverUrl}
              onChange={(event) => setServerUrl(event.target.value)}
              placeholder="https://mcp.example.com/mcp"
              aria-label="MCP server URL"
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
              No credential — the server must allow unauthenticated discovery.
            </p>
          ) : credentialType === "bearer" ? (
            <Field label="Bearer token" hint="Sent as Authorization: Bearer on discovery and calls. Sealed on publish.">
              <input
                value={auth.secret}
                onChange={(event) => setAuthField("secret", event.target.value)}
                type="password"
                placeholder="Paste the bearer token"
                aria-label="Bearer token"
                autoComplete="off"
                className={cn(fieldStyles.fieldSm, "font-mono text-xs min-w-0")}
              />
            </Field>
          ) : credentialType === "custom" ? (
            <Field label="Static headers (JSON object)" hint="Merged into discovery and calls.">
              <textarea
                value={auth.secret}
                onChange={(event) => setAuthField("secret", event.target.value)}
                placeholder='{"X-Internal": "yes"}'
                aria-label="Custom headers JSON"
                rows={3}
                spellCheck={false}
                className={cn(fieldStyles.fieldSm, "font-mono text-xs min-w-0 resize-y")}
              />
            </Field>
          ) : (
            <div className="space-y-3 min-w-0">
              <div className="grid grid-cols-3 gap-2">
                {(["token", "dcr", "login"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setOauthMode(option)}
                    aria-pressed={oauthMode === option}
                    className={cn(
                      "h-10 rounded-xl border text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none truncate px-1",
                      oauthMode === option
                        ? "border-primary/40 bg-primary/10 text-foreground"
                        : "border-border text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {option === "token" ? "Paste token" : option === "dcr" ? "DCR register" : "Login"}
                  </button>
                ))}
              </div>
              {oauthMode === "token" ? (
                <Field label="Access token" hint="Stored as an oauth2 credential.">
                  <input
                    value={auth.secret}
                    onChange={(event) => setAuthField("secret", event.target.value)}
                    type="password"
                    placeholder="Paste the access token"
                    aria-label="OAuth access token"
                    autoComplete="off"
                    className={cn(fieldStyles.fieldSm, "font-mono text-xs min-w-0")}
                  />
                </Field>
              ) : oauthMode === "dcr" ? (
                <div className="space-y-3 min-w-0">
                  <Field
                    label="Issuer URL"
                    hint="Bare issuer host, no /mcp or /api path — e.g. https://mcp.apollo.io. Registers an OAuth client; the secret seals server-side."
                  >
                    <input
                      value={auth.issuerUrl}
                      onChange={(event) => setAuthField("issuerUrl", event.target.value)}
                      placeholder="https://issuer.example.com"
                      aria-label="OAuth issuer URL"
                      autoComplete="off"
                      inputMode="url"
                      className={cn(fieldStyles.fieldSm, "font-mono text-xs min-w-0")}
                    />
                  </Field>
                  <button
                    onClick={() => void registerDcr()}
                    disabled={!auth.issuerUrl.trim() || dcr.isPending || busy}
                    className="w-full h-11 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
                  >
                    {dcr.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                    ) : (
                      <Check className="w-4 h-4" aria-hidden="true" />
                    )}
                    {dcrDone ? `Registered as ${dcrDone} — continue to login` : "Register client"}
                  </button>
                  {dcrDone && (
                    <p className="text-[11px] text-muted-foreground">
                      Registered — the secret sealed server-side, nothing to copy. Next: log in below.
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-3 min-w-0">
                  <Field label="Scopes" hint="Space-separated. The provider consent page shows the final list.">
                    <input
                      value={loginScope}
                      onChange={(event) => setLoginScope(event.target.value)}
                      placeholder="read:jira-work write:jira-work"
                      aria-label="OAuth scopes"
                      autoComplete="off"
                      className={cn(fieldStyles.fieldSm, "font-mono text-xs min-w-0")}
                    />
                  </Field>
                  <button
                    onClick={() => void openLogin()}
                    disabled={authorize.isPending || busy}
                    className="w-full h-11 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
                  >
                    {authorize.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                    ) : (
                      <Check className="w-4 h-4" aria-hidden="true" />
                    )}
                    {oauthConnected === slug && slug
                      ? `Logged in as ${slug} — reconnect to rotate`
                      : `Connect with ${slug || "provider"}`}
                  </button>
                  <p className="text-[11px] text-muted-foreground">
                    A popup opens the provider login — approving seals the tokens and discovers tools, nothing to paste.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3 min-w-0">
          <div className="rounded-3xl border border-border bg-muted/40 p-4 space-y-1.5 min-w-0">
            <p className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">Review</p>
            <p className="text-sm text-foreground truncate" title={`Provider ${slug}`}>
              MCP server <span className="font-mono">{slug}</span> · {credentialType}
              <span className="text-muted-foreground"> · <span className="font-mono">{serverUrl.trim()}</span></span>
            </p>
            <p className="text-xs text-muted-foreground">
              Tools auto-discover from the server on publish — no manual schemas.
            </p>
          </div>
          {syncResult ? (
            <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-2 min-w-0">
              <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
                Published — {syncResult.created} discovered, {syncResult.updated} updated.
              </p>
              {secretOnce && (
                <SecretOnceBox
                  title="Secret issued — copy it now, it will never show again."
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
              Save, connect &amp; discover tools
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
          {step < 2 ? (
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
