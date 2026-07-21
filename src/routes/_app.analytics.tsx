import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, EmptyState } from "@/components/app-shell/ui-bits";

export const Route = createFileRoute("/_app/analytics")({ component: Analytics });

function Analytics() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader title="Analytics" subtitle="Performance across every channel." />
      <EmptyState title="Charts unlock with activity" body="Send your first campaign to start generating analytics — response rates by channel, best send times, lead score distribution, and more." />
    </div>
  );
}
