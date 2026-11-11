import Link from "next/link";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ISSUE_CATEGORY_LABELS, SEVERITY_META, labelOf, reportName } from "../_lib/labels";
import { ToneBadge } from "./tone-badge";
import type { CdaIssue, CdaSeverity } from "@/types/cda";

const ICON: Record<CdaSeverity, { icon: typeof XCircle; className: string }> = {
  critical: { icon: XCircle, className: "text-red-600" },
  warning: { icon: AlertTriangle, className: "text-amber-600" },
  info: { icon: Info, className: "text-blue-600" },
};

const ORDER: CdaSeverity[] = ["critical", "warning", "info"];

/** Only links inside the app are offered as "Fix". */
function fixPath(href: string | null): string | null {
  return href && href.startsWith("/") && !href.startsWith("//") ? href : null;
}

/**
 * The server's issues (carried over from #510 by Augustin, on the server's
 * fields). Critical blocks review, approval and finalizing; warnings need a
 * confirmation to finalize; info never blocks. Critical first, then warnings,
 * then info, each in the server's order. The counts are the server's.
 */
export function ValidationPanel({
  issues,
  critical,
  warnings,
  showReport = false,
  title = "Issues",
}: {
  issues: CdaIssue[];
  critical: number;
  warnings: number;
  showReport?: boolean;
  title?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <div className="flex flex-wrap gap-2">
          <ToneBadge tone="danger" label={`${critical} Critical`} />
          <ToneBadge tone="warning" label={`${warnings} ${warnings === 1 ? "Warning" : "Warnings"}`} />
        </div>
      </CardHeader>
      <CardContent>
        {issues.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" /> No open issues.
          </p>
        ) : (
          <ul className="divide-y">
            {ORDER.flatMap((severity) => issues.filter((i) => i.severity === severity)).map((issue) => {
              const { icon: Icon, className } = ICON[issue.severity] ?? ICON.info;
              const href = fixPath(issue.fix_href);
              return (
                <li key={`${issue.report_id ?? ""}-${issue.id}`} className="flex items-start gap-3 py-2 text-sm">
                  <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${className}`} aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p>{issue.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {[
                        SEVERITY_META[issue.severity]?.label,
                        labelOf(ISSUE_CATEGORY_LABELS, issue.category),
                        showReport && issue.report_type ? reportName(issue.report_type, issue.part) : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  {href && (
                    <Link href={href} className="shrink-0 text-xs font-medium text-primary hover:underline">
                      Fix
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
