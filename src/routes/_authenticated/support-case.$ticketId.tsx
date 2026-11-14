import { createFileRoute } from "@tanstack/react-router";
import { SupportCase } from "@/components/support/case";
import { supportHead } from "@/lib/support/rules";
import { supportBootstrapQuery } from "@/lib/support/queries";
export const Route = createFileRoute("/_authenticated/support-case/$ticketId")({
  head: () =>
    supportHead("Case workspace", "Case conversation, call evidence and human-approved AI drafts."),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(supportBootstrapQuery);
  },
  component: Page,
});
function Page() {
  const { ticketId } = Route.useParams();
  return <SupportCase id={ticketId} />;
}
