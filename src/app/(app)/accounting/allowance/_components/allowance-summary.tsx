import { AlertTriangle, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AllowancePreview } from "@/types";
import {
  lastPostingText,
  rateStrip,
  totalsView,
  unassignedNotice,
} from "../_lib/allowance";

/** The rates, the server's totals, the last posting and the no-branch balance. */
export function AllowanceSummary({ preview }: { preview: AllowancePreview }) {
  const totals = totalsView(preview);
  const unassigned = unassignedNotice(preview.unassigned_balance);
  const items: Array<[string, string]> = [
    ["Loans", totals.loans],
    ["Principal", totals.principal],
    ["Required", totals.required],
    ["Current balance", totals.currentBalance],
    ["Adjustment", totals.adjustment],
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2" aria-label="Provisioning rates">
        <span className="text-xs font-medium text-muted-foreground">Rates</span>
        {rateStrip(preview).map((rate) => (
          <Badge key={rate.bucket} variant="outline" className="font-normal">
            {rate.text}
          </Badge>
        ))}
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" aria-live="polite">
        {items.map(([label, value]) => (
          <div key={label} className="rounded-lg border p-3">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1 font-mono text-sm font-semibold">{value}</dd>
          </div>
        ))}
      </dl>

      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <History className="h-4 w-4 shrink-0" aria-hidden />
        {lastPostingText(preview.last_posting)}
      </p>

      {unassigned && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
          <span>{unassigned}</span>
        </div>
      )}
    </div>
  );
}
