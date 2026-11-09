"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RouteGuard, TablePagination } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
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
import { todayISO } from "@/lib/format";
import { formatValue } from "@/lib/report-format";
import { cn } from "@/lib/utils";
import type { GeneralLedgerPage as LedgerPage, JournalSource } from "@/types";
import { AccountingPageHeader } from "../_components/page-header";
import { DataState } from "../_components/data-state";
import { AccountSelect } from "../_components/account-select";
import { journalSourceLabel } from "../_lib/display-labels";
import { ANY_SOURCE, journalSourceItems } from "../_lib/select-items";
import { centavosOrDash } from "../_lib/dashboard-figures";
import { defaultDashboardFrom } from "../_lib/dashboard-period";
import {
  LEDGER_PER_PAGE_OPTIONS,
  ledgerQueryString,
  readLedgerQuery,
  type LedgerDefaults,
  type LedgerUrlState,
} from "../_lib/dashboard-ledger-query";
import {
  ALL_BRANCHES,
  BranchFilter,
  DateFilter,
  FilterBar,
  branchParam,
} from "../_components/accounting-filters";

function GeneralLedgerContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { postable } = useChartOfAccounts();
  const [branch, setBranch] = useState(ALL_BRANCHES);

  // This month to today, fixed for the visit, so a URL without dates means it.
  const [defaults] = useState<LedgerDefaults>(() => {
    const today = todayISO();
    return { from: defaultDashboardFrom(today), to: today };
  });

  // Account, dates, source and page live in the URL, so Cash & Bank can link
  // to an account's ledger and Back returns to the same page of it.
  const queryString = searchParams.toString();
  const query = useMemo(
    () => readLedgerQuery(new URLSearchParams(queryString), defaults),
    [queryString, defaults],
  );

  // Any change but the page itself starts again at page 1.
  const updateQuery = useCallback(
    (patch: Partial<LedgerUrlState>) => {
      const next = { ...query, page: 1, ...patch };
      const qs = ledgerQueryString(next, defaults);
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [query, defaults, router, pathname],
  );

  const { accountId, from, to, source, page, perPage } = query;
  const fetcher = useCallback(
    () =>
      accountingService.generalLedgerPage({
        account_id: accountId ?? undefined,
        from,
        to,
        branch_id: branchParam(branch),
        source: source === ANY_SOURCE ? undefined : (source as JournalSource),
        page,
        per_page: perPage,
      }),
    [accountId, from, to, branch, source, page, perPage],
  );

  // A ledger with no account chosen is every movement in the book, which is
  // not a ledger. Hold the request until one is picked.
  const resource = useAccountingResource<LedgerPage>(fetcher, accountId !== null);

  // Turning the page keeps the last page on screen, dimmed, until the next one
  // arrives. Any other filter change shows the loading panel instead, so rows
  // from another account or range are never left standing under new filters.
  const filterKey = [accountId, from, to, branch, source, perPage].join("|");
  const [shownKey, setShownKey] = useState(filterKey);
  if (
    !resource.loading &&
    resource.error === null &&
    resource.data !== null &&
    shownKey !== filterKey
  ) {
    setShownKey(filterKey);
  }
  const paging = resource.loading && resource.data !== null && shownKey === filterKey;
  const shownResource = paging ? { ...resource, loading: false } : resource;

  const account = postable.find((a) => a.id === accountId);

  return (
    <div className="space-y-6">
      <FilterBar>
        <AccountSelect
          label="Account"
          accounts={postable}
          value={accountId}
          onChange={(id) => updateQuery({ accountId: id })}
        />
        <DateFilter label="From" value={from} onChange={(value) => updateQuery({ from: value })} />
        <DateFilter label="To" value={to} onChange={(value) => updateQuery({ to: value })} />
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Source</Label>
          <Select
            value={source}
            onValueChange={(value) => updateQuery({ source: value ?? ANY_SOURCE })}
            items={journalSourceItems}
          >
            <SelectTrigger className="w-[190px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {journalSourceItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <BranchFilter
          value={branch}
          onChange={(value) => {
            setBranch(value);
            if (page !== 1) updateQuery({});
          }}
        />
      </FilterBar>

      {accountId === null ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Choose an account to see its ledger.
          </CardContent>
        </Card>
      ) : (
        <DataState
          resource={shownResource}
          summary="One account at a time, over a date range, with a running balance and a link back to the journal entry behind each line."
          endpoints={["GET /accounting/general-ledger"]}
        >
          {({ data: rows, meta }) => (
            <Card>
              <CardContent className="space-y-4 pt-6">
                {account && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm text-muted-foreground">
                      {account.code}
                    </span>
                    <span className="font-medium">{account.name}</span>
                    <Badge variant="outline" className="capitalize">
                      {account.normal_balance}-normal
                    </Badge>
                  </div>
                )}

                <dl className="grid gap-3 rounded-lg border bg-muted/30 p-4 sm:grid-cols-2 lg:grid-cols-4">
                  <LedgerFigure
                    label={`Opening balance, before ${formatValue(from, "date")}`}
                    value={meta.opening_balance}
                  />
                  <LedgerFigure label="Total debit" value={meta.total_debit} />
                  <LedgerFigure label="Total credit" value={meta.total_credit} />
                  <LedgerFigure
                    label={`Closing balance, at ${formatValue(to, "date")}`}
                    value={meta.closing_balance}
                  />
                </dl>
                {source !== ANY_SOURCE && (
                  <p className="text-xs text-muted-foreground">
                    Showing {journalSourceLabel(source)} entries only. The opening and closing
                    balances and each row&apos;s balance cover every source; the totals cover
                    every {journalSourceLabel(source)} entry in the range.
                  </p>
                )}

                <div
                  className={cn("overflow-x-auto transition-opacity", paging && "opacity-60")}
                  aria-busy={paging}
                >
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
                      {rows.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={7}
                            className="py-10 text-center text-sm text-muted-foreground"
                          >
                            {meta.total > 0
                              ? "This page is past the last entry."
                              : "No movement through this account in the chosen range."}
                          </TableCell>
                        </TableRow>
                      ) : (
                        rows.map((row, i) => (
                          <TableRow key={`${row.journal_id}-${i}`}>
                            <TableCell className="text-sm">{formatValue(row.date, "date")}</TableCell>
                            <TableCell className="font-mono text-xs">{row.journal_no}</TableCell>
                            <TableCell className="text-sm">{row.description}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[10px]">
                                {journalSourceLabel(row.source)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {row.debit ? formatCentavos(row.debit) : ""}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {row.credit ? formatCentavos(row.credit) : ""}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm font-medium">
                              {centavosOrDash(row.running_balance)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                <TablePagination
                  page={page}
                  perPage={perPage}
                  total={meta.total}
                  perPageOptions={LEDGER_PER_PAGE_OPTIONS}
                  onPageChange={(next) => updateQuery({ page: next })}
                  onPerPageChange={(next) => updateQuery({ perPage: next })}
                />
              </CardContent>
            </Card>
          )}
        </DataState>
      )}
    </div>
  );
}

function LedgerFigure({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-mono text-lg font-semibold tabular-nums">{centavosOrDash(value)}</dd>
    </div>
  );
}

export default function GeneralLedgerPage() {
  return (
    <RouteGuard permission="accounting:view" pageName="General Ledger">
      <div className="space-y-6">
        <AccountingPageHeader
          title="General Ledger"
          description="Every movement through a single account."
        />
        <Suspense
          fallback={
            <div className="flex justify-center py-12">
              <Spinner className="h-6 w-6" />
            </div>
          }
        >
          <GeneralLedgerContent />
        </Suspense>
      </div>
    </RouteGuard>
  );
}
