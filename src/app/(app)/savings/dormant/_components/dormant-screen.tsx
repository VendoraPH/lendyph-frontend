"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { ALL_BRANCHES, BranchFilter, branchIdParam } from "@/components/common/branch-filter";
import { DataState } from "@/components/common/data-state";
import { TablePagination } from "@/components/common/table-pagination";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApiResource } from "@/hooks";
import { formatCurrency, formatDate } from "@/lib/format";
import { savingsService } from "@/services";
import type { ApproachingDormancyRow, DormancyList, DormantAccountRow } from "@/types/savings-servicing";
import { Kpi } from "../../_components/kpi";
import { DORMANCY_TABS, approachingNote, daysLeftText, dormancyCards } from "../_lib/dormant-view";
import { DormantActions } from "./dormant-actions";

type Row = DormantAccountRow | ApproachingDormancyRow;

function isApproaching(row: Row): row is ApproachingDormancyRow {
  return "dormant_on" in row;
}

/**
 * Dormant savings accounts and the ones approaching dormancy (backend S4),
 * with the month's reactivations. Every figure and date is the server's.
 */
export function DormantScreen() {
  const [list, setList] = useState<DormancyList>("dormant");
  const [branch, setBranch] = useState(ALL_BRANCHES);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);

  const fetcher = useCallback(
    () => savingsService.dormancyList<Row>({ list, page, per_page: perPage, branch_id: branchIdParam(branch) }),
    [list, page, perPage, branch],
  );
  const resource = useApiResource(fetcher);
  const meta = resource.data?.meta;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dormant Accounts</h1>
        <p className="text-sm text-muted-foreground">
          Accounts without member activity, and the ones about to turn dormant. A deposit or an approved reactivation
          makes an account active again.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {dormancyCards(meta?.totals).map((c) => (
          <Kpi key={c.label} label={c.label} value={c.value} />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={list}
          onValueChange={(v) => {
            setList(v as DormancyList);
            setPage(1);
          }}
        >
          <TabsList>
            {DORMANCY_TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <BranchFilter
          value={branch}
          onChange={(v) => {
            setBranch(v);
            setPage(1);
          }}
          className="sm:w-56"
        />
      </div>
      {list === "approaching" && (
        <p className="text-sm text-muted-foreground">{approachingNote(meta?.dormancy_warning_days)}</p>
      )}

      <DataState
        resource={resource}
        endpoints={["GET /reports/savings/dormant"]}
        summary="Dormant savings accounts and those approaching dormancy will be listed here once the savings service is connected."
        isEmpty={(res) => res.data.length === 0}
        emptyMessage={list === "dormant" ? "No dormant savings accounts." : "No account is approaching dormancy."}
      >
        {(res) => (
          <div className="space-y-3">
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account no.</TableHead>
                    <TableHead>Member</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Last activity</TableHead>
                    <TableHead>{list === "dormant" ? "Dormant since" : "Turns dormant on"}</TableHead>
                    <TableHead className="w-0">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {res.data.map((r) => (
                    <TableRow key={r.account_id}>
                      <TableCell className="font-medium">
                        <Link href={`/savings/accounts/${r.account_id}`} className="hover:underline">
                          {r.account_number}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {r.borrower_name ?? "—"}
                        {r.borrower_code && <span className="block text-xs text-muted-foreground">{r.borrower_code}</span>}
                      </TableCell>
                      <TableCell>{r.product_name ?? "—"}</TableCell>
                      <TableCell>{r.branch_name ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(r.balance)}</TableCell>
                      <TableCell>{r.last_member_activity_on ? formatDate(r.last_member_activity_on) : "—"}</TableCell>
                      <TableCell>
                        {isApproaching(r) ? (
                          <>
                            {formatDate(r.dormant_on)}
                            <Badge variant="outline" className="ml-2">
                              {daysLeftText(r.days_left)}
                            </Badge>
                          </>
                        ) : r.dormant_since ? (
                          formatDate(r.dormant_since)
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <DormantActions
                          accountId={r.account_id}
                          accountNumber={r.account_number}
                          dormant={r.status === "dormant"}
                          onChanged={() => resource.refetch()}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <TablePagination
              page={page}
              perPage={perPage}
              total={res.meta.total}
              onPageChange={setPage}
              onPerPageChange={(n) => {
                setPerPage(n);
                setPage(1);
              }}
            />
          </div>
        )}
      </DataState>
    </div>
  );
}
