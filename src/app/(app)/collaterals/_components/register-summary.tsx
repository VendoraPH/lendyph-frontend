import { ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/utils/format";
import type { CollateralRegisterTotals } from "@/types";
import { excludedValueNote } from "../_lib/register";

/**
 * The register's three KPI cards, from `meta.totals`.
 *
 * The first two are the WHOLE book whatever the search or type filter; the
 * third is over the filtered rows, as its label says. Null totals mean nothing
 * has loaded, which is shown as a dash rather than a zero nobody counted.
 */
export function RegisterSummary({ totals }: { totals: CollateralRegisterTotals | null }) {
  const note = totals ? excludedValueNote(totals.unknown_count) : null;
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Collaterals</p>
              <p className="text-2xl font-bold">{totals ? totals.total_collaterals : "—"}</p>
            </div>
            <div className="rounded-full bg-brand-blue/10 p-2.5">
              <ShieldCheck className="h-5 w-5 text-brand-blue" />
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="py-4">
          <p className="text-xs font-medium text-muted-foreground">Tagged to Active Loans</p>
          <p className="text-2xl font-bold text-green-600">
            {totals ? totals.tagged_to_active_loans : "—"}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="py-4">
          <p className="text-xs font-medium text-muted-foreground">
            Total Appraised Value (filtered)
          </p>
          <p className="text-2xl font-bold tabular-nums text-brand-orange">
            {totals ? formatCurrency(totals.total_value) : "—"}
          </p>
          {note && (
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-500">{note}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
