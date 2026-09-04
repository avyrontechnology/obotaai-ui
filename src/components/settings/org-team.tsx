"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Building2, Loader2, Plus, Trash2, X } from "lucide-react";
import { timeAgo } from "@/lib/format";
import {
  useAddMember,
  useCreateSubAccount,
  useDeleteSubAccount,
  useRemoveMember,
  useSubAccounts,
} from "@/services/platform/subaccounts";
import type { SubAccount } from "@/lib/schemas/platform";
import { fieldStyles } from "@/lib/field-styles";
import { cn } from "@/lib/utils";


const ROLES = ["owner", "admin", "member", "viewer"] as const;

function MemberRow({ subId, email, name, role }: { subId: string; email: string; name?: string | null; role: string }) {
  const removeMember = useRemoveMember();
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-semibold text-ember-700 dark:text-ember-300 shrink-0">
        {(name || email).slice(0, 1).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground truncate">{name || email}</p>
        <p className="text-xs font-mono text-muted-foreground truncate">{email}</p>
      </div>
      <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground shrink-0">{role}</span>
      <button
        onClick={() => void removeMember.mutateAsync({ id: subId, email })}
        aria-label={`Remove ${email}`}
        className="p-1.5 rounded-lg text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
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
    <div className="p-5 bg-card border border-border rounded-3xl">
      <div className="flex items-start justify-between gap-4 mb-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
            <Building2 className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <h4 className="font-medium text-foreground tracking-tight truncate">{sub.name}</h4>
            <p className="text-xs text-muted-foreground">
              {sub.members.length} member{sub.members.length === 1 ? "" : "s"}
              {sub.concurrency_cap != null && ` · cap ${sub.concurrency_cap}`}
              {` · ${timeAgo(sub.created_at)}`}
            </p>
          </div>
        </div>
        <button
          onClick={() => void deleteSub.mutateAsync(sub.sub_id)}
          aria-label={`Delete ${sub.name}`}
          className="p-2 rounded-xl text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="divide-y divide-border/60">
        {sub.members.map((member) => (
          <MemberRow key={member.email} subId={sub.sub_id} {...member} />
        ))}
      </div>

      {!showMemberForm ? (
        <button
          onClick={() => setShowMemberForm(true)}
          className="mt-3 w-full h-10 rounded-xl border border-dashed border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors flex items-center justify-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" /> Invite member
        </button>
      ) : (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email"
              aria-label="Member email"
              className={cn(fieldStyles.fieldSm, "font-mono text-xs")}
            />
            <input
              value={memberName}
              onChange={(event) => setMemberName(event.target.value)}
              placeholder="Name (optional)"
              aria-label="Member name"
              className={fieldStyles.fieldSm}
            />
          </div>
          <div className="flex gap-2">
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as (typeof ROLES)[number])}
              aria-label="Member role"
              className={cn(fieldStyles.fieldSm, "flex-1")}
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
              className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {addMember.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Add
            </button>
            <button
              onClick={() => {
                setShowMemberForm(false);
                setError(null);
              }}
              className="h-10 px-3 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
          {error && <p className="text-xs text-red-700 dark:text-red-400">{error}</p>}
        </motion.div>
      )}
    </div>
  );
}

export function OrgTeam() {
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
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-foreground">Team & Sub-Accounts</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Isolate customers and teams. Role enforcement arrives with platform auth.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors flex items-center gap-2 shrink-0"
          >
            <Plus className="w-4 h-4" /> New
          </button>
        )}
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-3xl border border-border bg-card p-5 space-y-3"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Sub-account name, e.g. Acme EU"
                aria-label="Sub-account name"
                className={fieldStyles.fieldSm}
              />
              <input
                value={cap}
                onChange={(event) => setCap(event.target.value)}
                placeholder="Concurrency cap (optional)"
                inputMode="numeric"
                aria-label="Concurrency cap"
                className={fieldStyles.fieldSm}
              />
            </div>
            {error && (
              <p className="flex items-center gap-2 text-xs text-red-700 dark:text-red-400">
                <AlertCircle className="w-3.5 h-3.5" /> {error}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => void handleCreate()}
                disabled={createSub.isPending}
                className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {createSub.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Create sub-account
              </button>
              <button
                onClick={() => {
                  setShowForm(false);
                  setError(null);
                }}
                className="h-10 px-4 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground transition-colors"
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
            <div key={i} className="h-32 rounded-3xl bg-card border border-border animate-pulse" />
          ))}
        </div>
      ) : (subs ?? []).length === 0 && !showForm ? (
        <p className="text-sm text-muted-foreground rounded-3xl border border-dashed border-border p-10 text-center">
          No sub-accounts yet. Create one to isolate a customer or team.
        </p>
      ) : (
        <div className="space-y-3">
          {(subs ?? []).map((sub) => (
            <SubAccountCard key={sub.sub_id} sub={sub} />
          ))}
        </div>
      )}
    </div>
  );
}
