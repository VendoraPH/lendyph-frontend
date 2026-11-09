import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { accountLabel, headerFigures, reconciledLabel } from "../_lib/reconciliation-view";
import type { ReconciliationDetail } from "../_lib/types";
import { ReconciledBadge } from "./match-badge";

/** The server's figures for one reconciliation, exactly as `present()` sends them. */
export function WorksheetHeader({ reconciliation }: { reconciliation: ReconciliationDetail }) {
  const reconciled = reconciliation.is_reconciled;

  return (
    <Card className={cn("border-2", reconciled ? "border-emerald-500/40" : "border-amber-500/50")}>
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-0.5">
            <p className="font-medium">{accountLabel(reconciliation)}</p>
            <p className="text-sm text-muted-foreground">
              {reconciliation.period} · {formatDate(reconciliation.start_date)} to{" "}
              {formatDate(reconciliation.end_date)}
            </p>
          </div>
          <ReconciledBadge reconciled={reconciled} label={reconciledLabel(reconciliation)} />
        </div>

        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {headerFigures(reconciliation).map((figure) => (
            <div key={figure.key} className="space-y-1">
              <dt className="text-sm text-muted-foreground">{figure.label}</dt>
              <dd
                className={cn(
                  "text-lg font-semibold",
                  figure.money && "font-mono",
                  figure.key === "difference" && !reconciled && "text-amber-600",
                )}
              >
                {figure.value}
              </dd>
            </div>
          ))}
        </dl>

        {reconciliation.notes && (
          <p className="text-sm text-muted-foreground">{reconciliation.notes}</p>
        )}
      </CardContent>
    </Card>
  );
}
