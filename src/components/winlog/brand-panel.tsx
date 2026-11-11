import type { ReactNode } from "react";

import logo from "@/assets/winstone-logo.png.asset.json";

export function BrandPanel({ children }: { children: ReactNode }) {
  return (
    <div className="ledger-bg flex min-h-screen flex-col px-5 py-8">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col">
        <div className="flex items-center gap-3">
          <img
            src={logo.url}
            alt="Winstone Properties"
            className="size-14 rounded-full shadow-card"
          />
          <div>
            <div className="font-display text-xl font-bold tracking-wide">WinLog</div>
            <div className="stamp text-muted-foreground">Winstone Properties Ltd.</div>
          </div>
        </div>
        <div className="gold-rule mt-5" />
        <div className="flex flex-1 flex-col justify-center py-10">{children}</div>
        <p className="stamp text-muted-foreground">SIM + WhatsApp call log for company phones</p>
      </div>
    </div>
  );
}
