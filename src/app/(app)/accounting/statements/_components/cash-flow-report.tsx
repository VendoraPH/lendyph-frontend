"use client";

import { useCallback } from "react";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { accountingService } from "@/services";
import { formatDate } from "@/lib/format";
import type { CashFlowStatement } from "@/types";
import { Amount, ReportSection } from "../../_components/report-section";
import { cashFlowLines } from "../_lib/statement-lines";
import { StatementState } from "./statement-state";
import { useStatementResource } from "./use-statement-resource";

interface CashFlowReportProps {
  from: string;
  to: string;
  branchId?: number;
}

/**
 * The one statement that cannot be derived from the trial balance.
 *
 * Classifying a movement as operating, investing or financing is a judgement
 * about what the money was for (releasing a loan is operating for a lender),
 * and a balance carries no trace of it. That classification lives with the
 * accounts on the server, so this report comes from the server, totals and
 * the reconciliation check included.
 */
export function CashFlowReport({ from, to, branchId }: CashFlowReportProps) {
  const fetcher = useCallback(
    () => accountingService.cashFlow({ from, to, branch_id: branchId }),
    [from, to, branchId],
  );
  const { resource, refusal } = useStatementResource<CashFlowStatement>(fetcher);

  return (
    <StatementState
      resource={resource}
      refusal={refusal}
      summary="Where cash came from and where it went, split into operating, investing and financing."
      endpoints={["GET /accounting/statements/cash-flow"]}
    >
      {(report) => (
        <div className="space-y-4">
          <Card className="border-2">
            <CardContent className="grid gap-4 py-4 sm:grid-cols-3">
              <Line label="Cash at start" value={report.opening_cash} />
              <Line label="Net change" value={report.net_change} />
              <Line label="Cash at end" value={report.closing_cash} strong />
            </CardContent>
          </Card>

          {report.is_reconciled === false && (
            <Card role="alert" className="border-2 border-amber-500/60">
              <CardContent className="flex items-center gap-3 py-4">
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" aria-hidden />
                <div className="flex-1">
                  <p className="font-medium">
                    This statement doesn&apos;t explain the whole change in cash
                  </p>
                  <p className="text-sm text-muted-foreground">
                    The three sections don&apos;t add up to the net change. The
                    part left unexplained is shown here; ask your accountant to
                    check the cash flow category on the accounts involved.
                  </p>
                </div>
                <Amount value={report.unexplained} className="font-semibold" />
              </CardContent>
            </Card>
          )}

          <p className="text-sm text-muted-foreground">
            {formatDate(report.from)} to {formatDate(report.to)}
          </p>

          <ReportSection
            title="Operating activities"
            lines={cashFlowLines(report.operating.lines, "operating")}
            total={report.operating.total}
          />
          <ReportSection
            title="Investing activities"
            lines={cashFlowLines(report.investing.lines, "investing")}
            total={report.investing.total}
          />
          <ReportSection
            title="Financing activities"
            lines={cashFlowLines(report.financing.lines, "financing")}
            total={report.financing.total}
          />

          {report.non_cash && (
            <section aria-labelledby="cash-flow-non-cash" className="space-y-2 pt-2">
              <p id="cash-flow-non-cash" className="text-sm text-muted-foreground">
                Fees and deductions kept back from loan proceeds. No cash moved
                for them, so they are outside every total above.
              </p>
              <ReportSection
                title={report.non_cash.label}
                lines={cashFlowLines(report.non_cash.lines, "non_cash")}
                total={report.non_cash.total}
                totalLabel="Total withheld (non-cash)"
                emptyMessage="Nothing was withheld at release in this period."
              />
            </section>
          )}
        </div>
      )}
    </StatementState>
  );
}

function Line({
  label,
  value,
  strong,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <div className="space-y-1">
      <p className="text-sm text-muted-foreground">{label}</p>
      <Amount value={value} className={strong ? "text-lg font-semibold" : "text-lg"} />
    </div>
  );
}
