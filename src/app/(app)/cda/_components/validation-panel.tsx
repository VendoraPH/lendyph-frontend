import Link from "next/link";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { countBySeverity, sortIssues } from "../_lib/readiness";
import { REPORT_META, SEVERITY_META } from "../_lib/labels";
import { ToneBadge } from "./tone-badge";
import type { CdaSeverity, CdaValidationIssue } from "@/types/cda";

const ICON: Record<CdaSeverity, { icon: typeof XCircle; className: string }> = {
  critical: { icon: XCircle, className: "text-red-600" },
  warning: { icon: AlertTriangle, className: "text-amber-600" },
  info: { icon: Info, className: "text-blue-600" },
};

/**
 * Validation results. Critical blocks review and finalize; warnings and info
 * never block. `showReport` names each issue's report, for the dashboard's
 * cross-report list.
 */
export function ValidationPanel({
  issues,
  showReport = false,
  title = "Validation",
}: {
  issues: CdaValidationIssue[];
  showReport?: boolean;
  title?: string;
}) {
  const counts = countBySeverity(issues);
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(SEVERITY_META) as CdaSeverity[]).map((s) => (
            <ToneBadge key={s} tone={SEVERITY_META[s].tone} label={`${counts[s]} ${SEVERITY_META[s].label}`} />
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {issues.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" /> No open issues.
          </p>
        ) : (
          <ul className="divide-y">
            {sortIssues(issues).map((issue) => {
              const { icon: Icon, className } = ICON[issue.severity];
              return (
                <li key={issue.id} className="flex items-start gap-3 py-2 text-sm">
                  <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${className}`} aria-label={SEVERITY_META[issue.severity].label} />
                  <div className="min-w-0 flex-1">
                    <p>{issue.message}</p>
                    {showReport && (
                      <p className="text-xs text-muted-foreground">{REPORT_META[issue.report_type].title}</p>
                    )}
                  </div>
                  {issue.fix_href && (
                    <Link href={issue.fix_href} className="shrink-0 text-xs font-medium text-primary hover:underline">
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
