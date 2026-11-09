import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface FigureCardProps {
  label: string;
  /** The figure, already formatted. */
  value: string;
  hint?: ReactNode;
  tone?: "default" | "warning" | "muted";
  /** Shown beside the label, such as a "Needs review" badge. */
  badge?: ReactNode;
}

const TONES = {
  default: "",
  warning: "text-amber-600 dark:text-amber-400",
  muted: "text-muted-foreground",
} as const;

/** One server figure with its label: the screen's card primitive. */
export function FigureCard({ label, value, hint, tone = "default", badge }: FigureCardProps) {
  return (
    <Card>
      <CardContent className="space-y-1 pt-6">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">{label}</p>
          {badge}
        </div>
        <p className={cn("font-mono text-2xl font-semibold", TONES[tone])}>{value}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
