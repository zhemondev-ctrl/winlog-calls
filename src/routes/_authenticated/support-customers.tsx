import { createFileRoute } from "@tanstack/react-router";
import { SupportCustomers } from "@/components/support/customers";
import { supportHead } from "@/lib/support/rules";
import { supportBootstrapQuery } from "@/lib/support/queries";
export const Route = createFileRoute("/_authenticated/support-customers")({
  head: () =>
    supportHead("Customer 360", "Private customer profiles, preferences and linked call history."),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(supportBootstrapQuery);
  },
  component: Page,
});
function Page() {
  return <SupportCustomers />;
}
