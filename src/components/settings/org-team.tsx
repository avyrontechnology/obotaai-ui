"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Building2, Check, Copy, Crown, Loader2, Lock, MailWarning, Plus, Trash2, UserRound, Users, X } from "lucide-react";
import { timeAgo } from "@/lib/format";
import {
  useAddMember,
  useCreateSubAccount,
  useDeleteSubAccount,
  useRemoveMember,
  useSubAccounts,
} from "@/services/platform/subaccounts";
import {
  useDeleteUser,
  useInviteUser,
  useInvites,
  useSession,
  useSetUserRole,
  useUsers,
} from "@/services/auth";
import { minRoleFor, useCan } from "@/lib/rbac";
import type { SubAccount } from "@/lib/schemas/platform";
import type { Role } from "@/lib/schemas/auth";
import { fieldStyles } from "@/lib/field-styles";
import { cn } from "@/lib/utils";
import { SearchInput } from "@/components/common/search-input";
import { SectionHeader } from "@/components/common/section-header";
import { SettingsStatCard, SettingsStatsGrid } from "@/components/settings/settings-stats";


const ROLES = ["owner", "admin", "member", "viewer"] as const;

function TeamStats() {
  const { data: session } = useSession();
  const canManage = useCan("team.manage");
  const { data: users, isLoading: usersLoading } = useUsers(canManage || !!session);
  const { data: invites, isLoading: invitesLoading } = useInvites(canManage);
  const { data: subs, isLoading: subsLoading } = useSubAccounts();
  const loading = usersLoading || invitesLoading || subsLoading;
  const counts = useMemo(() => {
    const list = users ?? [];
    const pending = (invites ?? []).filter((invite) => !invite.accepted).length;
    const admins = list.filter((u) => u.role === "owner" || u.role === "admin").length;
    return { members: list.length, pending, admins, subs: (subs ?? []).length };
  }, [users, invites, subs]);
  return (
    <SettingsStatsGrid label="Team summary">
      <SettingsStatCard
        title="Members"
        icon={Users}
        value={loading ? "—" : String(counts.members)}
        caption={loading ? "Loading" : "Workspace sign-ins"}
        loading={loading}
        delay={0}
      />
      <SettingsStatCard
        title="Pending invites"
        icon={MailWarning}
        value={invitesLoading || !canManage ? "—" : String(counts.pending)}
        caption={!canManage ? "Admins only" : invitesLoading ? "Loading" : "Unaccepted invites"}
        loading={invitesLoading && canManage}
        delay={0.05}
      />
      <SettingsStatCard
        title="Admins"
        icon={Crown}
        value={loading ? "—" : String(counts.admins)}
        caption={loading ? "Loading" : "Owner + admin roles"}
        loading={usersLoading}
        delay={0.1}
      />
      <SettingsStatCard
        title="Sub-accounts"
        icon={Building2}
        value={subsLoading ? "—" : String(counts.subs)}
        caption={subsLoading ? "Loading" : "Isolated teams"}
        loading={subsLoading}
        delay={0.15}
      />
    </SettingsStatsGrid>
  );
}

function MemberAvatar({ label }: { label: string }) {
  return (
    <div
      className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-sm font-semibold text-ember-700 dark:text-ember-300 shrink-0"
      aria-hidden="true"
    >
      {(label || "?").slice(0, 1).toUpperCase()}
    </div>
  );
}

function MembersSection() {
  const canManage = useCan("team.manage");
  const { data: session } = useSession();
  const { data: users, isLoading } = useUsers(canManage || !!session);
  const setUserRole = useSetUserRole();
  const deleteUser = useDeleteUser();
  const isOwner = session?.user.role === "owner";

  const [query, setQuery] = useState("");
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = users ?? [];
    if (!needle) return list;
    return list.filter((user) =>
      [user.name ?? "", user.email, user.role].join(" ").toLowerCase().includes(needle)
    );
  }, [users, query]);

  const showFilter = (users ?? []).length > 1;

  return (
    <section className="rounded-3xl border border-border bg-card p-5 md:p-6 min-w-0">
      <SectionHeader
        title="Members"
        description={
          <>
            Sign-in accounts with enforced roles. Owners manage roles; admins invite members and viewers.
            {!canManage && ` Read-only — requires ${minRoleFor("team.manage")} role.`}
          </>
        }
        className="mb-6"
      />

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 rounded-3xl bg-muted/50 border border-border animate-pulse motion-reduce:animate-none" />
          ))}
        </div>
      ) : (users ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground rounded-3xl border border-dashed border-border p-10 text-center">
          No workspace users yet.
        </p>
      ) : (
        <>
          {showFilter && (
            <div className="mb-4">
              <SearchInput
                value={query}
                onChange={setQuery}
                placeholder="Filter by name, email or role…"
                label="Filter members"
                className="!w-full max-w-none sm:max-w-xs"
              />
            </div>
          )}
          {visible.length === 0 ? (
            <p className="text-sm text-muted-foreground rounded-3xl border border-dashed border-border p-10 text-center">
              No members match this filter.
            </p>
          ) : (
            <>
              <div className="hidden sm:grid sm:grid-cols-12 gap-3 px-5 py-2 text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
                <div className="sm:col-span-5 truncate">User</div>
                <div className="sm:col-span-3 truncate">Role</div>
                <div className="sm:col-span-2 truncate">Joined</div>
                <div className="sm:col-span-2 text-right truncate">Actions</div>
              </div>
              <div className="flex flex-col gap-3">
                {visible.map((user) => {
                  const isSelf = session?.user.user_id === user.user_id;
                  const canEditRole = canManage && !isSelf;
                  const canRemove = canManage && !isSelf && isOwner;
                  return (
                    <div
                      key={user.user_id}
                      className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center p-4 md:px-5 bg-muted/40 border border-border rounded-3xl min-w-0"
                    >
                      <div className="sm:col-span-5 flex items-center gap-3 min-w-0">
                        <MemberAvatar label={user.name || user.email} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate" title={user.name || user.email}>
                            {user.name || user.email}
                            {isSelf && (
                              <span className="ml-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">you</span>
                            )}
                          </p>
                          <p className="text-xs font-mono text-muted-foreground truncate" title={user.email}>{user.email}</p>
                        </div>
                      </div>
                      <div className="sm:col-span-3 min-w-0">
                        {canEditRole ? (
                          <select
                            value={user.role}
                            onChange={(event) => void setUserRole.mutateAsync({ id: user.user_id, role: event.target.value as Role })}
                            aria-label={`Role for ${user.email}`}
                            disabled={!isOwner}
                            title={!isOwner ? "Only owners change roles" : undefined}
                            className="h-9 px-2 w-full max-w-[180px] rounded-xl bg-card border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ember-400/50 disabled:opacity-60 truncate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50"
                          >
                            {ROLES.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground shrink-0 truncate block" title={user.role}>
                            {user.role}
                          </span>
                        )}
                      </div>
                      <div className="sm:col-span-2 min-w-0">
                        <span
                          className="text-xs text-muted-foreground tabular-nums truncate block"
                          title={user.created_at}
                        >
                          Joined {timeAgo(user.created_at)}
                        </span>
                      </div>
                      <div className="sm:col-span-2 flex sm:justify-end min-w-0">
                        {canRemove &&
                          (confirmRemoveId === user.user_id ? (
                            <span className="flex items-center gap-1.5 min-w-0">
                              <button
                                onClick={() =>
                                  void deleteUser
                                    .mutateAsync(user.user_id)
                                    .finally(() => setConfirmRemoveId(null))
                                }
                                className="h-8 px-3 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 motion-reduce:transition-none"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setConfirmRemoveId(null)}
                                aria-label={`Cancel removing ${user.email}`}
                                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
                              >
                                <X className="w-3.5 h-3.5" aria-hidden="true" />
                              </button>
                            </span>
                          ) : (
                            <button
                              onClick={() => setConfirmRemoveId(user.user_id)}
                              aria-label={`Remove ${user.email}`}
                              title={`Remove ${user.email}`}
                              className="p-2 rounded-xl text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 motion-reduce:transition-none"
                            >
                              <X className="w-4 h-4" aria-hidden="true" />
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
              <span className="truncate">Read-only — member management needs an admin role.</span>
            </p>
          )}
        </>
      )}
    </section>
  );
}

function InviteSection() {
  const canManage = useCan("team.manage");
  const { data: session } = useSession();
  const inviteUser = useInviteUser();

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [inviteToken, setInviteToken] = useState<{ email: string; token: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canManage) return null;

  const handleInvite = async () => {
    setError(null);
    if (!email.trim()) {
      setError("Enter an email address.");
      return;
    }
    try {
      const created = await inviteUser.mutateAsync({ email: email.trim(), role });
      setInviteToken({ email: created.email, token: created.token });
      setEmail("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invite failed.");
    }
  };

  const copyToken = async () => {
    if (!inviteToken) return;
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/accept-invite?token=${inviteToken.token}`
      );
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="rounded-3xl border border-border bg-card p-5 md:p-6 min-w-0">
      <SectionHeader
        title="Invite teammate"
        description="Invite by email. The accept link shows once — share it with the teammate."
        className="mb-6"
      />

      <div className="flex flex-col sm:flex-row gap-2 min-w-0">
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void handleInvite();
            }
          }}
          placeholder="teammate@company.com"
          aria-label="Invite email"
          className={cn(fieldStyles.fieldSm, "font-mono text-xs flex-1 min-w-0")}
        />
        <select
          value={role}
          onChange={(event) => setRole(event.target.value as Role)}
          aria-label="Invite role"
          className={cn(fieldStyles.fieldSm, "sm:w-36 shrink-0")}
        >
          {(session?.user.role === "owner" ? ROLES : (["member", "viewer"] as const)).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <button
          onClick={() => void handleInvite()}
          disabled={inviteUser.isPending}
          className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
        >
          {inviteUser.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Plus className="w-3.5 h-3.5" aria-hidden="true" />}
          Invite
        </button>
      </div>
      {error && (
        <p className="mt-3 flex items-center gap-2 text-xs text-destructive min-w-0">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /> <span className="truncate" title={error}>{error}</span>
        </p>
      )}

      {inviteToken && (
        <div className="mt-4 p-5 rounded-3xl border border-emerald-500/20 bg-emerald-500/5 space-y-3 min-w-0">
          <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300 flex items-center gap-2 min-w-0">
            <UserRound className="w-4 h-4 shrink-0" aria-hidden="true" /> <span className="truncate" title={`Invite for ${inviteToken.email} — share this link once.`}>Invite for {inviteToken.email} — share this link once.</span>
          </p>
          <div className="flex gap-2 min-w-0">
            <code className="flex-1 min-w-0 truncate h-11 px-4 flex items-center bg-card border border-border rounded-2xl font-mono text-xs text-foreground" title={`/accept-invite?token=${inviteToken.token}`}>
              /accept-invite?token={inviteToken.token.slice(0, 12)}…
            </code>
            <button
              onClick={() => void copyToken()}
              aria-label="Copy invite link"
              className="h-11 w-11 shrink-0 flex items-center justify-center rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 motion-reduce:transition-none"
            >
              {copied ? <Check className="w-4 h-4" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
            </button>
            <button
              onClick={() => {
                setInviteToken(null);
                setCopied(false);
              }}
              className="h-11 px-4 rounded-2xl border border-border text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function PendingInvitesSection() {
  const canManage = useCan("team.manage");
  const { data: invites, isLoading } = useInvites(canManage);

  if (!canManage) return null;

  const pending = (invites ?? []).filter((invite) => !invite.accepted);

  return (
    <section className="rounded-3xl border border-border bg-card p-5 md:p-6 min-w-0">
      <SectionHeader
        title="Pending invites"
        description="Unaccepted invites. Accept links are shown once, when the invite is created."
        className="mb-6"
      />

      {isLoading ? (
        <div className="h-16 rounded-3xl bg-muted/50 border border-border animate-pulse motion-reduce:animate-none" />
      ) : pending.length === 0 ? (
        <p className="text-sm text-muted-foreground rounded-3xl border border-dashed border-border p-10 text-center">
          No pending invites.
        </p>
      ) : (
        <>
          <div className="hidden sm:grid sm:grid-cols-12 gap-3 px-5 py-2 text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
            <div className="sm:col-span-6 truncate">Invite</div>
            <div className="sm:col-span-3 truncate">Role</div>
            <div className="sm:col-span-3 truncate">Invited</div>
          </div>
          <div className="flex flex-col gap-3">
            {pending.map((invite) => (
              <div
                key={invite.invite_id}
                className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-3 items-center p-4 md:px-5 bg-muted/40 border border-border rounded-3xl min-w-0"
              >
                <div className="sm:col-span-6 flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0" aria-hidden="true">
                    <MailWarning className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate" title={invite.email}>{invite.email}</p>
                    {invite.name && (
                      <p className="text-xs text-muted-foreground truncate" title={invite.name}>{invite.name}</p>
                    )}
                  </div>
                </div>
                <div className="sm:col-span-3 min-w-0">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground truncate block" title={invite.role}>
                    {invite.role}
                  </span>
                </div>
                <div className="sm:col-span-3 min-w-0">
                  <span className="text-xs text-muted-foreground tabular-nums truncate block" title={invite.created_at}>
                    {timeAgo(invite.created_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function SubAccountMemberRow({ subId, email, name, role }: { subId: string; email: string; name?: string | null; role: string }) {
  const removeMember = useRemoveMember();
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="flex items-center gap-3 py-2.5 min-w-0">
      <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-semibold text-ember-700 dark:text-ember-300 shrink-0" aria-hidden="true">
        {(name || email).slice(0, 1).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground truncate" title={name || email}>{name || email}</p>
        <p className="text-xs font-mono text-muted-foreground truncate" title={email}>{email}</p>
      </div>
      <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground shrink-0 truncate" title={role}>{role}</span>
      {confirming ? (
        <span className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => void removeMember.mutateAsync({ id: subId, email }).finally(() => setConfirming(false))}
            className="h-8 px-3 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 motion-reduce:transition-none"
          >
            Confirm
          </button>
          <button
            onClick={() => setConfirming(false)}
            aria-label={`Cancel removing ${email}`}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </span>
      ) : (
        <button
          onClick={() => setConfirming(true)}
          aria-label={`Remove ${email}`}
          title={`Remove ${email}`}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 motion-reduce:transition-none"
        >
          <X className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

function SubAccountCard({ sub }: { sub: SubAccount }) {
  const addMember = useAddMember();
  const deleteSub = useDeleteSubAccount();
  const [showMemberForm, setShowMemberForm] = useState(false);
  const [email, setEmail] = useState("");
  const [memberName, setMemberName] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]>("member");
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const handleAdd = async () => {
    setError(null);
    try {
      await addMember.mutateAsync({ id: sub.sub_id, email: email.trim(), name: memberName.trim() || undefined, role });
      setEmail("");
      setMemberName("");
      setShowMemberForm(false);
    } catch {
      setError("Enter a valid email address.");
    }
  };

  return (
    <div className="p-5 bg-muted/40 border border-border rounded-3xl min-w-0">
      <div className="flex items-start justify-between gap-4 mb-2 min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0" aria-hidden="true">
            <Building2 className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h4 className="font-medium text-foreground tracking-tight truncate" title={sub.name}>{sub.name}</h4>
            <p className="text-xs text-muted-foreground truncate tabular-nums" title={`${sub.members.length} members${sub.concurrency_cap != null ? ` · cap ${sub.concurrency_cap}` : ""} · created ${timeAgo(sub.created_at)}`}>
              {sub.members.length} member{sub.members.length === 1 ? "" : "s"}
              {sub.concurrency_cap != null && ` · cap ${sub.concurrency_cap}`}
              {` · ${timeAgo(sub.created_at)}`}
            </p>
          </div>
        </div>
        {confirmingDelete ? (
          <span className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => void deleteSub.mutateAsync(sub.sub_id).finally(() => setConfirmingDelete(false))}
              className="h-8 px-3 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 motion-reduce:transition-none"
            >
              Confirm
            </button>
            <button
              onClick={() => setConfirmingDelete(false)}
              aria-label={`Cancel deleting ${sub.name}`}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </span>
        ) : (
          <button
            onClick={() => setConfirmingDelete(true)}
            aria-label={`Delete ${sub.name}`}
            title={`Delete ${sub.name}`}
            className="p-2 rounded-xl text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 motion-reduce:transition-none"
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {sub.members.length === 0 ? (
        <p className="text-sm text-muted-foreground rounded-3xl border border-dashed border-border p-6 text-center">
          No members in this sub-account yet.
        </p>
      ) : (
        <div className="divide-y divide-border/60 min-w-0">
          {sub.members.map((member) => (
            <SubAccountMemberRow key={member.email} subId={sub.sub_id} {...member} />
          ))}
        </div>
      )}

      {!showMemberForm ? (
        <button
          onClick={() => setShowMemberForm(true)}
          className="mt-3 w-full h-10 rounded-xl border border-dashed border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors flex items-center justify-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
        >
          <Plus className="w-3.5 h-3.5" aria-hidden="true" /> Invite member
        </button>
      ) : (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-3 space-y-2 motion-reduce:transition-none">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 min-w-0">
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email"
              aria-label="Member email"
              className={cn(fieldStyles.fieldSm, "font-mono text-xs min-w-0")}
            />
            <input
              value={memberName}
              onChange={(event) => setMemberName(event.target.value)}
              placeholder="Name (optional)"
              aria-label="Member name"
              className={cn(fieldStyles.fieldSm, "min-w-0")}
            />
          </div>
          <div className="flex flex-wrap gap-2 min-w-0">
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as (typeof ROLES)[number])}
              aria-label="Member role"
              className={cn(fieldStyles.fieldSm, "flex-1 min-w-[120px]")}
            >
              {ROLES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <button
              onClick={() => void handleAdd()}
              disabled={addMember.isPending}
              className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
            >
              {addMember.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
              Add
            </button>
            <button
              onClick={() => {
                setShowMemberForm(false);
                setError(null);
              }}
              className="h-10 px-3 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
            >
              Cancel
            </button>
          </div>
          {error && (
            <p className="flex items-center gap-2 text-xs text-destructive min-w-0">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /> <span className="truncate" title={error}>{error}</span>
            </p>
          )}
        </motion.div>
      )}
    </div>
  );
}

function SubAccountsSection() {
  const { data: subs, isLoading } = useSubAccounts();
  const createSub = useCreateSubAccount();

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [cap, setCap] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setError(null);
    if (!name.trim()) {
      setError("Give the sub-account a name.");
      return;
    }
    try {
      await createSub.mutateAsync({
        name: name.trim(),
        concurrency_cap: cap.trim() ? Number(cap) : undefined,
      });
      setName("");
      setCap("");
      setShowForm(false);
    } catch {
      setError("Could not create the sub-account. Is the backend running?");
    }
  };

  return (
    <section className="rounded-3xl border border-border bg-card p-5 md:p-6 min-w-0">
      <SectionHeader
        title="Sub-Accounts"
        description="Isolate customers and teams. Sub-account membership is organizational; sign-in roles live above."
        action={
          !showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors flex items-center gap-2 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
            >
              <Plus className="w-4 h-4" aria-hidden="true" /> New
            </button>
          ) : undefined
        }
        className="mb-6"
      />

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-3xl border border-border bg-muted/40 p-5 space-y-3 mb-4 min-w-0 motion-reduce:transition-none"
          >
            <p className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">New sub-account</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 min-w-0">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Sub-account name, e.g. Acme EU"
                aria-label="Sub-account name"
                className={cn(fieldStyles.fieldSm, "min-w-0")}
              />
              <input
                value={cap}
                onChange={(event) => setCap(event.target.value)}
                placeholder="Concurrency cap (optional)"
                inputMode="numeric"
                aria-label="Concurrency cap"
                className={cn(fieldStyles.fieldSm, "min-w-0 tabular-nums")}
              />
            </div>
            {error && (
              <p className="flex items-center gap-2 text-xs text-destructive min-w-0">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /> <span className="truncate" title={error}>{error}</span>
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => void handleCreate()}
                disabled={createSub.isPending}
                className="flex-1 min-w-[160px] h-10 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
              >
                {createSub.isPending && <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                Create sub-account
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

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-32 rounded-3xl bg-muted/50 border border-border animate-pulse motion-reduce:animate-none" />
          ))}
        </div>
      ) : (subs ?? []).length === 0 && !showForm ? (
        <p className="text-sm text-muted-foreground rounded-3xl border border-dashed border-border p-10 text-center">
          No sub-accounts yet. Create one to isolate a customer or team.
        </p>
      ) : (
        <div className="space-y-3 min-w-0">
          {(subs ?? []).map((sub) => (
            <SubAccountCard key={sub.sub_id} sub={sub} />
          ))}
        </div>
      )}
    </section>
  );
}

export function OrgTeam() {
  return (
    <div className="space-y-6 min-w-0">
      <TeamStats />

      <MembersSection />

      <InviteSection />

      <PendingInvitesSection />

      <SubAccountsSection />

      <p className="text-xs font-mono text-muted-foreground tabular-nums truncate" title="Roles enforced server-side">
        Roles enforced server-side · Sub-account members inherit org scope.
      </p>
    </div>
  );
}
