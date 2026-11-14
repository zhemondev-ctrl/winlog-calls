import { createFileRoute } from "@tanstack/react-router";
import { SupportAnalytics } from "@/components/support/analytics";
import { supportHead } from "@/lib/support/rules";
import { supportBootstrapQuery } from "@/lib/support/queries";
export const Route = createFileRoute("/_authenticated/support-analytics")({
  head: () => supportHead("Support analytics", "Actual case metrics, SLA breaches and workload."),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(supportBootstrapQuery);
  },
  component: Page,
});
function Page() {
  return <SupportAnalytics />;
}
