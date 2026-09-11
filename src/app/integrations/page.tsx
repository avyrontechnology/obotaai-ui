import { OrgIntegrations } from "@/components/settings/org-integrations";
import { PageHeader } from "@/components/common/page-header";

export default function IntegrationsPage() {
  return (
    <div className="flex flex-col flex-1 min-h-[100dvh] max-w-7xl mx-auto w-full pt-6 md:pt-8 pb-16 px-4 md:px-8">
      <PageHeader
        title="Integrations"
        description="Telephony, calendars and workflow tools."
      />
      <OrgIntegrations />
    </div>
  );
}
