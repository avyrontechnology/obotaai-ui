"use client";

import { Suspense, useState } from "react";
import { redirect, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Shield, Bell, Building2, Blocks } from "lucide-react";
import { OrgGeneral } from "@/components/settings/org-general";
import { OrgSecurity } from "@/components/settings/org-security";
import { OrgNotifications } from "@/components/settings/org-notifications";
import { OrgWebhooks } from "@/components/settings/org-webhooks";
import { PageHeader } from "@/components/common/page-header";
import { useSession, useUsers } from "@/services/auth";
import { cn } from "@/lib/utils";

const SETTINGS_TABS = [
  { id: "general", label: "General", icon: Building2 },
  { id: "security", label: "Security", icon: Shield },
  { id: "webhooks", label: "Webhooks", icon: Blocks },
  { id: "notifications", label: "Notifications", icon: Bell },
];

// Numbers, Team, Billing, API Keys and Integrations live as standalone
// sidebar routes now — old ?tab= deep links land here and bounce forward.
const MOVED_TABS: Record<string, string> = {
  numbers: "/numbers",
  team: "/team",
  billing: "/billing",
  keys: "/api-keys",
  integrations: "/integrations",
};

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsContent />
    </Suspense>
  );
}

export function resolveSettingsTab(param: string | null): string {
  return SETTINGS_TABS.some((tab) => tab.id === param) ? (param as string) : "general";
}

function SettingsContent() {
  const searchParams = useSearchParams();
  const moved = MOVED_TABS[searchParams.get("tab") ?? ""];
  if (moved) redirect(moved);
  const [activeTab, setActiveTab] = useState(() => resolveSettingsTab(searchParams.get("tab")));

  // Header honesty: no plan/tier field exists on the org record, so the mono
  // badge falls back to the workspace member count (useUsers, real). Role
  // chip comes from useSession (real).
  const { data: session } = useSession();
  const { data: users, isLoading: usersLoading } = useUsers(!!session);
  const memberBadge = usersLoading ? "— members" : `${(users ?? []).length} member${(users ?? []).length === 1 ? "" : "s"}`;
  const roleLabel = session?.user.role ?? "—";

  return (
    <div className="flex flex-col flex-1 min-h-[100dvh] max-w-7xl mx-auto w-full pt-6 md:pt-8 pb-16 px-4 md:px-8">
      <PageHeader
        title={
          <>
            <span>Organization Settings</span>
            <span
              className="font-mono text-xs font-normal tracking-normal px-2.5 py-1 rounded-full border border-border bg-muted/50 text-muted-foreground shrink-0 tabular-nums"
              title={usersLoading ? "Loading members" : `${(users ?? []).length} workspace users`}
            >
              {memberBadge}
            </span>
          </>
        }
        description="Workspace identity, people, numbers, money and access."
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

      {/* Layout Split */}
      <div className="flex flex-col lg:flex-row gap-6 lg:gap-10">

        {/* Sidebar Navigation */}
        <motion.nav
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="w-full lg:w-60 shrink-0 flex flex-row lg:flex-col gap-1 overflow-x-auto lg:overflow-visible custom-scrollbar pb-1 lg:pb-0 motion-reduce:transition-none"
          role="tablist"
          aria-label="Settings sections"
        >
          {SETTINGS_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                role="tab"
                aria-selected={isActive}
                aria-controls={`tab-panel-${tab.id}`}
                className={cn(
                  "relative flex items-center gap-3 px-4 py-2.5 rounded-xl text-left transition-colors duration-200 shrink-0 whitespace-nowrap lg:whitespace-normal lg:w-full min-w-0",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50",
                  isActive ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTabIndicator"
                    className="absolute inset-0 bg-muted rounded-xl border border-border"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
                <tab.icon
                  className={cn(
                    "w-4 h-4 relative z-10 shrink-0",
                    isActive ? "text-ember-700 dark:text-ember-300" : "text-muted-foreground"
                  )}
                  strokeWidth={isActive ? 2 : 1.5}
                  aria-hidden="true"
                />
                <span className="relative z-10 truncate">{tab.label}</span>
              </button>
            );
          })}
        </motion.nav>

        {/* Content Area */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex-1 min-w-0 max-w-3xl motion-reduce:transition-none"
          role="tabpanel"
          id={`tab-panel-${activeTab}`}
        >
          {activeTab === "general" && <OrgGeneral />}
          {activeTab === "security" && <OrgSecurity />}
          {activeTab === "webhooks" && <OrgWebhooks />}
          {activeTab === "notifications" && <OrgNotifications />}

          <p className="mt-8 text-center text-xs font-mono text-muted-foreground">
            OtobaAI Workspace · Identity, access and billing stay in sync with the platform.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
