"use client";

import { useState } from "react";
import { RouteGuard } from "@/components/common";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { todayISO } from "@/lib/format";
import { AccountingPageHeader } from "../_components/page-header";
import {
  ALL_BRANCHES,
  BranchFilter,
  DateFilter,
  FilterBar,
  branchParam,
} from "../_components/accounting-filters";
import { BalanceSheetReport } from "./_components/balance-sheet-report";
import { IncomeStatementReport } from "./_components/income-statement-report";
import { CashFlowReport } from "./_components/cash-flow-report";
import { EquityChangesReport } from "./_components/equity-changes-report";
import { statementRangeError } from "./_lib/statement-request";

function startOfYearISO(): string {
  return `${new Date().getFullYear()}-01-01`;
}

/** Shown in place of a range statement while From is after To; nothing is sent. */
function RangeRefused({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="py-12 text-center text-sm text-muted-foreground">
        {message} Change the dates to see this statement.
      </CardContent>
    </Card>
  );
}

/**
 * The four statements, as tabs rather than as four sidebar entries.
 *
 * The spec nests them under a "Financial Statements" heading, but `NavSubItem`
 * has no children — the sidebar is two levels deep by design. Tabs give the
 * same grouping without a third nav level, and they share one set of filters,
 * which is what someone comparing the sheet against the P&L actually wants.
 *
 * The balance sheet is first because it is the one a lender opens daily.
 */
export default function FinancialStatementsPage() {
  const [tab, setTab] = useState("balance-sheet");
  const [from, setFrom] = useState(startOfYearISO());
  const [to, setTo] = useState(todayISO());
  const [branch, setBranch] = useState(ALL_BRANCHES);

  const branchId = branchParam(branch);
  // The balance sheet is a position on a date, not a range — it reads the
  // period's end, so moving `to` moves the sheet with it.
  const asOf = to;
  // A To before From is refused here, so the three range statements never ask.
  const rangeError = statementRangeError(from, to);
  const showRangeError = tab !== "balance-sheet" && rangeError !== null;

  return (
    <RouteGuard permission="accounting:view" pageName="Financial Statements">
      <div className="space-y-6">
        <AccountingPageHeader
          title="Financial Statements"
          description="The four statements, from the same set of posted entries."
        />

        <FilterBar>
          {tab !== "balance-sheet" && (
            <DateFilter label="From" value={from} onChange={setFrom} />
          )}
          <DateFilter
            label={tab === "balance-sheet" ? "As of" : "To"}
            value={to}
            onChange={setTo}
          />
          <BranchFilter value={branch} onChange={setBranch} />
          {showRangeError && (
            <p role="alert" className="pb-2 text-sm text-destructive">
              {rangeError}
            </p>
          )}
        </FilterBar>

        <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
          <TabsList>
            <TabsTrigger value="balance-sheet">Balance Sheet</TabsTrigger>
            <TabsTrigger value="income-statement">Income Statement</TabsTrigger>
            <TabsTrigger value="cash-flow">Cash Flow</TabsTrigger>
            <TabsTrigger value="equity">Changes in Equity</TabsTrigger>
          </TabsList>

          <TabsContent value="balance-sheet" className="mt-4">
            <BalanceSheetReport asOf={asOf} branchId={branchId} />
          </TabsContent>
          <TabsContent value="income-statement" className="mt-4">
            {rangeError ? (
              <RangeRefused message={rangeError} />
            ) : (
              <IncomeStatementReport from={from} to={to} branchId={branchId} />
            )}
          </TabsContent>
          <TabsContent value="cash-flow" className="mt-4">
            {rangeError ? (
              <RangeRefused message={rangeError} />
            ) : (
              <CashFlowReport from={from} to={to} branchId={branchId} />
            )}
          </TabsContent>
          <TabsContent value="equity" className="mt-4">
            {rangeError ? (
              <RangeRefused message={rangeError} />
            ) : (
              <EquityChangesReport from={from} to={to} branchId={branchId} />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </RouteGuard>
  );
}
