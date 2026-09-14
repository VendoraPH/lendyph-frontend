"use client";

import { useCallback, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { RouteGuard } from "@/components/common";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAccountingResource } from "@/hooks";
import { accountingService } from "@/services";
import { formatCentavos } from "@/lib/accounting/money";
import { todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TrialBalance } from "@/types";
import { AccountingPageHeader } from "../_components/page-header";
import { DataState } from "../_components/data-state";
import {
  ALL_BRANCHES,
  BranchFilter,
  DateFilter,
  FilterBar,
  branchParam,
} from "../_components/accounting-filters";

export default function TrialBalancePage() {
  const [asOf, setAsOf] = useState(todayISO());
  const [branch, setBranch] = useState(ALL_BRANCHES);

  const fetcher = useCallback(
    () => accountingService.trialBalance(asOf, branchParam(branch)),
    [asOf, branch],
  );
  const resource = useAccountingResource<TrialBalance>(fetcher);

  return (
    <RouteGuard permission="accounting:view" pageName="Trial Balance">
      <div className="space-y-6">
        <AccountingPageHeader
          title="Trial Balance"
          description="Every account's balance, and proof they agree."
        />

        <FilterBar>
          <DateFilter label="As at" value={asOf} onChange={setAsOf} />
          <BranchFilter value={branch} onChange={setBranch} />
        </FilterBar>

        <DataState
          resource={resource}
          summary="All account balances as at a date, with total debits and total credits side by side."
          endpoints={["GET /accounting/trial-balance"]}
          isEmpty={(tb) => tb.rows.length === 0}
          emptyMessage="No account carries a balance as at this date."
        >
          {(tb) => (
            <div className="space-y-4">
              {/*
                The headline is not the totals, it is whether they match. An
                out-of-balance trial balance means something was posted that
                should not have been, and that is worth stating outright rather
                than leaving someone to compare two numbers by eye.
              */}
              <Card
                className={cn(
                  "border-2",
                  tb.is_balanced ? "border-emerald-500/30" : "border-destructive/40",
                )}
              >
                <CardContent className="flex items-center gap-3 py-4">
                  {tb.is_balanced ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                  ) : (
                    <XCircle className="h-5 w-5 shrink-0 text-destructive" />
                  )}
                  <div>
                    <p className="font-medium">
                      {tb.is_balanced ? "In balance" : "Out of balance"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {tb.is_balanced
                        ? "Total debits equal total credits."
                        : `Debits and credits differ by ${formatCentavos(
                            Math.abs(tb.total_debit - tb.total_credit),
                          )}. Something has been posted that should not have been.`}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-24">Code</TableHead>
                        <TableHead>Account</TableHead>
                        <TableHead className="w-36 text-right">Debit</TableHead>
                        <TableHead className="w-36 text-right">Credit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tb.rows.map((row) => (
                        <TableRow key={row.account_id}>
                          <TableCell className="font-mono text-xs">
                            {row.account_code}
                          </TableCell>
                          <TableCell>{row.account_name}</TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {/* Exactly one side is non-zero per account. */}
                            {row.debit ? formatCentavos(row.debit) : ""}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {row.credit ? formatCentavos(row.credit) : ""}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell colSpan={2} className="font-semibold">
                          Total
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold">
                          {formatCentavos(tb.total_debit)}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold">
                          {formatCentavos(tb.total_credit)}
                        </TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}
        </DataState>
      </div>
    </RouteGuard>
  );
}
