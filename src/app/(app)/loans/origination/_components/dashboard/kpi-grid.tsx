import { Card, CardContent } from "@/components/ui/card";
import type { OriginationDashboard } from "@/types/loan-origination";
import { KPI_TILES, kpiChange, kpiText, previousText } from "../../_lib/dashboard-view";

/**
 * The dashboard's figures, each with its change and the previous period's
 * figure beside it, all as the server sent them. `amount_approved` is null
 * without `loans:view`, and so is its change.
 */
export function KpiGrid({
  data,
  canViewLoans,
}: {
  data: Pick<OriginationDashboard, "kpis" | "previous" | "changes">;
  canViewLoans: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {KPI_TILES.map((t) => {
        const change = kpiChange(data.changes, t.key);
        return (
          <Card key={t.key} className="py-0">
            <CardContent className="space-y-1 p-3">
              <p className="text-xs text-muted-foreground">{t.label}</p>
              <p className="text-lg font-semibold tabular-nums">{kpiText(data.kpis[t.key], t.kind)}</p>
              {change && <p className="text-xs font-medium tabular-nums">{change}</p>}
              <p className="text-xs text-muted-foreground">
                {t.key === "amount_approved" && !canViewLoans
                  ? "Needs the permission to view loans"
                  : previousText(data.previous[t.key], t.kind)}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
