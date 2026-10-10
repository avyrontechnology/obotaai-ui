"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Modal } from "@/components/common/modal";
import { Field, FormAlert, SegmentedControl } from "@/components/integrations/form-fields";
import { SecretOnceBox } from "@/components/integrations/secret-once-box";
import { fieldStyles } from "@/lib/field-styles";
import { cn } from "@/lib/utils";
import { useOAuthPopup } from "@/lib/integrations/use-oauth-popup";
import { useAuthorizeUrl, useConnectCredential, useDcrRegister } from "@/services/platform/mcp";

type ConnectMethod = "api_key" | "bearer" | "basic" | "oauth_token" | "dcr" | "login";

const METHODS: { value: ConnectMethod; title: string; hint: string }[] = [
  { value: "api_key", title: "API key", hint: "Header or query key" },
  { value: "bearer", title: "Bearer", hint: "Authorization header" },
  { value: "basic", title: "Basic", hint: "Username + password" },
  { value: "oauth_token", title: "OAuth token", hint: "Paste access token" },
  { value: "dcr", title: "DCR register", hint: "Register at issuer" },
  { value: "login", title: "Provider login", hint: "OAuth popup flow" },
];

/**
 * Redesigned connect flow for an EXISTING provider template.
 * One job only: seal a credential into the vault (shown once),
 * then the caller links it to agents. Building new providers lives
 * in CustomApiBuilder / McpServerBuilder — not here.
 */
export function McpConnectDialog({ provider, onClose }: { provider: string; onClose: () => void }) {
  const connect = useConnectCredential();
  const dcr = useDcrRegister();
  const authorize = useAuthorizeUrl();

  const [method, setMethod] = useState<ConnectMethod>("api_key");
  const [location, setLocation] = useState("header");
  const [headerName, setHeaderName] = useState("X-API-Key");
  const [username, setUsername] = useState("");
  const [secret, setSecret] = useState("");
  const [issuerUrl, setIssuerUrl] = useState("");
  const [authEndpoint, setAuthEndpoint] = useState("");
  const [tokenEndpoint, setTokenEndpoint] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [secretOnce, setSecretOnce] = useState<{ provider: string; secret: string; replaced: boolean } | null>(null);
  const [dcrOnce, setDcrOnce] = useState<{ clientId: string; issuerUrl: string; secret: string | null } | null>(null);
  const [oauthDone, setOauthDone] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const popupRef = useOAuthPopup({
    provider,
    onConnected: () => {
      setOauthDone(provider);
      setCopied(false);
    },
    onFailed: () => setError("Provider login did not complete — retry."),
  });

  const seal = async (credential_type: "api_key" | "bearer" | "basic" | "oauth2", extra?: Record<string, string>) => {
    setError(null);
    try {
      const result = await connect.mutateAsync({
        provider,
        credential_type,
        secret: secret.trim(),
        ...(extra && Object.keys(extra).length > 0 ? { auth_config: extra } : {}),
      });
      setCopied(false);
      setSecretOnce({ provider: result.meta.provider, secret: result.secret_once, replaced: result.replaced });
      setSecret("");
    } catch {
      setError("Could not seal that secret. Is the backend running?");
    }
  };

  const handleApiKey = () => {
    if (!secret.trim() || !headerName.trim() || connect.isPending) return;
    void seal("api_key", { location, name: headerName.trim() || "X-API-Key" });
  };

  const handleBearer = () => {
    if (!secret.trim() || connect.isPending) return;
    setError(null);
    connect
      .mutateAsync({ provider, credential_type: "bearer", secret: secret.trim() })
      .then((result) => {
        setCopied(false);
        setSecretOnce({ provider: result.meta.provider, secret: result.secret_once, replaced: result.replaced });
        setSecret("");
      })
      .catch(() => setError("Could not seal that secret. Is the backend running?"));
  };

  const handleBasic = () => {
    if (!username.trim() || !secret.trim() || connect.isPending) return;
    setError(null);
    // Basic vault rows carry username in auth_config; the password is the sealed secret.
    connect
      .mutateAsync({
        provider,
        credential_type: "basic",
        secret: secret.trim(),
        auth_config: { username: username.trim() },
      })
      .then((result) => {
        setCopied(false);
        setSecretOnce({ provider: result.meta.provider, secret: result.secret_once, replaced: result.replaced });
        setSecret("");
      })
      .catch(() => setError("Could not seal that secret. Is the backend running?"));
  };

  const handleOauthToken = () => {
    if (!secret.trim() || connect.isPending) return;
    void seal("oauth2");
  };

  const handleDcr = async () => {
    if (!issuerUrl.trim() || dcr.isPending) return;
    setError(null);
    try {
      const result = await dcr.mutateAsync({ issuer_url: issuerUrl.trim(), provider });
      setCopied(false);
      setDcrOnce({ clientId: result.client_id, issuerUrl: result.issuer_url, secret: result.client_secret_once ?? null });
      setIssuerUrl("");
    } catch {
      setError("Registration failed — the issuer may be undiscoverable or manual-only.");
    }
  };

  const handleLogin = async () => {
    if (!authEndpoint.trim() || !tokenEndpoint.trim() || !clientId.trim() || authorize.isPending) return;
    setError(null);
    // Opened inside the click handler so the browser still treats it as
    // user-activated; navigated once the authorize URL is minted.
    const popup = popupRef.start();
    if (!popup) {
      setError("Popup blocked — allow popups and retry.");
      return;
    }
    try {
      const result = await authorize.mutateAsync({
        provider,
        authorization_endpoint: authEndpoint.trim(),
        token_endpoint: tokenEndpoint.trim(),
        client_id: clientId.trim(),
        ...(clientSecret ? { client_secret: clientSecret } : {}),
        scope: "",
      });
      popupRef.navigate(result.authorization_url);
    } catch {
      popupRef.close();
      setError("Could not start the provider login — check the endpoints.");
    }
  };

  const done = secretOnce ?? dcrOnce ?? oauthDone;

  return (
    <Modal
      open
      onClose={onClose}
      label={`Connect ${provider}`}
      title={<h4 className="font-semibold text-foreground">Connect {provider}</h4>}
      className="max-w-md space-y-4"
    >
      {secretOnce ? (
        <SecretOnceBox
          title={`${secretOnce.provider} connected${secretOnce.replaced ? " — existing credential replaced" : ""} — copy it now, it will never show again.`}
          secret={secretOnce.secret}
          onCopy={() => void copyText(secretOnce.secret)}
          copied={copied}
          onDone={onClose}
        />
      ) : dcrOnce ? (
        <div className="space-y-3 min-w-0">
          <p className="text-sm text-muted-foreground">
            Registered at <span className="font-mono text-foreground">{dcrOnce.issuerUrl}</span> as{" "}
            <span className="font-mono text-foreground">{dcrOnce.clientId}</span>.
          </p>
          {dcrOnce.secret ? (
            <SecretOnceBox
              title="Client secret issued — copy it now, it will never show again."
              secret={dcrOnce.secret}
              onCopy={() => void copyText(dcrOnce.secret as string)}
              copied={copied}
              onDone={onClose}
            />
          ) : (
            <div className="p-5 rounded-3xl border border-border bg-muted/40 space-y-3 min-w-0">
              <p className="text-sm text-muted-foreground">
                The issuer returned no secret — the credential row was still created.
              </p>
              <button
                onClick={onClose}
                className="h-11 px-4 rounded-2xl border border-border text-sm text-muted-foreground hover:text-foreground transition-colors w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
              >
                Done
              </button>
            </div>
          )}
        </div>
      ) : oauthDone ? (
        <div className="p-5 rounded-3xl border border-emerald-500/20 bg-emerald-500/5 space-y-3 min-w-0">
          <p className="text-sm text-emerald-800 dark:text-emerald-300">
            {oauthDone} connected via provider login — tokens sealed server-side.
          </p>
          <button
            onClick={onClose}
            className="h-11 px-4 rounded-2xl border border-border text-sm text-muted-foreground hover:text-foreground transition-colors w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
          >
            Done
          </button>
        </div>
      ) : (
        <>
          <p className="text-xs font-mono text-muted-foreground tabular-nums" title={`Provider: ${provider}`}>
            Provider: <span className="text-foreground">{provider}</span> · sealed once, metadata after
          </p>

          <SegmentedControl label="Method" options={METHODS} value={method} onChange={(next) => { setMethod(next); setError(null); }} />

          {method === "api_key" && (
            <div className="space-y-3 min-w-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 min-w-0">
                <Field label="Location">
                  <select
                    value={location}
                    onChange={(event) => setLocation(event.target.value)}
                    aria-label="API key location"
                    className={cn(fieldStyles.fieldSm, "min-w-0")}
                  >
                    <option value="header">Header</option>
                    <option value="query">Query param</option>
                  </select>
                </Field>
                <Field label="Header name" hint={location === "query" ? "Query keys can land in upstream logs — prefer header." : undefined}>
                  <input
                    value={headerName}
                    onChange={(event) => setHeaderName(event.target.value)}
                    placeholder="X-API-Key"
                    aria-label="API key name"
                    autoComplete="off"
                    className={cn(fieldStyles.fieldSm, "font-mono text-xs min-w-0")}
                  />
                </Field>
              </div>
              <Field label="Key value" hint="Vault-sealed on save. Pasted value never persists in the UI.">
                <input
                  value={secret}
                  onChange={(event) => setSecret(event.target.value)}
                  type="password"
                  placeholder="Paste the key"
                  aria-label="API key value"
                  autoComplete="off"
                  className={cn(fieldStyles.fieldSm, "font-mono text-xs min-w-0")}
                />
              </Field>
              <button
                onClick={handleApiKey}
                disabled={!secret.trim() || !headerName.trim() || connect.isPending}
                className="w-full h-11 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
              >
                {connect.isPending && <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                Seal credential
              </button>
            </div>
          )}

          {method === "bearer" && (
            <div className="space-y-3 min-w-0">
              <Field label="Bearer token" hint="Sent as Authorization: Bearer on every call.">
                <input
                  value={secret}
                  onChange={(event) => setSecret(event.target.value)}
                  type="password"
                  placeholder="Paste the bearer token"
                  aria-label="Bearer token"
                  autoComplete="off"
                  className={cn(fieldStyles.fieldSm, "font-mono text-xs min-w-0")}
                />
              </Field>
              <button
                onClick={handleBearer}
                disabled={!secret.trim() || connect.isPending}
                className="w-full h-11 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
              >
                {connect.isPending && <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                Seal credential
              </button>
            </div>
          )}

          {method === "basic" && (
            <div className="space-y-3 min-w-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 min-w-0">
                <Field label="Username">
                  <input
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder="username"
                    aria-label="Basic username"
                    autoComplete="off"
                    className={cn(fieldStyles.fieldSm, "font-mono text-xs min-w-0")}
                  />
                </Field>
                <Field label="Password" hint="Sealed; username rides in metadata config.">
                  <input
                    value={secret}
                    onChange={(event) => setSecret(event.target.value)}
                    type="password"
                    placeholder="••••••"
                    aria-label="Basic password"
                    autoComplete="off"
                    className={cn(fieldStyles.fieldSm, "font-mono text-xs min-w-0")}
                  />
                </Field>
              </div>
              <button
                onClick={handleBasic}
                disabled={!username.trim() || !secret.trim() || connect.isPending}
                className="w-full h-11 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
              >
                {connect.isPending && <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                Seal credential
              </button>
            </div>
          )}

          {method === "oauth_token" && (
            <div className="space-y-3 min-w-0">
              <Field label="Access token" hint="Stored as an oauth2 credential. Refresh via reconnect.">
                <input
                  value={secret}
                  onChange={(event) => setSecret(event.target.value)}
                  type="password"
                  placeholder="Paste the access token"
                  aria-label="OAuth access token"
                  autoComplete="off"
                  className={cn(fieldStyles.fieldSm, "font-mono text-xs min-w-0")}
                />
              </Field>
              <button
                onClick={handleOauthToken}
                disabled={!secret.trim() || connect.isPending}
                className="w-full h-11 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
              >
                {connect.isPending && <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                Seal credential
              </button>
            </div>
          )}

          {method === "dcr" && (
            <div className="space-y-3 min-w-0">
              <Field label="Issuer URL" hint="Discovers the OAuth server, registers a client, seals the secret.">
                <input
                  value={issuerUrl}
                  onChange={(event) => setIssuerUrl(event.target.value)}
                  placeholder="https://issuer.example.com"
                  aria-label="Issuer URL"
                  autoComplete="off"
                  inputMode="url"
                  className={cn(fieldStyles.fieldSm, "font-mono text-xs min-w-0")}
                />
              </Field>
              <button
                onClick={() => void handleDcr()}
                disabled={!issuerUrl.trim() || dcr.isPending}
                className="w-full h-11 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
              >
                {dcr.isPending && <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                Register client
              </button>
            </div>
          )}

          {method === "login" && (
            <div className="space-y-3 min-w-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 min-w-0">
                <Field label="Authorization endpoint">
                  <input
                    value={authEndpoint}
                    onChange={(event) => setAuthEndpoint(event.target.value)}
                    placeholder="https://provider.example.com/auth"
                    aria-label="OAuth authorization endpoint"
                    autoComplete="off"
                    inputMode="url"
                    className={cn(fieldStyles.fieldSm, "font-mono text-xs min-w-0")}
                  />
                </Field>
                <Field label="Token endpoint">
                  <input
                    value={tokenEndpoint}
                    onChange={(event) => setTokenEndpoint(event.target.value)}
                    placeholder="https://provider.example.com/token"
                    aria-label="OAuth token endpoint"
                    autoComplete="off"
                    inputMode="url"
                    className={cn(fieldStyles.fieldSm, "font-mono text-xs min-w-0")}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 min-w-0">
                <Field label="Client ID">
                  <input
                    value={clientId}
                    onChange={(event) => setClientId(event.target.value)}
                    placeholder="oauth-client-id"
                    aria-label="OAuth login client ID"
                    autoComplete="off"
                    className={cn(fieldStyles.fieldSm, "font-mono text-xs min-w-0")}
                  />
                </Field>
                <Field label="Client secret" hint="Confidential clients only.">
                  <input
                    value={clientSecret}
                    onChange={(event) => setClientSecret(event.target.value)}
                    type="password"
                    placeholder="Optional"
                    aria-label="OAuth login client secret"
                    autoComplete="off"
                    className={cn(fieldStyles.fieldSm, "font-mono text-xs min-w-0")}
                  />
                </Field>
              </div>
              <button
                onClick={() => void handleLogin()}
                disabled={!authEndpoint.trim() || !tokenEndpoint.trim() || !clientId.trim() || authorize.isPending}
                className="w-full h-11 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
              >
                {authorize.isPending && <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                Open provider login
              </button>
              <p className="text-[11px] text-muted-foreground">
                A popup opens the provider login — approving seals the tokens, nothing to paste.
              </p>
            </div>
          )}

          {error && <FormAlert message={error} />}
          {!done && (
            <p className="text-[11px] text-muted-foreground">
              The secret is vault-sealed and shown once — list views only ever carry metadata.
            </p>
          )}
        </>
      )}
    </Modal>
  );
}
