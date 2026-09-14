"use client";

import { useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useAccountingResource } from "@/hooks";
import { accountingService } from "@/services";
import {
  buildIncomeStatement,
  subtractTrialBalances,
} from "@/lib/accounting/statements";
import { formatDate, formatDateISO } from "@/lib/format";
import type { TrialBalance } from "@/types";
import { DataState } from "../../_components/data-state";
import { Amount, ReportSection } from "../../_components/report-section";

interface IncomeStatementReportProps {
  from: string;
  to: string;
  branchId?: number;
}

/**
 * The day before an ISO date, for the opening trial balance.
 *
 * `formatDateISO` rather than `toISOString().slice(0, 10)`: the latter is UTC,
 * so in Manila it hands back the wrong day for most of the evening and the
 * income statement would silently start a day early.
 */
function dayBefore(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() - 1);
  return formatDateISO(date);
}

/** Closing and opening trial balances, fetched together. */
interface PeriodBalances {
  closing: TrialBalance;
  opening: TrialBalance;
}

/**
 * The period's result, derived from two trial balances.
 *
 * A trial balance is cumulative, so the one dated 30 September carries every
 * peso earned since the books opened — reading it as "September's income"
 * overstates the month by everything before it. September is the difference
 * between the balance on 30 September and the balance on 31 August, which is
 * why this fetches two and subtracts.
 */
export function IncomeStatementReport({
  from,
  to,
  branchId,
}: IncomeStatementReportProps) {
  const fetcher = useCallback(async (): Promise<PeriodBalances> => {
    const [closing, opening] = await Promise.all([
      accountingService.trialBalance(to, branchId),
      accountingService.trialBalance(dayBefore(from), branchId),
    ]);
    return { closing, opening };
  }, [from, to, branchId]);

  const resource = useAccountingResource<PeriodBalances>(fetcher);

  return (
    <DataState
      resource={resource}
      summary="Income earned and expenses incurred between two dates, and what is left."
      endpoints={["GET /accounting/trial-balance"]}
      isEmpty={({ closing }) => closing.rows.length === 0}
      emptyMessage="No posted entry in this period."
    >
      {(balances) => (
        <Statement balances={balances} from={from} to={to} />
      )}
    </DataState>
  );
}

function Statement({
  balances,
  from,
  to,
}: {
  balances: PeriodBalances;
  from: string;
  to: string;
}) {
  const statement = useMemo(
    () =>
      buildIncomeStatement(
        subtractTrialBalances(balances.closing.rows, balances.opening.rows),
        { from, to },
      ),
    [balances, from, to],
  );

  const toLines = (lines: typeof statement.income) =>
    lines
      // A category with no movement in the period is noise on a P&L.
      .filter((line) => line.amount !== 0)
      .map((line) => ({
        key: String(line.account_id),
        code: line.account_code,
        label: line.account_name,
        amount: line.amount,
      }));

  const loss = statement.net_income < 0;

  return (
    <div className="space-y-4">
      <Card className="border-2">
        <CardContent className="flex items-center justify-between gap-3 py-4">
          <div>
            <p className="font-medium">{loss ? "Net loss" : "Net income"}</p>
            <p className="text-sm text-muted-foreground">
              {formatDate(from)} to {formatDate(to)}
            </p>
          </div>
          <Amount value={statement.net_income} className="text-xl font-semibold" />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <ReportSection
          title="Income"
          lines={toLines(statement.income)}
          total={statement.total_income}
          emptyMessage="No income recorded in this period."
        />
        <ReportSection
          title="Expenses"
          lines={toLines(statement.expenses)}
          total={statement.total_expenses}
          emptyMessage="No expense recorded in this period."
        />
      </div>
    </div>
  );
}
