"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  Check,
  Copy,
  KeyRound,
  Link2,
  Loader2,
  Plug,
  PlugZap,
  Plus,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import {
  useConnectCredential,
  useDcrRegister,
  useDeleteTemplate,
  useIntegrationTemplates,
  useLinkIntegration,
  usePartnerCredentials,
  usePartnerIntegrations,
  useRevokeCredential,
  useUnlinkIntegration,
} from "@/services/platform/mcp";
import type { CredentialMeta, McpTemplate, PartnerIntegration } from "@/lib/schemas/platform";
import { Modal } from "@/components/common/modal";
import { SearchInput } from "@/components/common/search-input";
import { SectionHeader } from "@/components/common/section-header";
import { SettingsStatCard, SettingsStatsGrid } from "@/components/settings/settings-stats";
import { IntegrationBuilder } from "@/components/settings/org-integration-builder";
import { fieldStyles } from "@/lib/field-styles";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { minRoleFor, useCan } from "@/lib/rbac";

/** Credential expiry computed from real expires_at only — never invented. */
const EXPIRING_SOON_MS = 7 * 24 * 60 * 60 * 1000;

function expiryState(expiresAt: string | null | undefined, nowMs: number): {
  label: string;
  title: string;
  tone: "bad" | "warn" | "muted";
} {
  if (!expiresAt) return { label: "never expires", title: "No expires_at — never expires", tone: "muted" };
  const parsed = new Date(expiresAt).getTime();
  if (!Number.isFinite(parsed)) return { label: "—", title: expiresAt, tone: "muted" };
  if (parsed < nowMs)
    return { label: `expired ${timeAgo(expiresAt, nowMs)}`, title: `Expired at ${expiresAt}`, tone: "bad" };
  const daysLeft = Math.ceil((parsed - nowMs) / (24 * 60 * 60 * 1000));
  if (parsed - nowMs < EXPIRING_SOON_MS)
    return { label: daysLeft <= 1 ? "expires within a day" : `expires in ${daysLeft}d`, title: `Expires at ${expiresAt}`, tone: "warn" };
  return { label: `expires ${new Date(expiresAt).toLocaleDateString()}`, title: `Expires at ${expiresAt}`, tone: "muted" };
}

function isSystemTemplate(template: McpTemplate): boolean {
  return template.tenant_id === "system";
}

function McpStats() {
  const templatesQuery = useIntegrationTemplates();
  const credentialsQuery = usePartnerCredentials();
  const integrationsQuery = usePartnerIntegrations();
  const isLoading = templatesQuery.isLoading || credentialsQuery.isLoading || integrationsQuery.isLoading;
  const counts = useMemo(() => {
    const templates = templatesQuery.data ?? [];
    return {
      templates: templates.length,
      providers: new Set(templates.map((template) => template.provider)).size,
      connected: (credentialsQuery.data ?? []).length,
      links: (integrationsQuery.data ?? []).length,
    };
  }, [templatesQuery.data, credentialsQuery.data, integrationsQuery.data]);
  return (
    <SettingsStatsGrid label="MCP provider summary">
      <SettingsStatCard
        title="Templates"
        icon={PlugZap}
        value={isLoading ? "—" : String(counts.templates)}
        caption={isLoading ? "Loading" : "Curated providers"}
        loading={isLoading}
        delay={0}
      />
      <SettingsStatCard
        title="Providers"
        icon={Plug}
        value={isLoading ? "—" : String(counts.providers)}
        caption={isLoading ? "Loading" : "Distinct template owners"}
        loading={isLoading}
        delay={0.05}
      />
      <SettingsStatCard
        title="Connected"
        icon={KeyRound}
        value={isLoading ? "—" : String(counts.connected)}
        caption={isLoading ? "Loading" : "Live vault credentials"}
        loading={isLoading}
        delay={0.1}
      />
      <SettingsStatCard
        title="Links"
        icon={Link2}
        value={isLoading ? "—" : String(counts.links)}
        caption={isLoading ? "Loading" : "Provider → agent bindings"}
        loading={isLoading}
        delay={0.15}
      />
    </SettingsStatsGrid>
  );
}

function TemplateCard({
  template,
  connected,
  canManage,
  expanded,
  onToggle,
  onConnect,
  onDelete,
}: {
  template: McpTemplate;
  connected: boolean;
  canManage: boolean;
  expanded: boolean;
  onToggle: () => void;
  onConnect: () => void;
  onDelete: () => void;
}) {
  const toolCount = template.tools_template.length;
  const system = isSystemTemplate(template);
  const toolNames = template.tools_template
    .map((entry) => (typeof entry === "object" && entry !== null ? String((entry as Record<string, unknown>).name ?? "") : ""))
    .filter(Boolean);
  return (
    <div className="p-5 md:p-6 bg-card border border-border rounded-3xl min-w-0">
      <div className="flex items-start justify-between gap-3 mb-3 min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <Plug className="w-4 h-4 text-ember-700 dark:text-ember-300" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h4 className="font-medium text-foreground tracking-tight truncate" title={template.provider}>
              {template.provider}
            </h4>
            <p
              className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground truncate tabular-nums"
              title={`${template.credential_type} · ${toolCount} ${toolCount === 1 ? "tool" : "tools"}`}
            >
              {template.credential_type} · {toolCount} {toolCount === 1 ? "tool" : "tools"}
            </p>
          </div>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider border shrink-0",
            connected
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
              : "bg-muted text-muted-foreground border-border"
          )}
          title={connected ? "A live credential is stored for this provider" : "No credential stored yet"}
        >
          {connected && <Check className="w-3 h-3" aria-hidden="true" />}
          {connected ? "Live" : "New"}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 mb-3 min-w-0">
        <span
          className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-primary/10 text-foreground border border-primary/20 shrink-0"
          title={template.transport === "mcp" ? "MCP server — tools auto-discover" : "Generic HTTP — manual tool schemas"}
        >
          {template.transport === "mcp" ? "MCP" : "HTTP"}
        </span>
        {system ? (
          <span
            className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-muted text-muted-foreground border border-border shrink-0"
            title="System row — curated in code review, read-only"
          >
            System
          </span>
        ) : (
          <span
            className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-primary/10 text-foreground border border-primary/20 shrink-0"
            title="Tenant override — created here, deletable"
          >
            Custom
          </span>
        )}
        <button
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={`${expanded ? "Hide" : "Show"} ${template.provider} template detail`}
          title={`${expanded ? "Hide" : "Show"} template detail`}
          className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-muted text-muted-foreground border border-border hover:text-foreground transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
        >
          {expanded ? "Hide detail" : "Detail"}
        </button>
      </div>
      {expanded && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-3 rounded-2xl border border-border bg-muted/40 p-3 space-y-2 min-w-0 motion-reduce:transition-none"
        >
          <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Tools offered</p>
          {toolNames.length === 0 ? (
            <p className="text-xs text-muted-foreground">No curated tools — links use runtime config.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5 min-w-0">
              {toolNames.map((name) => (
                <span
                  key={name}
                  className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-card text-foreground border border-border truncate max-w-full"
                  title={name}
                >
                  {name}
                </span>
              ))}
            </div>
          )}
          <p
            className="text-[11px] font-mono text-muted-foreground truncate tabular-nums"
            title={`oauth_config ${Object.keys(template.oauth_config).length} keys · client_config ${Object.keys(template.client_config).length} keys`}
          >
            oauth {Object.keys(template.oauth_config).length} keys · client {Object.keys(template.client_config).length} keys
          </p>
        </motion.div>
      )}
      <div className="flex gap-2 min-w-0">
        {canManage && (
          <button
            onClick={onConnect}
            className="flex-1 h-9 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none truncate px-2"
          >
            {connected ? "Reconnect" : "Connect"}
          </button>
        )}
        {canManage && !system && (
          <button
            onClick={onDelete}
            aria-label={`Delete ${template.provider} template override`}
            title={`Delete ${template.provider} template override`}
            className="h-9 w-9 shrink-0 flex items-center justify-center rounded-xl text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 motion-reduce:transition-none"
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}

function TemplatesSection({ onConnect }: { onConnect: (provider: string) => void }) {
  const canManage = useCan("keys.manage");
  const { data: templates, isLoading } = useIntegrationTemplates();
  const { data: credentials } = usePartnerCredentials();
  const removeTemplate = useDeleteTemplate();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const connectedProviders = useMemo(
    () => new Set((credentials ?? []).map((credential) => credential.provider)),
    [credentials]
  );
  return (
    <section className="rounded-3xl border border-border bg-card p-5 md:p-6 min-w-0">
      <SectionHeader
        title="MCP providers"
        description="Curated providers. Build a custom integration or connect a credential to enable agent links."
        className="mb-6"
      />
      {canManage && (
        <button
          onClick={() => setBuilderOpen(true)}
          className="w-full h-11 mb-4 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
        >
          <Wand2 className="w-4 h-4" aria-hidden="true" />
          New custom integration
        </button>
      )}
      {builderOpen && <IntegrationBuilder onClose={() => setBuilderOpen(false)} />}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-36 rounded-3xl bg-muted/50 border border-border animate-pulse motion-reduce:animate-none" />
          ))}
        </div>
      ) : (templates ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground rounded-3xl border border-dashed border-border p-10 text-center">
          No provider templates on this backend yet.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 min-w-0">
          {(templates ?? []).map((template) => (
            <div key={template.provider} className="space-y-2 min-w-0">
              <TemplateCard
                template={template}
                connected={connectedProviders.has(template.provider)}
                canManage={canManage}
                expanded={expanded === template.provider}
                onToggle={() => setExpanded((current) => (current === template.provider ? null : template.provider))}
                onConnect={() => onConnect(template.provider)}
                onDelete={() => setConfirmDelete(template.provider)}
              />
              {confirmDelete === template.provider && (
                <div className="flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/5 p-3 min-w-0">
                  <p className="flex-1 text-xs text-muted-foreground truncate min-w-0" title={`Delete ${template.provider} override? Links keep working until unlinked.`}>
                    Delete {template.provider} override?
                  </p>
                  <button
                    onClick={() => void removeTemplate.mutateAsync(template.provider).finally(() => setConfirmDelete(null))}
                    disabled={removeTemplate.isPending}
                    className="h-8 px-3 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-semibold transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 motion-reduce:transition-none"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setConfirmDelete(null)}
                    aria-label="Cancel template delete"
                    className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
                  >
                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function SecretOnceBox({
  title,
  secret,
  onCopy,
  copied,
  onDone,
}: {
  title: string;
  secret: string;
  onCopy: () => void;
  copied: boolean;
  onDone: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-5 rounded-3xl border border-emerald-500/20 bg-emerald-500/5 space-y-3 min-w-0 motion-reduce:transition-none"
    >
      <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300" title={title}>
        {title}
      </p>
      <div className="flex gap-2 min-w-0">
        <code
          className="flex-1 min-w-0 truncate h-11 px-4 flex items-center bg-card border border-border rounded-2xl font-mono text-xs text-foreground"
          title={secret}
        >
          {secret}
        </code>
        <button
          onClick={onCopy}
          aria-label="Copy one-time secret"
          title="Copy one-time secret"
          className="h-11 w-11 shrink-0 flex items-center justify-center rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 motion-reduce:transition-none"
        >
          {copied ? <Check className="w-4 h-4" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
        </button>
        <button
          onClick={onDone}
          className="h-11 px-4 rounded-2xl border border-border text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
        >
          Done
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground">Copy it now — it will never show again.</p>
    </motion.div>
  );
}

function ConnectDialog({ provider, onClose }: { provider: string; onClose: () => void }) {
  const connect = useConnectCredential();
  const dcr = useDcrRegister();
  const [tab, setTab] = useState<"manual" | "dcr">("manual");
  const [credentialType, setCredentialType] = useState("");
  const [secret, setSecret] = useState("");
  const [issuerUrl, setIssuerUrl] = useState("");
  const [dcrProvider, setDcrProvider] = useState(provider);
  const [secretOnce, setSecretOnce] = useState<{ provider: string; secret: string; replaced: boolean } | null>(null);
  const [dcrOnce, setDcrOnce] = useState<{ clientId: string; issuerUrl: string; secret: string | null } | null>(null);
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

  const handleManualConnect = async () => {
    if (!secret.trim() || connect.isPending) return;
    setError(null);
    // Empty select means "auto" — omit so the schema default (api_key) applies.
    const credential_type =
      credentialType === "oauth2" || credentialType === "api_key" ? credentialType : undefined;
    try {
      const result = await connect.mutateAsync({ provider, credential_type, secret: secret.trim() });
      setCopied(false);
      // Security: the plaintext surfaces ONLY here — the dialog owns it and it
      // dies with the dialog (Done closes, nothing is kept elsewhere).
      setSecretOnce({ provider: result.meta.provider, secret: result.secret_once, replaced: result.replaced });
      setSecret("");
    } catch {
      setError("Could not seal that secret. Is the backend running?");
    }
  };

  const handleDcrRegister = async () => {
    if (!issuerUrl.trim() || !dcrProvider.trim() || dcr.isPending) return;
    setError(null);
    try {
      const result = await dcr.mutateAsync({ issuer_url: issuerUrl.trim(), provider: dcrProvider.trim() });
      setCopied(false);
      setDcrOnce({
        clientId: result.client_id,
        issuerUrl: result.issuer_url,
        secret: result.client_secret_once ?? null,
      });
      setIssuerUrl("");
    } catch {
      setError("Registration failed — the issuer may be undiscoverable or manual-only.");
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      label={`Connect ${provider}`}
      title={<h4 className="font-semibold text-foreground">Connect {provider}</h4>}
      className="max-w-md space-y-3"
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
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            {(["manual", "dcr"] as const).map((option) => (
              <button
                key={option}
                onClick={() => {
                  setTab(option);
                  setError(null);
                }}
                aria-pressed={tab === option}
                className={cn(
                  "h-10 rounded-xl border text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none",
                  tab === option
                    ? "border-primary/40 bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {option === "manual" ? "Manual key" : "DCR register"}
              </button>
            ))}
          </div>

          {tab === "manual" ? (
            <>
              <p className="text-xs font-mono text-muted-foreground truncate tabular-nums" title={`Provider: ${provider}`}>
                Provider: <span className="text-foreground">{provider}</span>
              </p>
              <label className="flex flex-col gap-1.5 min-w-0">
                <span className="text-xs font-medium text-foreground">Credential type</span>
                <select
                  value={credentialType}
                  onChange={(event) => setCredentialType(event.target.value)}
                  aria-label="Credential type"
                  className={cn(fieldStyles.fieldSm, "min-w-0")}
                >
                  <option value="">Type: auto (api_key)</option>
                  <option value="api_key">api_key</option>
                  <option value="oauth2">oauth2</option>
                </select>
              </label>
              <label className="flex flex-col gap-1.5 min-w-0">
                <span className="text-xs font-medium text-foreground">Secret</span>
                <input
                  value={secret}
                  onChange={(event) => setSecret(event.target.value)}
                  type="password"
                  placeholder="Paste the provider secret"
                  aria-label="Provider secret"
                  autoComplete="off"
                  className={cn(fieldStyles.fieldSm, "font-mono text-xs")}
                />
              </label>
              <button
                onClick={() => void handleManualConnect()}
                disabled={!secret.trim() || connect.isPending}
                className="w-full h-11 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
              >
                {connect.isPending && <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                Seal credential
              </button>
              <p className="text-[11px] text-muted-foreground">
                The secret is vault-sealed and shown once — list views only ever carry metadata.
              </p>
            </>
          ) : (
            <>
              <label className="flex flex-col gap-1.5 min-w-0">
                <span className="text-xs font-medium text-foreground">Issuer URL</span>
                <input
                  value={issuerUrl}
                  onChange={(event) => setIssuerUrl(event.target.value)}
                  placeholder="https://issuer.example.com"
                  aria-label="Issuer URL"
                  autoComplete="off"
                  className={cn(fieldStyles.fieldSm, "font-mono text-xs")}
                />
              </label>
              <label className="flex flex-col gap-1.5 min-w-0">
                <span className="text-xs font-medium text-foreground">Provider</span>
                <input
                  value={dcrProvider}
                  onChange={(event) => setDcrProvider(event.target.value)}
                  placeholder="github"
                  aria-label="DCR provider name"
                  autoComplete="off"
                  className={cn(fieldStyles.fieldSm, "font-mono text-xs")}
                />
              </label>
              <button
                onClick={() => void handleDcrRegister()}
                disabled={!issuerUrl.trim() || !dcrProvider.trim() || dcr.isPending}
                className="w-full h-11 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
              >
                {dcr.isPending && <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                Register client
              </button>
              <p className="text-[11px] text-muted-foreground">
                Registers an OAuth client at the issuer and seals the issued secret — shown once.
              </p>
            </>
          )}

          {error && (
            <p role="alert" className="flex items-center gap-2 text-xs text-destructive">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /> {error}
            </p>
          )}
        </>
      )}
    </Modal>
  );
}

function CredentialsSection() {
  const canManage = useCan("keys.manage");
  const { data: credentials, isLoading } = usePartnerCredentials();
  const revoke = useRevokeCredential();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [nowMs] = useState(() => Date.now());

  return (
    <section className="rounded-3xl border border-border bg-card p-5 md:p-6 min-w-0">
      <SectionHeader
        title="Credentials"
        description={
          <>
            Vault metadata only — secrets never show again. Revokes take effect immediately.
            {!canManage && ` Read-only — requires ${minRoleFor("keys.manage")} role.`}
          </>
        }
        className="mb-6"
      />
      {isLoading ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-20 rounded-3xl bg-muted/50 border border-border animate-pulse motion-reduce:animate-none" />
          ))}
        </div>
      ) : (credentials ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground rounded-3xl border border-dashed border-border p-10 text-center">
          No credentials sealed yet. Connect a provider above to start linking agents.
        </p>
      ) : (
        <div className="flex flex-col gap-3 min-w-0">
          {(credentials ?? []).map((credential: CredentialMeta) => {
            const expiry = expiryState(credential.expires_at, nowMs);
            return (
              <div
                key={credential.id}
                className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center p-4 md:px-5 bg-muted/40 border border-border rounded-3xl min-w-0"
              >
                <div className="lg:col-span-5 flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0" aria-hidden="true">
                    <KeyRound className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate" title={credential.provider}>
                      {credential.provider}
                    </p>
                    <p
                      className="text-xs font-mono text-muted-foreground truncate tabular-nums"
                      title={`${credential.credential_type} · key version ${credential.key_version} · secret masked`}
                    >
                      {credential.credential_type} · v{credential.key_version} · ••••••
                    </p>
                  </div>
                </div>
                <div className="lg:col-span-5 min-w-0">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-mono tabular-nums truncate max-w-full",
                      expiry.tone === "bad" &&
                        "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
                      expiry.tone === "warn" &&
                        "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
                      expiry.tone === "muted" && "bg-muted text-muted-foreground border-border"
                    )}
                    title={expiry.title}
                  >
                    <span
                      className={cn(
                        "w-1.5 h-1.5 rounded-full shrink-0",
                        expiry.tone === "bad" && "bg-red-500",
                        expiry.tone === "warn" && "bg-amber-500",
                        expiry.tone === "muted" && "bg-muted-foreground"
                      )}
                      aria-hidden="true"
                    />
                    <span className="truncate">{expiry.label}</span>
                  </span>
                </div>
                <div className="lg:col-span-2 flex lg:justify-end min-w-0">
                  {canManage &&
                    (confirmId === credential.id ? (
                      <span className="flex items-center gap-1.5 min-w-0">
                        <button
                          onClick={() => void revoke.mutateAsync(credential.id).finally(() => setConfirmId(null))}
                          disabled={revoke.isPending}
                          className="h-8 px-3 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-semibold transition-colors shrink-0 flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 motion-reduce:transition-none"
                        >
                          {revoke.isPending && (
                            <Loader2 className="w-3.5 h-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                          )}
                          Confirm
                        </button>
                        <button
                          onClick={() => setConfirmId(null)}
                          aria-label={`Cancel revoking ${credential.provider}`}
                          title={`Cancel revoking ${credential.provider}`}
                          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
                        >
                          <X className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setConfirmId(credential.id)}
                        aria-label={`Revoke ${credential.provider} credential`}
                        title={`Revoke ${credential.provider} credential`}
                        className="px-4 h-9 rounded-xl text-xs font-medium text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0 flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 motion-reduce:transition-none"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" /> Revoke
                      </button>
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function LinkRow({ link }: { link: PartnerIntegration }) {
  const unlink = useUnlinkIntegration();
  const canManage = useCan("keys.manage");
  const [confirming, setConfirming] = useState(false);
  const active = link.status === "active";
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center p-4 md:px-5 bg-muted/40 border border-border rounded-3xl min-w-0">
      <div className="lg:col-span-6 min-w-0">
        <p
          className="text-sm font-mono text-foreground truncate tabular-nums"
          title={`${link.provider} → ${link.agent_id}`}
        >
          {link.provider} <span className="text-muted-foreground">→</span> {link.agent_id}
        </p>
        {link.negotiated_protocol_version && (
          <p
            className="text-[11px] font-mono text-muted-foreground truncate tabular-nums mt-0.5"
            title={`Negotiated protocol ${link.negotiated_protocol_version}`}
          >
            protocol {link.negotiated_protocol_version}
          </p>
        )}
      </div>
      <div className="lg:col-span-4 min-w-0">
        <span
          className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider border",
            active
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
              : "bg-muted text-muted-foreground border-border"
          )}
          title={active ? "Linked and live" : `Status: ${link.status}`}
        >
          {active && <Check className="w-3 h-3" aria-hidden="true" />}
          {link.status}
        </span>
      </div>
      <div className="lg:col-span-2 flex lg:justify-end min-w-0">
        {canManage &&
          (confirming ? (
            <span className="flex items-center gap-1.5 min-w-0">
              <button
                onClick={() => void unlink.mutateAsync(link.id).finally(() => setConfirming(false))}
                disabled={unlink.isPending}
                aria-label={`Confirm unlink ${link.provider} from ${link.agent_id}`}
                className="h-8 px-3 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-semibold transition-colors shrink-0 flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 motion-reduce:transition-none"
              >
                {unlink.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                ) : (
                  <Check className="w-3.5 h-3.5" aria-hidden="true" />
                )}
                Unlink
              </button>
              <button
                onClick={() => setConfirming(false)}
                aria-label="Cancel unlink"
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </span>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              aria-label={`Unlink ${link.provider} from ${link.agent_id}`}
              title={`Unlink ${link.provider} from ${link.agent_id}`}
              className="px-4 h-9 rounded-xl text-xs font-medium text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0 flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 motion-reduce:transition-none"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" /> Unlink
            </button>
          ))}
      </div>
    </div>
  );
}

function LinksSection() {
  const canManage = useCan("keys.manage");
  const { data: links, isLoading } = usePartnerIntegrations();
  const { data: templates } = useIntegrationTemplates();
  const { data: credentials } = usePartnerCredentials();
  const link = useLinkIntegration();

  const [agentFilter, setAgentFilter] = useState("");
  const [provider, setProvider] = useState("");
  const [agentId, setAgentId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const providers = useMemo(() => {
    const names = new Set<string>();
    (templates ?? []).forEach((template) => names.add(template.provider));
    (credentials ?? []).forEach((credential) => names.add(credential.provider));
    return [...names].sort();
  }, [templates, credentials]);

  const visible = useMemo(() => {
    const needle = agentFilter.trim().toLowerCase();
    const list = links ?? [];
    if (!needle) return list;
    return list.filter((row) =>
      `${row.provider} ${row.agent_id}`.toLowerCase().includes(needle)
    );
  }, [links, agentFilter]);

  const showFilter = (links ?? []).length > 1;

  const handleLink = async () => {
    setFormError(null);
    if (!provider || !agentId.trim()) {
      setFormError("Pick a provider and an agent first.");
      return;
    }
    try {
      await link.mutateAsync({ provider, agent_id: agentId.trim() });
      setProvider("");
      setAgentId("");
    } catch {
      setFormError("Could not link — the provider may have no live credential.");
    }
  };

  return (
    <section className="rounded-3xl border border-border bg-card p-5 md:p-6 min-w-0">
      <SectionHeader
        title="Agent links"
        description={
          <>
            Provider → agent bindings. Linking needs a live credential.
            {!canManage && ` Read-only — requires ${minRoleFor("keys.manage")} role.`}
          </>
        }
        className="mb-6"
      />

      {canManage && (
        <div className="rounded-3xl border border-border bg-muted/40 p-4 md:p-5 space-y-3 mb-4 min-w-0">
          <p className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">New link</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 min-w-0">
            <select
              value={provider}
              onChange={(event) => setProvider(event.target.value)}
              aria-label="Link provider"
              className={cn(fieldStyles.fieldSm, "min-w-0")}
            >
              <option value="">Provider…</option>
              {providers.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <input
              value={agentId}
              onChange={(event) => setAgentId(event.target.value)}
              placeholder="Agent ID, e.g. agent-1"
              aria-label="Link agent ID"
              autoComplete="off"
              className={cn(fieldStyles.fieldSm, "font-mono text-xs min-w-0")}
            />
          </div>
          {formError && (
            <p role="alert" className="flex items-center gap-2 text-xs text-destructive min-w-0">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate" title={formError}>
                {formError}
              </span>
            </p>
          )}
          <button
            onClick={() => void handleLink()}
            disabled={!provider || !agentId.trim() || link.isPending}
            className="w-full sm:w-auto h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
          >
            {link.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            ) : (
              <Plus className="w-4 h-4" aria-hidden="true" />
            )}
            Link provider
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-20 rounded-3xl bg-muted/50 border border-border animate-pulse motion-reduce:animate-none" />
          ))}
        </div>
      ) : (links ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground rounded-3xl border border-dashed border-border p-10 text-center">
          No providers linked yet. Seal a credential, then link it to an agent.
        </p>
      ) : (
        <>
          {showFilter && (
            <div className="mb-4">
              <SearchInput
                value={agentFilter}
                onChange={setAgentFilter}
                placeholder="Filter by agent or provider…"
                label="Filter agent links"
                className="!w-full max-w-none sm:max-w-xs"
              />
            </div>
          )}
          {visible.length === 0 ? (
            <p className="text-sm text-muted-foreground rounded-3xl border border-dashed border-border p-10 text-center">
              No links match this filter.
            </p>
          ) : (
            <div className="flex flex-col gap-3 min-w-0">
              {visible.map((row) => (
                <LinkRow key={row.id} link={row} />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

export function OrgMcp() {
  const [connectProvider, setConnectProvider] = useState<string | null>(null);

  return (
    <div className="space-y-6 min-w-0">
      <McpStats />

      <TemplatesSection onConnect={setConnectProvider} />

      <CredentialsSection />

      <LinksSection />

      {connectProvider && <ConnectDialog provider={connectProvider} onClose={() => setConnectProvider(null)} />}

      <p
        className="text-xs font-mono text-muted-foreground tabular-nums truncate"
        title="Secrets show once · Links need a live credential"
      >
        Secrets show once · Links need a live credential.
      </p>
    </div>
  );
}
