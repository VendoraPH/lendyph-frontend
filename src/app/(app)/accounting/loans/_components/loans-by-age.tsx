"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, RefreshCw, Search } from "lucide-react";
import { TablePagination } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAccountingResource } from "@/hooks";
import { SEARCH_DEBOUNCE_MS } from "@/hooks/use-search-page";
import { cn } from "@/lib/utils";
import { accountingService, type LoanAccountingLoansQuery } from "@/services/accounting.service";
import type { LoanAgingPage, LoanAgingRow, MemberAgingRow } from "@/types";
import { agingGroupItems } from "../../_lib/select-items";
import { DataState } from "../../_components/data-state";
import {
  ANY_BUCKET,
  LOAN_ACCOUNTING_PAGE_SIZE,
  bucketFilterItems,
  groupFromValue,
  loanAccountingKey,
  loanAccountingQuery,
} from "../_lib/loan-accounting-view";
import { LoanRowsTable, MemberRowsTable } from "./loans-by-age-table";

/** One answer, tagged with the request it answers and how its rows are grouped. */
type LoansAnswer =
  | { key: string; group: "loan"; page: LoanAgingPage<LoanAgingRow> }
  | { key: string; group: "member"; page: LoanAgingPage<MemberAgingRow> };

function fetchLoans(key: string, query: LoanAccountingLoansQuery): Promise<LoansAnswer> {
  if (query.group === "member") {
    return accountingService
      .loanAccountingLoans<"member">({ ...query, group: "member" })
      .then((page) => ({ key, group: "member", page }));
  }
  return accountingService
    .loanAccountingLoans<"loan">({ ...query, group: "loan" })
    .then((page) => ({ key, group: "loan", page }));
}

interface LoansByAgeProps {
  asOf: string;
  branchId?: number;
}

/** The loans (or members) behind the aging, paged and filtered on the server. */
export function LoansByAge({ asOf, branchId }: LoansByAgeProps) {
  const [bucket, setBucket] = useState(ANY_BUCKET);
  const [pastDueOnly, setPastDueOnly] = useState(true);
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState<"loan" | "member">("loan");
  const [page, setPage] = useState(1);

  // A new date or branch starts again from the first page.
  const [scope, setScope] = useState({ asOf, branchId });
  if (scope.asOf !== asOf || scope.branchId !== branchId) {
    setScope({ asOf, branchId });
    setPage(1);
  }

  const query = useMemo(
    () => loanAccountingQuery({ asOf, branchId, bucket, pastDueOnly, search, group, page }),
    [asOf, branchId, bucket, pastDueOnly, search, group, page],
  );
  const key = loanAccountingKey(query);

  // One request per settled change, so typing in the search asks once.
  const [request, setRequest] = useState(() => ({ key, query }));
  useEffect(() => {
    const t = setTimeout(
      () => setRequest((prev) => (prev.key === key ? prev : { key, query })),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(t);
  }, [key, query]);

  const fetcher = useCallback(() => fetchLoans(request.key, request.query), [request]);
  const resource = useAccountingResource<LoansAnswer>(fetcher);
  const answer = resource.data;
  const settled = !resource.loading && answer?.key === key;
  const totals = settled ? answer.page.meta.totals : null;
  const stats = settled ? answer.page.meta.stats : null;

  const changeFilter =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      set(value);
      setPage(1);
    };
  const bucketItems = bucketFilterItems(stats);

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Loans past due
          </h2>
          <p className="text-xs text-muted-foreground">
            Days past due, the bucket and Past Due follow the &quot;As of&quot; date. Principal
            Balance and Outstanding read today&apos;s payments, and the status is today&apos;s,
            because loan records keep no history. A loan can sit in a bucket and still be within
            its grace period; &quot;Past due only&quot; keeps the loans past grace.
          </p>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="loan-accounting-search" className="text-xs text-muted-foreground">
              Search
            </Label>
            <div className="relative">
              <Search
                aria-hidden="true"
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id="loan-accounting-search"
                type="search"
                placeholder="Loan account, member name or code"
                value={search}
                onChange={(e) => changeFilter(setSearch)(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Bucket</Label>
            <Select
              value={bucket}
              onValueChange={(v) => changeFilter(setBucket)(v ?? ANY_BUCKET)}
              items={bucketItems}
            >
              <SelectTrigger className="w-[190px]" aria-label="Bucket">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {bucketItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Show</Label>
            <Select
              value={group}
              onValueChange={(v) => changeFilter(setGroup)(groupFromValue(v))}
              items={agingGroupItems}
            >
              <SelectTrigger className="w-[150px]" aria-label="Group rows">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {agingGroupItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <label className="flex h-9 items-center gap-2 text-sm">
            <Switch
              checked={pastDueOnly}
              onCheckedChange={(checked) => changeFilter(setPastDueOnly)(checked)}
            />
            Past due only
          </label>
        </div>

        {answer === null ? (
          <DataState
            resource={resource}
            summary="Each loan behind the aging, with its bucket, days past due and balances."
            endpoints={["GET /accounting/loan-accounting/loans"]}
          >
            {() => null}
          </DataState>
        ) : (
          <>
            {resource.error && (
              <div
                role="alert"
                className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm"
              >
                <span className="flex items-center gap-2 text-destructive">
                  <AlertCircle aria-hidden="true" className="h-4 w-4" />
                  {resource.error}
                </span>
                <Button variant="outline" size="sm" onClick={resource.refetch}>
                  <RefreshCw aria-hidden="true" className="mr-2 h-4 w-4" />
                  Try again
                </Button>
              </div>
            )}
            <div aria-busy={!settled} className={cn("overflow-x-auto", !settled && "opacity-60")}>
              {answer.group === "member" ? (
                <MemberRowsTable rows={answer.page.data} totals={totals} />
              ) : (
                <LoanRowsTable rows={answer.page.data} totals={totals} />
              )}
              {settled && answer.page.data.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No loans match these filters.
                </p>
              )}
            </div>
            {answer.page.data.length > 0 && (
              <TablePagination
                page={page}
                perPage={LOAN_ACCOUNTING_PAGE_SIZE}
                total={answer.page.meta.total}
                perPageOptions={[LOAN_ACCOUNTING_PAGE_SIZE]}
                onPageChange={setPage}
                onPerPageChange={() => setPage(1)}
              />
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
