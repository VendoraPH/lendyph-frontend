"use client";

import { useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { accountingService } from "@/services";
import { formatDate } from "@/lib/format";
import type { IncomeStatement } from "@/types";
import { Amount, ReportSection } from "../../_components/report-section";
import { incomeStatementLines } from "../_lib/statement-lines";
import { StatementState } from "./statement-state";
import { useStatementResource } from "./use-statement-resource";

interface IncomeStatementReportProps {
  from: string;
  to: string;
  branchId?: number;
}

/**
 * The period's result, as the server builds it from the movements dated
 * `from` to `to`. Lines, totals and the net income are all server figures.
 */
export function IncomeStatementReport({
  from,
  to,
  branchId,
}: IncomeStatementReportProps) {
  const fetcher = useCallback(
    () => accountingService.incomeStatement({ from, to, branch_id: branchId }),
    [from, to, branchId],
  );

  const { resource, refusal } = useStatementResource<IncomeStatement>(fetcher);

  return (
    <StatementState
      resource={resource}
      refusal={refusal}
      summary="Income earned and expenses incurred between two dates, and what is left."
      endpoints={["GET /accounting/statements/income-statement"]}
      isEmpty={(statement) =>
        statement.income.length === 0 && statement.expenses.length === 0
      }
      emptyMessage="No posted entry in this period."
    >
      {(statement) => <Statement statement={statement} />}
    </StatementState>
  );
}

function Statement({ statement }: { statement: IncomeStatement }) {
  const loss = statement.net_income < 0;

  return (
    <div className="space-y-4">
      <Card className="border-2">
        <CardContent className="flex items-center justify-between gap-3 py-4">
          <div>
            <p className="font-medium">{loss ? "Net loss" : "Net income"}</p>
            <p className="text-sm text-muted-foreground">
              {formatDate(statement.period.from)} to{" "}
              {formatDate(statement.period.to)}
            </p>
          </div>
          <Amount value={statement.net_income} className="text-xl font-semibold" />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <ReportSection
          title="Income"
          lines={incomeStatementLines(statement.income)}
          total={statement.total_income}
          emptyMessage="No income recorded in this period."
        />
        <ReportSection
          title="Expenses"
          lines={incomeStatementLines(statement.expenses)}
          total={statement.total_expenses}
          emptyMessage="No expense recorded in this period."
        />
      </div>
    </div>
  );
}
