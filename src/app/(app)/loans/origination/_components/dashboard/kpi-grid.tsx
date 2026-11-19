import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { formatDuration, percentChange } from "@/lib/loan-origination";
import { cn } from "@/lib/utils";
import type { OriginationKpis } from "@/types/loan-origination";

type Kind = "count" | "money" | "percent" | "hours";

/** `invert`: a rise is bad news, so it is coloured red. */
const TILES: { key: keyof OriginationKpis; label: string; kind: Kind; invert?: boolean }[] = [
  { key: "total", label: "Total applications", kind: "count" },
  { key: "new", label: "New applications", kind: "count" },
  { key: "incomplete", label: "Incomplete applications", kind: "count", invert: true },
  { key: "submitted", label: "Submitted", kind: "count" },
  { key: "pending_documents", label: "Pending document review", kind: "count", invert: true },
  { key: "under_assessment", label: "Under assessment", kind: "count" },
  { key: "pending_approval", label: "Pending approval", kind: "count" },
  { key: "approved", label: "Approved", kind: "count" },
  { key: "rejected", label: "Rejected", kind: "count", invert: true },
  { key: "additional_info_required", label: "Additional info required", kind: "count", invert: true },
  { key: "amount_requested", label: "Total amount requested", kind: "money" },
  { key: "amount_approved", label: "Total amount approved", kind: "money" },
  { key: "avg_processing_hours", label: "Average processing time", kind: "hours", invert: true },
  { key: "completion_rate", label: "Completion rate", kind: "percent" },
  { key: "approval_rate", label: "Approval rate", kind: "percent" },
];

const countFmt = new Intl.NumberFormat("en-PH");

function show(value: number | null | undefined, kind: Kind): string {
  if (typeof value !== "number") return "—";
  if (kind === "money") return formatCurrency(value);
  if (kind === "percent") return `${Math.round(value * 10) / 10}%`;
  if (kind === "hours") return formatDuration(value);
  return countFmt.format(value);
}

/** The fifteen dashboard figures, each against the period before when the server sends it. */
export function KpiGrid({ kpis, previous }: { kpis: OriginationKpis; previous: Partial<OriginationKpis> | null }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {TILES.map((t) => {
        const change = percentChange(kpis[t.key], previous?.[t.key]);
        const good = change !== null && (t.invert ? change < 0 : change > 0);
        return (
          <Card key={t.key} className="py-0">
            <CardContent className="space-y-1 p-3">
              <p className="text-xs text-muted-foreground">{t.label}</p>
              <p className="text-lg font-semibold tabular-nums">{show(kpis[t.key], t.kind)}</p>
              {change !== null && change !== 0 && (
                <p
                  className={cn(
                    "flex items-center gap-0.5 text-xs",
                    good ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400",
                  )}
                >
                  {change > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {Math.abs(change)}% vs previous period
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
