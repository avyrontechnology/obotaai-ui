"use client";

import { useMemo } from "react";
import { KeyRound, Link2, Phone, PlugZap } from "lucide-react";
import { useIntegrations } from "@/services/platform/integrations";
import { usePartnerCredentials, usePartnerIntegrations } from "@/services/platform/mcp";
import { useTalkoPartners } from "@/services/platform/talko-partners";
import { SettingsStatCard, SettingsStatsGrid } from "@/components/settings/settings-stats";

/**
 * Single hub summary — replaces the previous 3 separate stats grids
 * (IntegrationsStats + McpStats + no Talko stats = 12 cards stacked).
 * All values come from real hooks; "—" while loading.
 */
export function IntegrationsHubStats() {
  const integrationsQuery = useIntegrations();
  const credentialsQuery = usePartnerCredentials();
  const linksQuery = usePartnerIntegrations();
  const partnersQuery = useTalkoPartners();

  const isLoading =
    integrationsQuery.isLoading ||
    credentialsQuery.isLoading ||
    linksQuery.isLoading ||
    partnersQuery.isLoading;

  const counts = useMemo(() => {
    const integrations = integrationsQuery.data ?? [];
    const enabled = integrations.filter((i) => i.enabled).length;
    return {
      connected: integrations.length,
      enabled,
      credentials: (credentialsQuery.data ?? []).length,
      links: (linksQuery.data ?? []).length,
      partners: (partnersQuery.data ?? []).length,
    };
  }, [integrationsQuery.data, credentialsQuery.data, linksQuery.data, partnersQuery.data]);

  return (
    <SettingsStatsGrid label="Integrations hub summary">
      <SettingsStatCard
        title="Connected"
        icon={PlugZap}
        value={isLoading ? "—" : String(counts.connected)}
        caption={isLoading ? "Loading" : `${counts.enabled} enabled · ${counts.connected - counts.enabled} off`}
        loading={isLoading}
        delay={0}
      />
      <SettingsStatCard
        title="Credentials"
        icon={KeyRound}
        value={isLoading ? "—" : String(counts.credentials)}
        caption={isLoading ? "Loading" : "Vault-sealed provider secrets"}
        loading={isLoading}
        delay={0.05}
      />
      <SettingsStatCard
        title="Agent links"
        icon={Link2}
        value={isLoading ? "—" : String(counts.links)}
        caption={isLoading ? "Loading" : "Provider → agent bindings"}
        loading={isLoading}
        delay={0.1}
      />
      <SettingsStatCard
        title="Talko partners"
        icon={Phone}
        value={isLoading ? "—" : String(counts.partners)}
        caption={isLoading ? "Loading" : "DID owners for real calls"}
        loading={isLoading}
        delay={0.15}
      />
    </SettingsStatsGrid>
  );
}
