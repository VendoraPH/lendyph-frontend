"use client";

import { useCallback, useMemo } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useAccountingResource } from "@/hooks";
import { accountingService } from "@/services";
import {
  buildBalanceSheet,
  dayBefore,
  startOfFinancialYear,
} from "@/lib/accounting/statements";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TrialBalance } from "@/types";
import { DataState } from "../../_components/data-state";
import { Amount, ReportSection } from "../../_components/report-section";

interface BalanceSheetReportProps {
  asOf: string;
  branchId?: number;
}

/** Closing position, and the books as they stood when the year opened. */
interface SheetBalances {
  closing: TrialBalance;
  opening: TrialBalance;
  /** The window the Current Year Earnings line covers. */
  period: { from: string; to: string };
}

/**
 * Built in the browser from the trial balance rather than fetched.
 *
 * A balance sheet is a regrouping of the trial balance and nothing more, so
 * giving it its own endpoint would create a second place the same figure is
 * computed — and two places eventually disagree. One source of truth, and
 * `buildBalanceSheet` is unit-tested against the worked example.
 *
 * TWO trial balances, not one, and that is the fix rather than an optimisation
 * missed. A trial balance is cumulative, so the single closing one this used to
 * pass carried every peso earned since the books opened — which
 * `buildBalanceSheet` then printed under the heading "Current Year Earnings".
 * On a co-op trading since 2024 whose books have never been closed, that line
 * read ₱3,000,000 while the Income Statement tab, one click away and computing
 * the same year properly from two balances, read ₱750,000. Fetching the
 * opening balance here lets the sheet do the identical subtraction, so the two
 * tabs cannot disagree.
 *
 * The opening date comes from `asOf`, not from the shared `from` filter: the
 * filter is hidden on this tab because a balance sheet is a position on a date,
 * and "current year" on a balance sheet means the financial year regardless of
 * what range someone last set for the P&L.
 */
export function BalanceSheetReport({ asOf, branchId }: BalanceSheetReportProps) {
  const fetcher = useCallback(async (): Promise<SheetBalances> => {
    const from = startOfFinancialYear(asOf);
    const [closing, opening] = await Promise.all([
      accountingService.trialBalance(asOf, branchId),
      accountingService.trialBalance(dayBefore(from), branchId),
    ]);
    return { closing, opening, period: { from, to: asOf } };
  }, [asOf, branchId]);

  const resource = useAccountingResource<SheetBalances>(fetcher);

  return (
    <DataState
      resource={resource}
      summary="What the business owns, owes and is worth on a date."
      endpoints={["GET /accounting/trial-balance"]}
      isEmpty={({ closing }) => closing.rows.length === 0}
      emptyMessage="No posted entry on or before this date."
    >
      {(balances) => <Sheet balances={balances} asOf={asOf} />}
    </DataState>
  );
}

function Sheet({
  balances,
  asOf,
}: {
  balances: SheetBalances;
  asOf: string;
}) {
  const sheet = useMemo(
    () =>
      buildBalanceSheet(balances.closing.rows, asOf, {
        rows: balances.opening.rows,
        period: balances.period,
      }),
    [balances, asOf],
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

        The dates are stated rather than implied. Two equity lines that both
        sound like "profit" are exactly how the ₱3,000,000 / ₱750,000
        disagreement went unnoticed, and the only defence is saying on screen
        which window each one covers.
      */}
      <p className="text-xs text-muted-foreground">
        {sheet.earnings_basis === "period" && sheet.earnings_period ? (
          <>
            Current Year Earnings is the net result from{" "}
            {formatDate(sheet.earnings_period.from)} to{" "}
            {formatDate(sheet.earnings_period.to)} — the same figure the Income
            Statement tab reports for that period. Prior Period Earnings is
            everything earned before it and not yet closed into Retained
            Earnings. Both are carried into equity so the sheet closes.
          </>
        ) : (
          <>
            Accumulated Earnings is every peso earned since the books opened,
            not this year&apos;s result, because the opening balance for the
            year could not be read. Your accountant closes it into Retained
            Earnings at year end.
          </>
        )}
      </p>
    </div>
  );
}
