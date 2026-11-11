import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "accent" | "missed" | "whatsapp";
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card p-4 shadow-card",
        tone === "accent" && "border-2 border-foreground bg-accent shadow-lift",
      )}
    >
      <div className="stamp text-muted-foreground">{label}</div>
      <div
        className={cn(
          "num mt-2 text-3xl font-semibold md:text-4xl",
          tone === "missed" && "text-missed",
          tone === "whatsapp" && "text-whatsapp",
        )}
      >
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
