import { RouteLoader } from "@/components/common/route-loader";

export default function Loading() {
  return (
    <div role="status" aria-live="polite" aria-label="Loading page content" className="p-4 md:p-6">
      <RouteLoader label="Loading..." />
    </div>
  );
}
