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
  /** Gives the label two lines' height, so a row of cards keeps its figures level. */
  evenLabels?: boolean;
}

const TONES = {
  default: "",
  warning: "text-amber-600 dark:text-amber-400",
  muted: "text-muted-foreground",
} as const;

/** One server figure with its label: the screen's card primitive. */
export function FigureCard({ label, value, hint, tone = "default", badge, evenLabels = false }: FigureCardProps) {
  return (
    <Card>
      <CardContent className="space-y-1 pt-6 fit:pt-0">
        <div className={cn("flex items-center justify-between gap-2", evenLabels && "min-h-10 items-start")}>
          <p className="text-sm text-muted-foreground">{label}</p>
          {badge}
        </div>
        <p className={cn("font-mono text-2xl font-semibold", TONES[tone])}>{value}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
