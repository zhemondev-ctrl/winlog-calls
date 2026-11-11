import type { ReactNode } from "react";

export function BrandPanel({ children }: { children: ReactNode }) {
  return (
    <div className="ledger-bg flex min-h-screen flex-col px-5 py-8">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col">
        <div className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-full border-2 border-foreground bg-accent font-display font-extrabold">
            W
          </span>
          <span className="font-display text-xl font-extrabold tracking-tight">WinLog</span>
        </div>
        <div className="flex flex-1 flex-col justify-center py-10">{children}</div>
        <p className="stamp text-muted-foreground">SIM + WhatsApp call log for company phones</p>
      </div>
    </div>
  );
}
