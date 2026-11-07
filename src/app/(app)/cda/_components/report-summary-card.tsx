import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { CdaReportSummary } from "@/types/cda";
import { REPORT_META } from "../_lib/labels";
import { ReadinessMeter } from "./readiness-meter";
import { ReportStatusBadge, ToneBadge } from "./tone-badge";

/** One report's tile on the dashboard: status, readiness, open issues. */
export function ReportSummaryCard({ summary }: { summary: CdaReportSummary }) {
  const meta = REPORT_META[summary.type];
  return (
    <Link href={meta.href} className="group block">
      <Card className={cn("h-full transition-colors group-hover:border-primary/50", !summary.applicable && "opacity-60")}>
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <CardTitle className="text-sm">{meta.title}</CardTitle>
          {summary.applicable ? (
            <ReportStatusBadge status={summary.status} />
          ) : (
            <ToneBadge tone="neutral" label="Not applicable" />
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {summary.applicable && (
            <>
              <ReadinessMeter value={summary.readiness} critical={summary.critical} />
              <p className="text-xs text-muted-foreground">
                {summary.critical} critical · {summary.warnings} warning{summary.warnings === 1 ? "" : "s"}
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
