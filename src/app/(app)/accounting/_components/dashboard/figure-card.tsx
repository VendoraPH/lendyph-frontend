import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { centavosOrDash, centavosOrNull } from "../../_lib/dashboard-figures";

interface FigureCardProps {
  label: string;
  /** Centavos from the server; missing shows a dash. */
  value: number | null | undefined;
  icon: LucideIcon;
  /** Colours the figure by its sign (net income). */
  signed?: boolean;
  /** A line under the figure. */
  caption?: ReactNode;
  /** Shown beside the label (a status badge). */
  badge?: ReactNode;
}

export function FigureCard({ label, value, icon: Icon, signed, caption, badge }: FigureCardProps) {
  const centavos = centavosOrNull(value);
  return (
    <Card>
      <CardContent className="space-y-2 pt-6">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="text-sm">{label}</span>
          {badge && <span className="ml-auto">{badge}</span>}
        </div>
        <p
          className={cn(
            "font-mono text-2xl font-semibold tabular-nums",
            signed && centavos !== null && centavos < 0 && "text-red-600",
            signed && centavos !== null && centavos >= 0 && "text-emerald-600",
          )}
        >
          {centavosOrDash(value)}
        </p>
        {caption && <p className="text-xs text-muted-foreground">{caption}</p>}
      </CardContent>
    </Card>
  );
}

/** A labelled group of cards. */
export function FigureSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section aria-label={title}>
      <div className="mb-3">
        <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className={cn("grid gap-4", className)}>{children}</div>
    </section>
  );
}
