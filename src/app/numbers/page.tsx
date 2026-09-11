import { OrgNumbers } from "@/components/settings/org-numbers";
import { PageHeader } from "@/components/common/page-header";

export default function NumbersPage() {
  return (
    <div className="flex flex-col flex-1 min-h-[100dvh] max-w-7xl mx-auto w-full pt-6 md:pt-8 pb-16 px-4 md:px-8">
      <PageHeader
        title="Phone"
        accent="Numbers"
        description="Providers, inventory and routing — connect a provider, add numbers, assign them to agents."
      />
      <OrgNumbers />
    </div>
  );
}
