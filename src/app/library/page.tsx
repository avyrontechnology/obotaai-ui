"use client";

import { KbManager } from "@/components/library/kb-manager";
import { PageHeader } from "@/components/common/page-header";

export default function LibraryPage() {
  return (
    <div className="flex flex-col flex-1 min-h-[100dvh] max-w-7xl mx-auto w-full pt-6 md:pt-8 pb-16 px-4 md:px-8">
      <PageHeader
        title="Knowledge"
        accent="Base"
        description="Shared knowledge bases — upload content once, attach it to any agent."
        className="mb-8"
      />

      <KbManager />
    </div>
  );
}
