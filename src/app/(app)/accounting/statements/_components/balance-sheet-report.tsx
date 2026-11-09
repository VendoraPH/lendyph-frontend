"use client";

import { useCallback } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useAccountingResource } from "@/hooks";
import { accountingService } from "@/services";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { BalanceSheet } from "@/types";
import { DataState } from "../../_components/data-state";
import { Amount, ReportSection } from "../../_components/report-section";
import { balanceSheetLines } from "../_lib/statement-lines";

interface BalanceSheetReportProps {
  asOf: string;
  branchId?: number;
}

/**
 * The balance sheet, as the server builds it.
 *
 * Every figure on it, the two earnings lines and the totals included, comes
 * from `GET /accounting/statements/balance-sheet`. The server works out
 * Current Year Earnings from 1 January of the as-of year, the same window the
 * Income Statement covers, so the two tabs can't disagree.
 */
export function BalanceSheetReport({ asOf, branchId }: BalanceSheetReportProps) {
  const fetcher = useCallback(
    () => accountingService.balanceSheet(asOf, branchId),
    [asOf, branchId],
  );

  const resource = useAccountingResource<BalanceSheet>(fetcher);

  return (
    <DataState
      resource={resource}
      summary="What the business owns, owes and is worth on a date."
      endpoints={["GET /accounting/statements/balance-sheet"]}
      isEmpty={(sheet) =>
        sheet.assets.length === 0 &&
        sheet.liabilities.length === 0 &&
        sheet.equity.length === 0
      }
      emptyMessage="No posted entry on or before this date."
    >
      {(sheet) => <Sheet sheet={sheet} />}
    </DataState>
  );
}

function Sheet({ sheet }: { sheet: BalanceSheet }) {
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
            <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden />
          ) : (
            <AlertTriangle className="h-5 w-5 text-red-600" aria-hidden />
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
          lines={balanceSheetLines(sheet.assets)}
          total={sheet.total_assets}
        />
        <div className="space-y-4">
          <ReportSection
            title="Liabilities"
            lines={balanceSheetLines(sheet.liabilities)}
            total={sheet.total_liabilities}
          />
          <ReportSection
            title="Equity"
            lines={balanceSheetLines(sheet.equity)}
            total={sheet.total_equity}
            footer={{
              label: "Total liabilities and equity",
              amount: sheet.total_liabilities_and_equity,
            }}
          />
        </div>
      </div>

      {/*
        Named explicitly because it is the line people query: income and
        expense accounts never appear on a balance sheet, yet their net result
        has to, or the sheet misses by exactly the period's profit. The dates
        are stated so nobody has to guess which window each line covers.
      */}
      {sheet.earnings_period && (
        <p className="text-xs text-muted-foreground">
          Current Year Earnings is the net result from{" "}
          {formatDate(sheet.earnings_period.from)} to{" "}
          {formatDate(sheet.earnings_period.to)}, the same figure the Income
          Statement tab reports for that period. Prior Period Earnings is
          everything earned before it and not yet closed into Retained
          Earnings. Both are carried into equity so the sheet closes.
        </p>
      )}
    </div>
  );
}
