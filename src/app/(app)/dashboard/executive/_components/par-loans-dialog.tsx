"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { TablePagination } from "@/components/common/table-pagination";
import { useApiResource } from "@/hooks/use-api-resource";
import { formatCurrency } from "@/lib/format";
import { executiveDashboardService, PAR_LOANS_PER_PAGE } from "@/services/executive-dashboard.service";
import type { ExecutiveQuery, ParLevel } from "@/types/executive-dashboard";
import { parLoanRows } from "../../_lib/executive-overview";

const PAR_ITEMS: { value: ParLevel; label: string }[] = [
  { value: "1", label: "PAR 1 (1 day or more)" },
  { value: "30", label: "PAR 30 (more than 30 days)" },
  { value: "60", label: "PAR 60 (more than 60 days)" },
  { value: "90", label: "PAR 90 (more than 90 days)" },
];

const COLUMNS = ["Loan", "Member", "Branch", "Product", "Oldest unpaid due", "Days past due", "Principal Balance", "Past Due", "Outstanding"];

/**
 * The loans behind the PAR card (`GET /dashboard/executive/par-loans`),
 * paged on the server, most days late first, each member by name and code
 * only. Needs reports:view and loans:view; the page offers it only then.
 */
export function ParLoansDialog({ open, onOpenChange, query }: { open: boolean; onOpenChange: (open: boolean) => void; query: ExecutiveQuery }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl" className="flex flex-col">
        <DialogHeader>
          <DialogTitle>Loans at risk</DialogTitle>
          <DialogDescription>The Portfolio Summary&apos;s own PAR loans, as of today, most days late first.</DialogDescription>
        </DialogHeader>
        {open && <ParLoansBody query={query} />}
      </DialogContent>
    </Dialog>
  );
}

function ParLoansBody({ query }: { query: ExecutiveQuery }) {
  const [par, setPar] = useState<ParLevel>("30");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(PAR_LOANS_PER_PAGE);
  // A new fetcher per page, level or filter is what asks the server again.
  const fetcher = useCallback(
    () => executiveDashboardService.parLoans(query, { par, page, perPage }),
    [query, par, page, perPage],
  );
  const resource = useApiResource(fetcher);
  const rows = resource.data ? parLoanRows(resource.data) : [];
  const meta = resource.data?.meta;

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="par-level" className="text-xs text-muted-foreground">
            Days past due
          </Label>
          <Select
            value={par}
            onValueChange={(v) => {
              if (!v) return;
              setPar(v as ParLevel);
              setPage(1);
            }}
            items={PAR_ITEMS}
          >
            <SelectTrigger id="par-level" className="w-[230px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAR_ITEMS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {meta && (
          <p className="text-sm text-muted-foreground" role="status">
            {meta.totals.loans} {meta.totals.loans === 1 ? "loan" : "loans"}, {formatCurrency(meta.totals.outstanding_principal)} unpaid principal
          </p>
        )}
      </div>

      <div className="min-h-0 overflow-auto rounded-lg border">
        {resource.loading ? (
          <Skeleton className="h-40 w-full" />
        ) : resource.error || resource.unavailable ? (
          <p className="p-6 text-center text-sm text-muted-foreground" role="alert">
            We couldn&apos;t load the loans at risk. Please try again.
          </p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">No loans at risk at this level.</p>
        ) : (
          <table className="w-full min-w-[960px] text-sm">
            <caption className="sr-only">Loans at risk</caption>
            <thead className="sticky top-0 bg-popover text-xs text-muted-foreground">
              <tr className="border-b">
                {COLUMNS.map((c, i) => (
                  <th key={c} scope="col" className={`px-3 py-2 font-medium ${i >= 5 ? "text-right" : "text-left"}`}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-b last:border-0">
                  <th scope="row" className="px-3 py-1.5 text-left font-normal">
                    <Link href={r.href} className="text-brand-orange hover:underline">
                      {r.account}
                    </Link>
                  </th>
                  <td className="px-3 py-1.5">{r.member}</td>
                  <td className="px-3 py-1.5">{r.branch}</td>
                  <td className="px-3 py-1.5">{r.product}</td>
                  <td className="px-3 py-1.5">{r.oldestDue}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{r.daysPastDue}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{r.principal}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{r.pastDue}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{r.outstanding}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {meta && meta.total > 0 && (
        <TablePagination
          page={meta.current_page}
          perPage={perPage}
          total={meta.total}
          perPageOptions={[25, 50, 100]}
          onPageChange={setPage}
          onPerPageChange={(next) => {
            setPerPage(next);
            setPage(1);
          }}
        />
      )}
    </div>
  );
}
