"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  Check,
  KeyRound,
  Link2,
  Loader2,
  Plug,
  PlugZap,
  Plus,
  Trash2,
  Webhook,
  X,
} from "lucide-react";
import {
  useDeleteTemplate,
  useIntegrationTemplates,
  useLinkIntegration,
  usePartnerCredentials,
  usePartnerIntegrations,
  useRevokeCredential,
  useUnlinkIntegration,
} from "@/services/platform/mcp";
import type { CredentialMeta, McpTemplate, PartnerIntegration } from "@/lib/schemas/platform";
import { StatusPill } from "@/components/integrations/status-pill";
import { ProviderIcon } from "@/components/integrations/provider-icon";
import { McpConnectDialog } from "@/components/settings/mcp-connect-dialog";
import { CustomApiBuilder } from "@/components/settings/custom-api-builder";
import { McpServerBuilder } from "@/components/settings/mcp-server-builder";
import { SearchInput } from "@/components/common/search-input";
import { SectionHeader } from "@/components/common/section-header";
import { SettingsStatCard, SettingsStatsGrid } from "@/components/settings/settings-stats";
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
          <ProviderIcon kind="mcp" />
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
        <StatusPill
          status={connected ? "live" : "new"}
          title={connected ? "A live credential is stored for this provider" : "No credential stored yet"}
        />
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
  const [builder, setBuilder] = useState<"http" | "mcp" | null>(null);
  const connectedProviders = useMemo(
    () => new Set((credentials ?? []).map((credential) => credential.provider)),
    [credentials]
  );
  return (
    <section className="rounded-3xl border border-border bg-card p-5 md:p-6 min-w-0">
      <SectionHeader
        title="Providers"
        description="Curated providers plus your own. Connect a credential to enable agent links — or build a new one."
        className="mb-6"
      />
      {canManage && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
          <button
            onClick={() => setBuilder("http")}
            className="h-11 rounded-2xl border border-dashed border-border text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
          >
            <Webhook className="w-4 h-4" aria-hidden="true" />
            New custom API
          </button>
          <button
            onClick={() => setBuilder("mcp")}
            className="h-11 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
          >
            <PlugZap className="w-4 h-4" aria-hidden="true" />
            New MCP server
          </button>
        </div>
      )}
      {builder === "http" && <CustomApiBuilder onClose={() => setBuilder(null)} />}
      {builder === "mcp" && <McpServerBuilder onClose={() => setBuilder(null)} />}
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

export function OrgMcp({ showStats = true }: { showStats?: boolean } = {}) {
  const [connectProvider, setConnectProvider] = useState<string | null>(null);

  return (
    <div className="space-y-6 min-w-0">
      {showStats && <McpStats />}

      <TemplatesSection onConnect={setConnectProvider} />

      <CredentialsSection />

      <LinksSection />

      {connectProvider && <McpConnectDialog provider={connectProvider} onClose={() => setConnectProvider(null)} />}

      <p
        className="text-xs font-mono text-muted-foreground tabular-nums truncate"
        title="Secrets show once · Links need a live credential"
      >
        Secrets show once · Links need a live credential.
      </p>
    </div>
  );
}
