import { AgentGrid } from "@/components/dashboard/agent-grid";
import { FleetStats } from "@/components/dashboard/fleet-stats";
import { GettingStarted } from "@/components/dashboard/getting-started";
import { RecentCalls } from "@/components/dashboard/recent-calls";
import { SectionHeader } from "@/components/common/section-header";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 min-h-full max-w-7xl mx-auto w-full pt-12 pb-24 gap-12">
      
      {/* Command Hero & System Status */}
      <section className="flex flex-col gap-6 mt-4">
        <div className="flex items-center gap-3">
          <div className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </div>
          <p className="text-sm font-mono font-medium text-emerald-600 dark:text-emerald-400 tracking-wider uppercase">
            Matrix Online • All systems nominal
          </p>
        </div>
        
        <SectionHeader 
          title={<span className="text-3xl md:text-4xl text-foreground">Command Center</span>}
          description="Global overview of your neural fleet and conversational metrics."
          className="!mb-2"
        />

        {/* Key Metrics Row */}
        <FleetStats />
      </section>

      <GettingStarted />

      <RecentCalls />

      {/* Agent Fleet */}
      <section className="flex flex-col">
        <AgentGrid />
      </section>

    </div>
  );
}
