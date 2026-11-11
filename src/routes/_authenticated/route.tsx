import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { NativeSyncProvider } from "@/components/winlog/native-sync-context";
import { meQuery } from "@/lib/queries";

// The session lives in browser storage, so this gate runs on the client only.
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { data: me } = useQuery(meQuery);
  return (
    <NativeSyncProvider userId={me?.userId}>
      <Outlet />
    </NativeSyncProvider>
  );
}
