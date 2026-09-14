"use client";

import { useCallback, useState } from "react";
import { RouteGuard } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAccountingResource, useChartOfAccounts } from "@/hooks";
import { accountingService } from "@/services";
import { formatCentavos } from "@/lib/accounting/money";
import { formatDate, todayISO } from "@/lib/format";
import type { LedgerEntry } from "@/types";
import { AccountingPageHeader } from "../_components/page-header";
import { DataState } from "../_components/data-state";
import { AccountSelect } from "../_components/account-select";
import {
  ALL_BRANCHES,
  BranchFilter,
  DateFilter,
  FilterBar,
  branchParam,
} from "../_components/accounting-filters";

/** First day of the current month — the range a ledger is usually opened on. */
function startOfMonthISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

export default function GeneralLedgerPage() {
  const { postable } = useChartOfAccounts();
  const [accountId, setAccountId] = useState<number | null>(null);
  const [from, setFrom] = useState(startOfMonthISO());
  const [to, setTo] = useState(todayISO());
  const [branch, setBranch] = useState(ALL_BRANCHES);

  const fetcher = useCallback(
    () =>
      accountingService.generalLedger({
        account_id: accountId ?? undefined,
        from,
        to,
        branch_id: branchParam(branch),
      }),
    [accountId, from, to, branch],
  );

  // A ledger with no account chosen is every movement in the book, which is
  // not a ledger. Hold the request until one is picked.
  const resource = useAccountingResource<LedgerEntry[]>(fetcher, accountId !== null);
  const account = postable.find((a) => a.id === accountId);

  return (
    <RouteGuard permission="accounting:view" pageName="General Ledger">
      <div className="space-y-6">
        <AccountingPageHeader
          title="General Ledger"
          description="Every movement through a single account."
        />

        <FilterBar>
          <AccountSelect
            label="Account"
            accounts={postable}
            value={accountId}
            onChange={setAccountId}
          />
          <DateFilter label="From" value={from} onChange={setFrom} />
          <DateFilter label="To" value={to} onChange={setTo} />
          <BranchFilter value={branch} onChange={setBranch} />
        </FilterBar>

        {accountId === null ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              Choose an account to see its ledger.
            </CardContent>
          </Card>
        ) : (
          <DataState
            resource={resource}
            summary="One account at a time, over a date range, with a running balance and a link back to the journal entry behind each line."
            endpoints={["GET /accounting/general-ledger"]}
            isEmpty={(rows) => rows.length === 0}
            emptyMessage="No movement through this account in the chosen range."
          >
            {(rows) => (
              <Card>
                <CardContent className="space-y-4 pt-6">
                  {account && (
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-muted-foreground">
                        {account.code}
                      </span>
                      <span className="font-medium">{account.name}</span>
                      <Badge variant="outline" className="capitalize">
                        {account.normal_balance}-normal
                      </Badge>
                    </div>
                  )}
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-28">Date</TableHead>
                        <TableHead className="w-28">Journal</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="w-28">Source</TableHead>
                        <TableHead className="w-32 text-right">Debit</TableHead>
                        <TableHead className="w-32 text-right">Credit</TableHead>
                        <TableHead className="w-36 text-right">Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row, i) => (
                        <TableRow key={`${row.journal_id}-${i}`}>
                          <TableCell className="text-sm">{formatDate(row.date)}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {row.journal_no}
                          </TableCell>
                          <TableCell className="text-sm">{row.description}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">
                              {row.source.replace(/_/g, " ")}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {row.debit ? formatCentavos(row.debit) : ""}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {row.credit ? formatCentavos(row.credit) : ""}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm font-medium">
                            {formatCentavos(row.running_balance)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </DataState>
        )}
      </div>
    </RouteGuard>
  );
}
