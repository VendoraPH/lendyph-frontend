"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { ALL_BRANCHES, branchIdParam } from "@/components/common/branch-filter";
import { AlignedBranchFilter } from "../../_components/aligned-branch-filter";
import { DataState } from "@/components/common/data-state";
import { ScrollBox } from "@/components/common/page-fill";
import { TablePagination } from "@/components/common/table-pagination";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApiResource } from "@/hooks";
import { formatCurrency, formatDate } from "@/lib/format";
import { FIT_CLASSES } from "@/lib/page-fill";
import { cn } from "@/lib/utils";
import { savingsInterestService } from "@/services";
import type { InterestRun } from "@/types";
import { OptionSelect, type Option } from "../../_components/option-select";
import { RUN_STATUS_TABS } from "../_lib/run-rules";
import { RunStatusBadge } from "./run-status-badge";
import { useBranchFilter, useBranchFollowingPage } from "@/hooks/use-working-branch";

const ALL_PRODUCTS = "all";

function RunsTable({ runs }: { runs: InterestRun[] }) {
  return (
    <div className={cn("rounded-lg border bg-card", FIT_CLASSES.section)}>
      <ScrollBox>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Period</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead className="text-right">Accounts in run</TableHead>
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
                <TableCell>{run.product_name ?? run.product?.name ?? "—"}</TableCell>
                <TableCell>{run.branch_name ?? run.branch?.name ?? "—"}</TableCell>
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
      </ScrollBox>
    </div>
  );
}

/** Saved interest runs, newest first, by status, product and branch. */
export function RunsList({ productOptions }: { productOptions: readonly Option[] }) {
  const [status, setStatus] = useState("all");
  const [product, setProduct] = useState(ALL_PRODUCTS);
  const [branch, setBranch] = useBranchFilter();
  const [page, setPage] = useBranchFollowingPage();
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
    <section className={cn(FIT_CLASSES.section, "gap-4")} aria-labelledby="interest-runs-heading">
      <h2 id="interest-runs-heading" className="shrink-0 text-lg font-semibold">
        Interest runs
      </h2>
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-3">
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
          <div className="flex flex-col gap-1.5">
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
          <AlignedBranchFilter
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
        emptyIllustration={
          status !== "all" || product !== ALL_PRODUCTS || branch !== ALL_BRANCHES ? "noResults" : "emptySavings"
        }
      >
        {(res) => (
          <div className={FIT_CLASSES.section}>
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
