"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Check,
  CircleSlash,
  Copy,
  KeyRound,
  Loader2,
  Lock,
  Plus,
  ShieldCheck,
  Timer,
  Trash2,
  X,
} from "lucide-react";
import { timeAgo } from "@/lib/format";
import { useApiKeys, useCreateApiKey, useDeleteApiKey } from "@/services/platform/api-keys";
import { API_SCOPES } from "@/lib/schemas/platform";
import { minRoleFor, useCan } from "@/lib/rbac";
import { fieldStyles } from "@/lib/field-styles";
import { cn } from "@/lib/utils";
import { SearchInput } from "@/components/common/search-input";
import { SectionHeader } from "@/components/common/section-header";
import { SettingsStatCard, SettingsStatsGrid } from "@/components/settings/settings-stats";

const EXPIRY_OPTIONS = [
  { label: "Never", value: "" },
  { label: "30 days", value: "30" },
  { label: "90 days", value: "90" },
  { label: "1 year", value: "365" },
] as const;

/** Keys expiring within 7 days get "expiring soon" emphasis. Computed from real expires_at only. */
const EXPIRING_SOON_MS = 7 * 24 * 60 * 60 * 1000;

function isExpired(expiresAt: string | null | undefined, nowMs: number): boolean {
  if (!expiresAt) return false;
  const parsed = new Date(expiresAt).getTime();
  if (!Number.isFinite(parsed)) return false;
  return parsed < nowMs;
}

function isExpiringSoon(expiresAt: string | null | undefined, nowMs: number): boolean {
  if (!expiresAt) return false;
  const parsed = new Date(expiresAt).getTime();
  if (!Number.isFinite(parsed)) return false;
  const diff = parsed - nowMs;
  return diff > 0 && diff < EXPIRING_SOON_MS;
}

/** Honest expiry label computed from real expires_at only — never invented. */
function expiryLabel(expiresAt: string | null | undefined, nowMs: number): { label: string; title: string } {
  if (!expiresAt) return { label: "never expires", title: "No expires_at — never expires" };
  const parsed = new Date(expiresAt).getTime();
  if (!Number.isFinite(parsed)) return { label: "—", title: expiresAt };
  if (parsed < nowMs) {
    return { label: `expired ${timeAgo(expiresAt, nowMs)}`, title: `Expired at ${expiresAt}` };
  }
  const days = Math.ceil((parsed - nowMs) / (24 * 60 * 60 * 1000));
  if (days <= 1) return { label: "expires within a day", title: `Expires at ${expiresAt}` };
  return { label: `expires in ${days}d`, title: `Expires at ${expiresAt}` };
}

function KeysStats() {
  const { data: keys, isLoading } = useApiKeys();
  const [nowMs] = useState(() => Date.now());
  const totals = useMemo(() => {
    const list = keys ?? [];
    let active = 0;
    let expired = 0;
    let neverUsed = 0;
    list.forEach((key) => {
      if (isExpired(key.expires_at, nowMs)) expired += 1;
      else active += 1;
      if (!key.last_used_at) neverUsed += 1;
    });
    return { total: list.length, active, expired, neverUsed };
  }, [keys, nowMs]);
  return (
    <SettingsStatsGrid label="API key summary">
      <SettingsStatCard
        title="Total keys"
        icon={KeyRound}
        value={isLoading ? "—" : String(totals.total)}
        caption={isLoading ? "Loading" : `${totals.total} ${totals.total === 1 ? "key" : "keys"} in vault`}
        loading={isLoading}
        delay={0}
      />
      <SettingsStatCard
        title="Active"
        icon={ShieldCheck}
        value={isLoading ? "—" : String(totals.active)}
        caption={isLoading ? "Loading" : "Not expired"}
        loading={isLoading}
        delay={0.05}
      />
      <SettingsStatCard
        title="Expired"
        icon={Timer}
        value={isLoading ? "—" : String(totals.expired)}
        caption={isLoading ? "Loading" : "Past expires_at"}
        loading={isLoading}
        delay={0.1}
      />
      <SettingsStatCard
        title="Never used"
        icon={CircleSlash}
        value={isLoading ? "—" : String(totals.neverUsed)}
        caption={isLoading ? "Loading" : "No last_used_at yet"}
        loading={isLoading}
        delay={0.15}
      />
    </SettingsStatsGrid>
  );
}

function CreateKeySection() {
  const canManage = useCan("keys.manage");
  const createKey = useCreateApiKey();

  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>(["agents:read", "agents:write"]);
  const [expiry, setExpiry] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [freshSecret, setFreshSecret] = useState<{ name: string; key: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canManage) return null;

  const toggleScope = (scope: string) =>
    setScopes((prev) => (prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]));

  const handleCreate = async () => {
    setError(null);
    if (!name.trim()) {
      setError("Give the key a name first.");
      return;
    }
    try {
      const created = await createKey.mutateAsync({
        name: name.trim(),
        scopes,
        expires_in_days: expiry ? Number(expiry) : undefined,
      });
      // Security: secret is shown ONLY here at creation time — never refetched.
      setFreshSecret({ name: created.name, key: created.key });
      setName("");
      setScopes(["agents:read", "agents:write"]);
      setExpiry("");
      setShowForm(false);
    } catch {
      setError("Could not create the key. Is the backend running?");
    }
  };

  const copySecret = async () => {
    if (!freshSecret) return;
    try {
      await navigator.clipboard.writeText(freshSecret.key);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="rounded-3xl border border-border bg-card p-5 md:p-6 min-w-0">
      <SectionHeader
        title="Create key"
        description="Scoped Bearer token. The secret shows once — copy it now, it never shows again."
        action={
          !showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors flex items-center gap-2 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
            >
              <Plus className="w-4 h-4" aria-hidden="true" /> New key
            </button>
          ) : undefined
        }
        className="mb-6"
      />

      {freshSecret && (
        <div className="p-5 rounded-3xl border border-emerald-500/20 bg-emerald-500/5 space-y-3 mb-4 min-w-0">
          <p
            className="text-sm font-medium text-emerald-800 dark:text-emerald-300 truncate"
            title={`${freshSecret.name} created — copy it now, it will never show again.`}
          >
            {freshSecret.name} created — copy it now, it will never show again.
          </p>
          <div className="flex gap-2 min-w-0">
            <code
              className="flex-1 min-w-0 truncate h-11 px-4 flex items-center bg-card border border-border rounded-2xl font-mono text-xs text-foreground"
              title={freshSecret.key}
            >
              {freshSecret.key}
            </code>
            <button
              onClick={() => void copySecret()}
              aria-label="Copy secret key"
              title="Copy secret key"
              className="h-11 w-11 shrink-0 flex items-center justify-center rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 motion-reduce:transition-none"
            >
              {copied ? <Check className="w-4 h-4" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
            </button>
            <button
              onClick={() => {
                setFreshSecret(null);
                setCopied(false);
              }}
              className="h-11 px-4 rounded-2xl border border-border text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
            >
              Done
            </button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-3xl border border-border bg-muted/40 p-5 space-y-4 min-w-0 motion-reduce:transition-none"
          >
            <p className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">New key</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 min-w-0">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void handleCreate();
                  }
                }}
                placeholder="Key name, e.g. Production Gateway"
                aria-label="API key name"
                className={cn(fieldStyles.fieldSm, "min-w-0")}
              />
              <select
                value={expiry}
                onChange={(event) => setExpiry(event.target.value)}
                aria-label="Key expiry"
                className={cn(fieldStyles.fieldSm, "min-w-0")}
              >
                {EXPIRY_OPTIONS.map((option) => (
                  <option key={option.label} value={option.value}>
                    Expires: {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground mb-2">
                Scopes · <span className="tabular-nums">{scopes.length} of {API_SCOPES.length} selected</span>
              </p>
              <div className="flex flex-wrap gap-1.5 min-w-0">
                {API_SCOPES.map((scope) => (
                  <button
                    key={scope}
                    onClick={() => toggleScope(scope)}
                    aria-pressed={scopes.includes(scope)}
                    title={scope}
                    className={cn(
                      "px-2.5 py-1 rounded-full text-xs font-mono border transition-colors truncate max-w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none",
                      scopes.includes(scope)
                        ? "border-primary/40 bg-primary/10 text-foreground"
                        : "border-border text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {scope}
                  </button>
                ))}
              </div>
            </div>
            {error && (
              <p className="flex items-center gap-2 text-xs text-destructive min-w-0">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />{" "}
                <span className="truncate" title={error}>
                  {error}
                </span>
              </p>
            )}
            <div className="flex flex-wrap gap-2 min-w-0">
              <button
                onClick={() => void handleCreate()}
                disabled={createKey.isPending}
                className="flex-1 min-w-[140px] h-10 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
              >
                {createKey.isPending && (
                  <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                )}
                Create
              </button>
              <button
                onClick={() => {
                  setShowForm(false);
                  setError(null);
                }}
                className="h-10 px-4 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function KeysListSection() {
  const canManage = useCan("keys.manage");
  const { data: keys, isLoading } = useApiKeys();
  const deleteKey = useDeleteApiKey();

  const [query, setQuery] = useState("");
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);
  const [copiedPrefixId, setCopiedPrefixId] = useState<string | null>(null);
  const [nowMs] = useState(() => Date.now());

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = keys ?? [];
    if (!needle) return list;
    return list.filter((key) =>
      [key.name, key.prefix, (key.scopes ?? []).join(" ")].join(" ").toLowerCase().includes(needle)
    );
  }, [keys, query]);

  const showFilter = (keys ?? []).length > 1;

  const copyPrefix = async (keyId: string, prefix: string) => {
    try {
      await navigator.clipboard.writeText(prefix);
      setCopiedPrefixId(keyId);
      window.setTimeout(() => {
        setCopiedPrefixId((current) => (current === keyId ? null : current));
      }, 2000);
    } catch {
      setCopiedPrefixId(null);
    }
  };

  return (
    <section className="rounded-3xl border border-border bg-card p-5 md:p-6 min-w-0">
      <SectionHeader
        title="Keys"
        description={
          <>
            Prefix identifies each key — secrets never show again. Revokes take effect immediately.
            {!canManage && ` Read-only — requires ${minRoleFor("keys.manage")} role.`}
          </>
        }
        className="mb-6"
      />

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-20 rounded-3xl bg-muted/50 border border-border animate-pulse motion-reduce:animate-none"
            />
          ))}
        </div>
      ) : (keys ?? []).length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border p-10 text-center min-w-0">
          <div
            className="w-11 h-11 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3"
            aria-hidden="true"
          >
            <KeyRound className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
          </div>
          <p className="text-sm font-medium text-foreground truncate" title="No API keys yet">
            No API keys yet.
          </p>
          <p className="text-xs text-muted-foreground mt-1 truncate" title="Create one above to enable programmatic access">
            {canManage ? "Create one above to enable programmatic access." : "An admin can create the first key."}
          </p>
        </div>
      ) : (
        <>
          {showFilter && (
            <div className="mb-4">
              <SearchInput
                value={query}
                onChange={setQuery}
                placeholder="Filter by name, prefix or scope…"
                label="Filter API keys"
                className="!w-full max-w-none sm:max-w-xs"
              />
            </div>
          )}
          {visible.length === 0 ? (
            <p className="text-sm text-muted-foreground rounded-3xl border border-dashed border-border p-10 text-center">
              No keys match this filter.
            </p>
          ) : (
            <>
              <div className="hidden lg:grid lg:grid-cols-12 gap-3 px-5 py-2 text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
                <div className="lg:col-span-5 truncate">Key</div>
                <div className="lg:col-span-5 truncate">Scopes · Expiry</div>
                <div className="lg:col-span-2 text-right truncate">Actions</div>
              </div>
              <div className="flex flex-col gap-3 min-w-0">
                {visible.map((key) => {
                  const expired = isExpired(key.expires_at, nowMs);
                  const expiringSoon = isExpiringSoon(key.expires_at, nowMs);
                  const expiry = expiryLabel(key.expires_at, nowMs);
                  const scopesLabel = (key.scopes ?? []).join(" · ");
                  const activityTitle = `${key.prefix}•••• · created ${key.created_at}${key.last_used_at ? ` · used ${key.last_used_at}` : " · never used"}${key.expires_at ? ` · expires ${key.expires_at}` : " · never expires"}`;
                  return (
                    <div
                      key={key.key_id}
                      className={cn(
                        "grid grid-cols-1 lg:grid-cols-12 gap-3 items-center p-4 md:px-5 bg-muted/40 border rounded-3xl min-w-0",
                        expired ? "border-red-500/25" : "border-border"
                      )}
                    >
                      <div className="lg:col-span-5 flex items-center gap-3 min-w-0">
                        <div
                          className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0"
                          aria-hidden="true"
                        >
                          <KeyRound className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="flex items-center gap-2 min-w-0">
                            <span className="text-sm font-medium text-foreground truncate" title={key.name}>
                              {key.name}
                            </span>
                            {expired ? (
                              <span
                                className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20 shrink-0"
                                title={`Expired at ${key.expires_at ?? "—"}`}
                              >
                                Expired
                              </span>
                            ) : expiringSoon ? (
                              <span
                                className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 shrink-0"
                                title={`Expires at ${key.expires_at ?? "—"}`}
                              >
                                Expiring soon
                              </span>
                            ) : null}
                          </p>
                          <p className="flex items-center gap-1.5 min-w-0 mt-1">
                            <span
                              className="text-xs font-mono text-muted-foreground truncate tabular-nums"
                              title={activityTitle}
                            >
                              {key.prefix}•••• · created {timeAgo(key.created_at, nowMs)}
                              {key.last_used_at ? ` · used ${timeAgo(key.last_used_at, nowMs)}` : " · never used"}
                            </span>
                            <button
                              onClick={() => void copyPrefix(key.key_id, key.prefix)}
                              aria-label={`Copy prefix for ${key.name}`}
                              title={`Copy prefix ${key.prefix}`}
                              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
                            >
                              {copiedPrefixId === key.key_id ? (
                                <Check className="w-3.5 h-3.5" aria-hidden="true" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                              )}
                            </button>
                          </p>
                        </div>
                      </div>
                      <div className="lg:col-span-5 min-w-0">
                        {(key.scopes ?? []).length > 0 ? (
                          <p
                            className="text-[11px] font-mono text-muted-foreground truncate"
                            title={scopesLabel}
                          >
                            {scopesLabel}
                          </p>
                        ) : (
                          <p className="text-[11px] font-mono text-muted-foreground">—</p>
                        )}
                        <p
                          className={cn(
                            "text-[11px] font-mono truncate mt-0.5 tabular-nums",
                            expired
                              ? "text-red-700 dark:text-red-400"
                              : expiringSoon
                                ? "text-amber-700 dark:text-amber-300"
                                : "text-muted-foreground"
                          )}
                          title={expiry.title}
                        >
                          {expiry.label}
                        </p>
                      </div>
                      <div className="lg:col-span-2 flex lg:justify-end min-w-0">
                        {canManage &&
                          (confirmRevokeId === key.key_id ? (
                            <span className="flex items-center gap-1.5 min-w-0">
                              <button
                                onClick={() =>
                                  void deleteKey.mutateAsync(key.key_id).finally(() => setConfirmRevokeId(null))
                                }
                                disabled={deleteKey.isPending}
                                className="h-8 px-3 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-semibold transition-colors shrink-0 flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 motion-reduce:transition-none"
                              >
                                {deleteKey.isPending && (
                                  <Loader2
                                    className="w-3.5 h-3.5 animate-spin motion-reduce:animate-none"
                                    aria-hidden="true"
                                  />
                                )}
                                Confirm
                              </button>
                              <button
                                onClick={() => setConfirmRevokeId(null)}
                                aria-label={`Cancel revoking ${key.name}`}
                                title={`Cancel revoking ${key.name}`}
                                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
                              >
                                <X className="w-3.5 h-3.5" aria-hidden="true" />
                              </button>
                            </span>
                          ) : (
                            <button
                              onClick={() => setConfirmRevokeId(key.key_id)}
                              aria-label={`Revoke ${key.name}`}
                              title={`Revoke ${key.name}`}
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
            </>
          )}
          {!canManage && (
            <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground min-w-0">
              <Lock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">Read-only — key management needs an admin role.</span>
            </p>
          )}
        </>
      )}
    </section>
  );
}

export function OrgKeys() {
  return (
    <div className="space-y-6 min-w-0">
      <KeysStats />

      <CreateKeySection />

      <KeysListSection />

      <p
        className="text-xs font-mono text-muted-foreground tabular-nums truncate"
        title="Bearer secrets show once · Revokes take effect immediately"
      >
        Bearer secrets show once · Revokes take effect immediately.
      </p>
    </div>
  );
}
