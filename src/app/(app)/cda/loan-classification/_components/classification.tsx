"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { DataState } from "@/components/common/data-state";
import { TablePagination } from "@/components/common/table-pagination";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApiResource, usePermission } from "@/hooks";
import { cdaService } from "@/services";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CdaLoanClassificationPage } from "@/types/cda";
import { cdaCount, cdaMoney, cdaPercent } from "../../_lib/money";

function Kpi({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className={cn("text-xl tabular-nums", danger && "text-red-600 dark:text-red-400")}>{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

function Buckets({ body }: { body: CdaLoanClassificationPage }) {
  const d = body.data;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Classification as of {formatDate(d.as_of)}</CardTitle>
        <CardDescription>
          {d.captured_at ? `Captured at year end on ${formatDateTime(d.captured_at)}.` : "Not captured at year end yet."}{" "}
          {d.basis_note}
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Classification</TableHead>
              <TableHead>Days past due</TableHead>
              <TableHead className="text-right">Loans</TableHead>
              <TableHead className="text-right">Principal Balance</TableHead>
              <TableHead className="text-right">Required rate</TableHead>
              <TableHead className="text-right">Required allowance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {d.rows.map((r) => (
              <TableRow key={r.bucket}>
                <TableCell className="font-medium">{r.classification}</TableCell>
                <TableCell>{r.dpd_range}</TableCell>
                <TableCell className="text-right tabular-nums">{cdaCount(r.loan_count)}</TableCell>
                <TableCell className="text-right tabular-nums">{cdaMoney(r.outstanding_principal)}</TableCell>
                <TableCell className="text-right tabular-nums">{cdaPercent(r.required_rate)}</TableCell>
                <TableCell className="text-right tabular-nums">{cdaMoney(r.required_allowance)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={2}>Total</TableCell>
              <TableCell className="text-right tabular-nums">{cdaCount(d.total_loan_count)}</TableCell>
              <TableCell className="text-right tabular-nums">{cdaMoney(d.total_outstanding_principal)}</TableCell>
              <TableCell />
              <TableCell className="text-right tabular-nums">{cdaMoney(d.required_allowance)}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </CardContent>
    </Card>
  );
}

function Loans({ body, onPage }: { body: CdaLoanClassificationPage; onPage: (page: number, perPage: number) => void }) {
  const loans = body.data.loans ?? [];
  const meta = body.meta;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Loans</CardTitle>
        <CardDescription>Most days past due first.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Loan</TableHead>
              <TableHead>Member</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Classification</TableHead>
              <TableHead className="text-right">Days past due</TableHead>
              <TableHead className="text-right">Principal Balance</TableHead>
              <TableHead className="text-right">Outstanding</TableHead>
              <TableHead className="text-right">Past Due</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loans.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  No loans to list.
                </TableCell>
              </TableRow>
            ) : (
              loans.map((l) => (
                <TableRow key={l.loan_id}>
                  <TableCell>
                    <Link href={`/loans/${l.loan_id}`} className="font-medium hover:underline">
                      {l.account_number}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {l.member.name ?? "—"}
                    {l.member.code && <span className="block text-xs text-muted-foreground">{l.member.code}</span>}
                  </TableCell>
                  <TableCell>{l.branch?.name ?? "—"}</TableCell>
                  <TableCell>{l.classification}</TableCell>
                  <TableCell className="text-right tabular-nums">{cdaCount(l.days_past_due)}</TableCell>
                  <TableCell className="text-right tabular-nums">{cdaMoney(l.outstanding_principal)}</TableCell>
                  <TableCell className="text-right tabular-nums">{cdaMoney(l.total_outstanding)}</TableCell>
                  <TableCell className="text-right tabular-nums">{cdaMoney(l.past_due_amount)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {meta && (
          <TablePagination
            page={meta.current_page}
            perPage={meta.per_page}
            total={meta.total}
            perPageOptions={[25, 50, 100]}
            onPageChange={(page) => onPage(page, meta.per_page)}
            onPerPageChange={(perPage) => onPage(1, perPage)}
          />
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Loan classification and the provision gap, read only (CDA design §7): the
 * server's buckets, totals and gap, from the year-end capture when there is
 * one. Loan rows need `loans:view`; without it the server sends none and no
 * page is asked for.
 */
export function LoanClassification({ year }: { year: number }) {
  const { can } = usePermission();
  const loansVisible = can("loans:view");
  const [paging, setPaging] = useState({ page: 1, perPage: 25 });
  const fetcher = useCallback(
    () => cdaService.getLoanClassification(year, loansVisible ? { page: paging.page, per_page: paging.perPage } : {}),
    [year, paging, loansVisible],
  );
  const resource = useApiResource(fetcher);

  return (
    <DataState
      resource={resource}
      endpoints={[`GET ${API_ENDPOINTS.CDA.LOAN_CLASSIFICATION(year)}`]}
      summary={`Loan classification and the provision gap for ${year}`}
    >
      {(body) => {
        const d = body.data;
        return (
          <div className="space-y-4">
            {d.warning && (
              <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
                {d.warning}
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi label="Principal Balance" value={cdaMoney(d.total_outstanding_principal)} />
              <Kpi label="Required allowance" value={cdaMoney(d.required_allowance)} />
              <Kpi label="Allowance on the books (1200)" value={cdaMoney(d.existing_allowance)} />
              <Kpi label="Provision gap" value={cdaMoney(d.provision_gap)} danger={!d.provision_gap.startsWith("-") && d.provision_gap !== "0.00"} />
            </div>
            <Buckets body={body} />
            <p className="text-sm text-muted-foreground">
              Unpaid interest due: {cdaMoney(d.unpaid_interest_due)}. {d.memo_note}
            </p>
            {d.loans_visible && <Loans body={body} onPage={(page, perPage) => setPaging({ page, perPage })} />}
          </div>
        );
      }}
    </DataState>
  );
}
