import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { SavingsDashboardKpis } from "@/types/savings-insight";
import { kpiCards } from "../_lib/dashboard-view";

/** The headline figures, each the server's, with ₱ and two decimals. */
export function KpiGrid({ kpis }: { kpis: SavingsDashboardKpis }) {
  const cards = kpiCards(kpis);
  return (
    <section aria-label="Headline figures" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.key}>
          <CardContent className="space-y-1 pt-6">
            <p className="text-sm text-muted-foreground">{card.label}</p>
            <p
              className={cn(
                "font-mono text-2xl font-semibold tabular-nums",
                card.signed === "negative" && "text-red-600",
                card.signed === "positive" && "text-emerald-600",
              )}
            >
              {card.value}
            </p>
            {card.caption && <p className="text-xs text-muted-foreground">{card.caption}</p>}
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
