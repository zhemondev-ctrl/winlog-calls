import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { MessageCircle, Phone, Timer } from "lucide-react";
import { useEffect } from "react";

import { BrandPanel } from "@/components/winlog/brand-panel";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "WinLog — SIM and WhatsApp call log for company phones" },
      {
        name: "description",
        content:
          "WinLog logs every SIM and WhatsApp call on company Android phones, with talk time and daily and weekly stats.",
      },
      { property: "og:title", content: "WinLog — call log for company phones" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      {
        property: "og:description",
        content: "Every SIM and WhatsApp call from company phones, with talk time and stats.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();

  // Signed-in phones skip straight to today's stats.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  return (
    <BrandPanel>
      <h1 className="font-display text-5xl font-bold leading-[1.05] tracking-wide">
        Every call.
        <br />
        <span className="bg-accent px-1">Every phone.</span>
      </h1>
      <p className="mt-4 text-muted-foreground">
        WinLog collects SIM and WhatsApp calls from your company's Android phones and adds up the
        talk time.
      </p>
      <ul className="mt-6 space-y-3 text-sm">
        <li className="flex items-center gap-3">
          <Phone className="size-4" /> SIM calls straight from the phone's history
        </li>
        <li className="flex items-center gap-3">
          <MessageCircle className="size-4" /> WhatsApp calls, incoming, outgoing and missed
        </li>
        <li className="flex items-center gap-3">
          <Timer className="size-4" /> Daily and weekly talk time per employee
        </li>
      </ul>
      <Button asChild variant="signal" size="xl" className="mt-8 w-full">
        <Link to="/phone-code">Company phone setup</Link>
      </Button>
      <Button asChild variant="link" className="mt-3 w-full"><Link to="/auth">Manager sign in</Link></Button>
    </BrandPanel>
  );
}
