import { Card, CardContent } from "@/components/ui/card";
import type { OriginationKpis } from "@/types/loan-origination";
import { KPI_TILES, kpiText, previousText } from "../../_lib/dashboard-view";

/**
 * The dashboard's figures, each with the previous period's beside it, both as
 * the server sent them. `amount_approved` is null without `loans:view`.
 */
export function KpiGrid({ kpis, previous, canViewLoans }: { kpis: OriginationKpis; previous: OriginationKpis; canViewLoans: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {KPI_TILES.map((t) => (
        <Card key={t.key} className="py-0">
          <CardContent className="space-y-1 p-3">
            <p className="text-xs text-muted-foreground">{t.label}</p>
            <p className="text-lg font-semibold tabular-nums">{kpiText(kpis[t.key], t.kind)}</p>
            <p className="text-xs text-muted-foreground">
              {t.key === "amount_approved" && !canViewLoans ? "Needs the permission to view loans" : previousText(previous[t.key], t.kind)}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
