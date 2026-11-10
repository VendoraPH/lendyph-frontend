"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { ALL_BRANCHES, BranchFilter, branchIdParam } from "@/components/common/branch-filter";
import { DataState } from "@/components/common/data-state";
import { TablePagination } from "@/components/common/table-pagination";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApiResource } from "@/hooks";
import { formatCurrency, formatDate } from "@/lib/format";
import { savingsInterestService } from "@/services";
import type { InterestRun } from "@/types";
import { OptionSelect, type Option } from "../../_components/option-select";
import { RUN_STATUS_TABS } from "../_lib/run-rules";
import { RunStatusBadge } from "./run-status-badge";

const ALL_PRODUCTS = "all";

function RunsTable({ runs }: { runs: InterestRun[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Period</TableHead>
            <TableHead>Product</TableHead>
            <TableHead>Branch</TableHead>
            <TableHead className="text-right">Accounts</TableHead>
            <TableHead className="text-right">Gross interest</TableHead>
            <TableHead className="text-right">Net interest</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {runs.map((run) => (
            <TableRow key={run.id}>
              <TableCell className="whitespace-nowrap font-medium">
                <Link href={`/savings/interest/${run.id}`} className="underline-offset-2 hover:underline">
                  {formatDate(run.period_start)} to {formatDate(run.period_end)}
                </Link>
              </TableCell>
              <TableCell>{run.product?.name ?? "—"}</TableCell>
              <TableCell>{run.branch?.name ?? "—"}</TableCell>
              <TableCell className="text-right tabular-nums">{run.account_count}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(run.total_gross)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(run.total_net)}</TableCell>
              <TableCell>
                <RunStatusBadge status={run.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** Saved interest runs, newest first, by status, product and branch. */
export function RunsList({ productOptions }: { productOptions: readonly Option[] }) {
  const [status, setStatus] = useState("all");
  const [product, setProduct] = useState(ALL_PRODUCTS);
  const [branch, setBranch] = useState(ALL_BRANCHES);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);

  const fetcher = useCallback(
    () =>
      savingsInterestService.list({
        page,
        per_page: perPage,
        status: status === "all" ? undefined : status,
        product_id: product === ALL_PRODUCTS ? undefined : Number(product),
        branch_id: branchIdParam(branch),
      }),
    [page, perPage, status, product, branch],
  );
  const resource = useApiResource(fetcher);

  return (
    <section className="space-y-4" aria-labelledby="interest-runs-heading">
      <h2 id="interest-runs-heading" className="text-lg font-semibold">
        Interest runs
      </h2>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Tabs
          value={status}
          onValueChange={(v) => {
            setStatus(String(v));
            setPage(1);
          }}
        >
          <TabsList className="flex-wrap">
            {RUN_STATUS_TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="runs-product" className="text-xs text-muted-foreground">
              Product
            </Label>
            <OptionSelect
              id="runs-product"
              value={product}
              onChange={(v) => {
                setProduct(v);
                setPage(1);
              }}
              options={[{ value: ALL_PRODUCTS, label: "All products" }, ...productOptions]}
              className="w-[200px]"
            />
          </div>
          <BranchFilter
            value={branch}
            onChange={(v) => {
              setBranch(v);
              setPage(1);
            }}
          />
        </div>
      </div>

      <DataState
        resource={resource}
        endpoints={["GET /savings/interest-runs"]}
        summary="Interest runs with their period, product, branch, totals and status."
        isEmpty={(res) => res.data.length === 0}
        emptyMessage="No interest runs match these filters."
      >
        {(res) => (
          <div className="space-y-3">
            <RunsTable runs={res.data} />
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
    </section>
  );
}
