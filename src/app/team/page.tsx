"use client";

import { OrgTeam } from "@/components/settings/org-team";
import { PageHeader } from "@/components/common/page-header";
import { useSession, useUsers } from "@/services/auth";

export default function TeamPage() {
  // Header honesty: badge counts real workspace users (useUsers); role chip
  // comes from useSession. Both show "—" while loading, never invented.
  const { data: session } = useSession();
  const { data: users, isLoading: usersLoading } = useUsers(!!session);
  const count = (users ?? []).length;
  const memberBadge = usersLoading ? "— members" : `${count} member${count === 1 ? "" : "s"}`;
  const roleLabel = session?.user.role ?? "—";

  return (
    <div className="flex flex-col flex-1 min-h-[100dvh] max-w-7xl mx-auto w-full pt-6 md:pt-8 pb-16 px-4 md:px-8">
      <PageHeader
        title={
          <>
            <span>Team</span>
            <span
              className="font-mono text-xs font-normal tracking-normal px-2.5 py-1 rounded-full border border-border bg-muted/50 text-muted-foreground shrink-0 tabular-nums"
              title={usersLoading ? "Loading members" : `${count} workspace users`}
            >
              {memberBadge}
            </span>
          </>
        }
        description="Workspace members, roles, invites and sub-accounts."
        actions={
          <span
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-muted/50 text-muted-foreground font-mono text-xs uppercase tracking-widest shrink-0 max-w-full"
            title={session?.user.email ?? "Signed-in role"}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" aria-hidden="true" />
            <span className="truncate">{roleLabel}</span>
          </span>
        }
      />
      <OrgTeam />
    </div>
  );
}
