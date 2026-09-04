"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Shield, Key, Bell, CreditCard, Building2, User, Blocks, Phone, Plug } from "lucide-react";
import { OrgBilling } from "@/components/settings/org-billing";
import { OrgTeam } from "@/components/settings/org-team";
import { OrgNumbers } from "@/components/settings/org-numbers";
import { OrgIntegrations } from "@/components/settings/org-integrations";
import { OrgGeneral } from "@/components/settings/org-general";
import { OrgSecurity } from "@/components/settings/org-security";
import { OrgNotifications } from "@/components/settings/org-notifications";
import { OrgKeys } from "@/components/settings/org-keys";
import { OrgWebhooks } from "@/components/settings/org-webhooks";
import { PageHeader } from "@/components/common/page-header";

const SETTINGS_TABS = [
  { id: "general", label: "General", icon: Building2 },
  { id: "keys", label: "API Keys", icon: Key },
  { id: "billing", label: "Billing", icon: CreditCard },
  { id: "team", label: "Team Members", icon: User },
  { id: "numbers", label: "Numbers", icon: Phone },
  { id: "integrations", label: "Integrations", icon: Plug },
  { id: "security", label: "Security", icon: Shield },
  { id: "webhooks", label: "Webhooks", icon: Blocks },
  { id: "notifications", label: "Notifications", icon: Bell },
];

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
  const [activeTab, setActiveTab] = useState(() => resolveSettingsTab(searchParams.get("tab")));

  return (
    <div className="flex flex-col flex-1 min-h-[100dvh] max-w-7xl mx-auto w-full pt-12 pb-32 px-4 md:px-8">
      {/* Header */}
      <PageHeader title="Organization" accent="Settings" />

      {/* Layout Split */}
      <div className="flex flex-col md:flex-row gap-12">
        
        {/* Sidebar Navigation */}
        <motion.nav 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="w-full md:w-64 flex flex-row md:flex-col gap-1 shrink-0 overflow-x-auto md:overflow-visible custom-scrollbar pb-1 md:pb-0"
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
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm transition-all duration-300 relative overflow-hidden shrink-0 whitespace-nowrap ${
                  isActive 
                    ? "text-foreground font-medium" 
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                {isActive && (
                  <motion.div 
                    layoutId="activeTabIndicator"
                    className="absolute inset-0 bg-card border border-border rounded-2xl shadow-sm z-0"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
                <tab.icon className={`w-4 h-4 relative z-10 ${isActive ? "text-ember-600 dark:text-ember-400" : ""}`} strokeWidth={isActive ? 2 : 1.5} />
                <span className="relative z-10">{tab.label}</span>
              </button>
            );
          })}
        </motion.nav>

        {/* Content Area */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex-1 max-w-3xl"
          role="tabpanel"
          id={`tab-panel-${activeTab}`}
        >
          {activeTab === "general" && <OrgGeneral />}
          {activeTab === "keys" && <OrgKeys />}
          {activeTab === "billing" && <OrgBilling />}
          {activeTab === "team" && <OrgTeam />}
          {activeTab === "numbers" && <OrgNumbers />}
          {activeTab === "integrations" && <OrgIntegrations />}
          {activeTab === "security" && <OrgSecurity />}
          {activeTab === "webhooks" && <OrgWebhooks />}
          {activeTab === "notifications" && <OrgNotifications />}
        </motion.div>
      </div>
    </div>
  );
}
