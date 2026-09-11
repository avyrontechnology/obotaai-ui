"use client";

import { useState } from "react";
import { OrgKeys } from "@/components/settings/org-keys";
import { PageHeader } from "@/components/common/page-header";
import { useSession } from "@/services/auth";
import { useApiKeys } from "@/services/platform/api-keys";

function isExpired(expiresAt: string | null | undefined, nowMs: number): boolean {
  if (!expiresAt) return false;
  const parsed = new Date(expiresAt).getTime();
  if (!Number.isFinite(parsed)) return false;
  return parsed < nowMs;
}

export default function ApiKeysPage() {
  // Header honesty: badge + status chips come from real hooks only.
  // Badge = useApiKeys count; status = expired computed from real
  // expires_at; role = useSession. All show "—" while loading.
  const { data: keys, isLoading } = useApiKeys();
  const { data: session } = useSession();
  const [nowMs] = useState(() => Date.now());

  const list = keys ?? [];
  const count = list.length;
  const expired = list.filter((key) => isExpired(key.expires_at, nowMs)).length;

  const badge = isLoading ? "— keys" : `${count} key${count === 1 ? "" : "s"}`;
  const badgeTitle = isLoading ? "Loading API keys" : `${count} API keys in vault`;

  const statusLabel = isLoading ? "—" : expired > 0 ? `${expired} expired` : "all active";
  const statusTitle = isLoading
    ? "Loading key status"
    : expired > 0
      ? `${expired} of ${count} keys past expires_at`
      : "No keys past expires_at";
  const statusDot = isLoading ? "bg-muted-foreground" : expired > 0 ? "bg-red-500" : "bg-emerald-500";

  const roleLabel = session?.user.role ?? "—";
  const roleTitle = session?.user.email ?? "Signed-in role";

  return (
    <div className="flex flex-col flex-1 min-h-[100dvh] max-w-7xl mx-auto w-full pt-6 md:pt-8 pb-16 px-4 md:px-8">
      <PageHeader
        title={
          <>
            <span className="truncate">API Keys</span>
            <span
              className="font-mono text-xs font-normal tracking-normal px-2.5 py-1 rounded-full border border-border bg-muted/50 text-muted-foreground shrink-0 tabular-nums truncate max-w-full"
              title={badgeTitle}
            >
              {badge}
            </span>
          </>
        }
        description="Scoped Bearer keys for programmatic access. Secrets show once at creation."
        actions={
          <>
            <span
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-muted/50 text-muted-foreground font-mono text-xs uppercase tracking-widest shrink-0 max-w-full"
              title={statusTitle}
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDot}`} aria-hidden="true" />
              <span className="truncate tabular-nums">{statusLabel}</span>
            </span>
            <span
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-muted/50 text-muted-foreground font-mono text-xs uppercase tracking-widest shrink-0 max-w-full"
              title={roleTitle}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" aria-hidden="true" />
              <span className="truncate">{roleLabel}</span>
            </span>
          </>
        }
      />
      <OrgKeys />
    </div>
  );
}
