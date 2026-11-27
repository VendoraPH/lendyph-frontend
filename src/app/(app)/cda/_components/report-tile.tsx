import Link from "next/link";
import { Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import type { CdaDashboardReport } from "@/types/cda";
import { PART_LABELS, REPORT_PAGES, REPORT_TYPE_LABELS, labelOf } from "../_lib/labels";
import { ReadinessMeter } from "./readiness-meter";
import { DeadlineBadge, ReportStatusBadge, ToneBadge } from "./tone-badge";

/**
 * One report on the dashboard (carried over from #510 by Augustin): its
 * status, readiness, issues and deadline, all the server's. A report the user
 * may not open (mediation, audit or tax without its view) shows no figures
 * and no link.
 */
export function ReportTile({ report }: { report: CdaDashboardReport }) {
  const title = labelOf(REPORT_TYPE_LABELS, report.report_type);
  const part = report.part !== "annual" ? labelOf(PART_LABELS, report.part) : null;
  const filed = report.status === "submitted" || report.status === "accepted";

  if (report.restricted) {
    return (
      <Card className="h-full opacity-70">
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <CardTitle className="text-sm">
            {title}
            {part && <span className="block text-xs font-normal text-muted-foreground">{part}</span>}
          </CardTitle>
          <ToneBadge tone="neutral" label="Restricted" />
        </CardHeader>
        <CardContent className="flex items-center gap-2 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5" aria-hidden="true" /> Needs its own view permission.
        </CardContent>
      </Card>
    );
  }

  return (
    <Link href={REPORT_PAGES[report.report_type]?.href ?? "/cda"} className="group block">
      <Card className={cn("h-full transition-colors group-hover:border-primary/50", !report.applicable && "opacity-60")}>
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <CardTitle className="text-sm">
            {title}
            {part && <span className="block text-xs font-normal text-muted-foreground">{part}</span>}
          </CardTitle>
          <ReportStatusBadge status={report.display_status} />
        </CardHeader>
        {report.applicable && (
          <CardContent className="space-y-2">
            <ReadinessMeter value={report.readiness} critical={report.critical} />
            <p className="text-xs text-muted-foreground">
              {report.critical} critical · {report.warnings} {report.warnings === 1 ? "warning" : "warnings"}
            </p>
            <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              Due {formatDate(report.effective_deadline)}
              <DeadlineBadge daysRemaining={report.days_remaining} filed={filed} />
            </p>
          </CardContent>
        )}
      </Card>
    </Link>
  );
}
