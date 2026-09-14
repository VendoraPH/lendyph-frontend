"use client";

import { useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useAccountingResource } from "@/hooks";
import { accountingService } from "@/services";
import { formatDate } from "@/lib/format";
import type { CashFlowStatement, ReportSection as Section } from "@/types";
import { DataState } from "../../_components/data-state";
import { Amount, ReportSection } from "../../_components/report-section";

interface CashFlowReportProps {
  from: string;
  to: string;
  branchId?: number;
}

const toLines = (section: Section) =>
  section.lines.map((line, i) => ({
    key: line.account_id ? String(line.account_id) : `${section.label}-${i}`,
    code: line.account_code,
    label: line.label,
    amount: line.amount,
  }));

/**
 * The one statement that cannot be derived from the trial balance.
 *
 * Classifying a movement as operating, investing or financing is a judgement
 * about what the money was for — releasing a loan is operating for a lender
 * and investing for almost anyone else — and a balance carries no trace of it.
 * That classification lives with the accounts on the server, so this report
 * has to come from the server.
 */
export function CashFlowReport({ from, to, branchId }: CashFlowReportProps) {
  const fetcher = useCallback(
    () => accountingService.cashFlow({ from, to, branch_id: branchId }),
    [from, to, branchId],
  );
  const resource = useAccountingResource<CashFlowStatement>(fetcher);

  return (
    <DataState
      resource={resource}
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

          <p className="text-sm text-muted-foreground">
            {formatDate(report.from)} to {formatDate(report.to)}
          </p>

          <ReportSection
            title="Operating activities"
            lines={toLines(report.operating)}
            total={report.operating.total}
          />
          <ReportSection
            title="Investing activities"
            lines={toLines(report.investing)}
            total={report.investing.total}
          />
          <ReportSection
            title="Financing activities"
            lines={toLines(report.financing)}
            total={report.financing.total}
          />
        </div>
      )}
    </DataState>
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
