"use client";

import { useCallback, useMemo } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useAccountingResource } from "@/hooks";
import { accountingService } from "@/services";
import { buildBalanceSheet } from "@/lib/accounting/statements";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TrialBalance } from "@/types";
import { DataState } from "../../_components/data-state";
import { Amount, ReportSection } from "../../_components/report-section";

interface BalanceSheetReportProps {
  asOf: string;
  branchId?: number;
}

/**
 * Built in the browser from the trial balance rather than fetched.
 *
 * A balance sheet is a regrouping of the trial balance and nothing more, so
 * giving it its own endpoint would create a second place the same figure is
 * computed — and two places eventually disagree. One fetch, one source of
 * truth, and `buildBalanceSheet` is unit-tested against the worked example.
 */
export function BalanceSheetReport({ asOf, branchId }: BalanceSheetReportProps) {
  const fetcher = useCallback(
    () => accountingService.trialBalance(asOf, branchId),
    [asOf, branchId],
  );
  const resource = useAccountingResource<TrialBalance>(fetcher);

  return (
    <DataState
      resource={resource}
      summary="What the business owns, owes and is worth on a date."
      endpoints={["GET /accounting/trial-balance"]}
      isEmpty={(tb) => tb.rows.length === 0}
      emptyMessage="No posted entry on or before this date."
    >
      {(tb) => <Sheet trialBalance={tb} asOf={asOf} />}
    </DataState>
  );
}

function Sheet({
  trialBalance,
  asOf,
}: {
  trialBalance: TrialBalance;
  asOf: string;
}) {
  const sheet = useMemo(
    () => buildBalanceSheet(trialBalance.rows, asOf),
    [trialBalance.rows, asOf],
  );

  const toLines = (lines: typeof sheet.assets) =>
    lines.map((line) => ({
      key: String(line.account_id),
      code: line.account_code,
      label: line.account_name,
      amount: line.amount,
    }));

  return (
    <div className="space-y-4">
      <Card
        className={cn(
          "border-2",
          sheet.is_balanced ? "border-emerald-500/40" : "border-red-500/60",
        )}
      >
        <CardContent className="flex items-center gap-3 py-4">
          {sheet.is_balanced ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-red-600" />
          )}
          <div className="flex-1">
            <p className="font-medium">
              {sheet.is_balanced
                ? "Assets equal liabilities plus equity"
                : "The sheet does not balance"}
            </p>
            <p className="text-sm text-muted-foreground">
              As of {formatDate(sheet.as_of)}
              {!sheet.is_balanced && " · difference below"}
            </p>
          </div>
          {!sheet.is_balanced && <Amount value={sheet.difference} />}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <ReportSection
          title="Assets"
          lines={toLines(sheet.assets)}
          total={sheet.total_assets}
        />
        <div className="space-y-4">
          <ReportSection
            title="Liabilities"
            lines={toLines(sheet.liabilities)}
            total={sheet.total_liabilities}
          />
          <ReportSection
            title="Equity"
            lines={toLines(sheet.equity)}
            total={sheet.total_equity}
            footer={{
              label: "Total liabilities and equity",
              amount: sheet.total_liabilities + sheet.total_equity,
            }}
          />
        </div>
      </div>

      {/*
        Named explicitly because it is the line people query: income and
        expense accounts never appear on a balance sheet, yet their net result
        has to, or the sheet misses by exactly the period's profit.
      */}
      <p className="text-xs text-muted-foreground">
        Equity includes Current Year Earnings, the period&apos;s net result
        carried in so the sheet closes. Your accountant folds it into Retained
        Earnings at year end.
      </p>
    </div>
  );
}
