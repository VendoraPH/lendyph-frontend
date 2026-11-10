import { formatCurrency } from "@/lib/format";
import type { MoneyString } from "@/types";
import { Kpi } from "../../_components/kpi";

export interface RunFigures {
  account_count: number;
  total_gross: MoneyString;
  total_tax: MoneyString;
  total_net: MoneyString;
}

/** The server's totals for a run or a preview; never summed from the lines. */
export function RunTotals({ figures }: { figures: RunFigures }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Kpi label="Accounts in run" value={String(figures.account_count)} />
      <Kpi label="Gross interest" value={formatCurrency(figures.total_gross)} />
      <Kpi label="Withholding tax" value={formatCurrency(figures.total_tax)} />
      <Kpi label="Net interest credited" value={formatCurrency(figures.total_net)} />
    </div>
  );
}
