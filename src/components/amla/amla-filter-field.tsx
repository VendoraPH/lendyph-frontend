import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";

/** One filter above an AMLA list, labelled as the shared branch filter is, so every label matches. */
export function AmlaFilterField({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}
