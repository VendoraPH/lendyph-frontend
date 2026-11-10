"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { DataState } from "@/components/common/data-state";
import { PermissionButton } from "@/components/common/permission-button";
import { TablePagination } from "@/components/common/table-pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApiResource } from "@/hooks";
import { formatCurrency, formatDate, formatRate, todayISO } from "@/lib/format";
import { timeDepositService } from "@/services";
import { Kpi } from "../../_components/kpi";
import { maturityHint, pendingApprovalText, tdStatusTabs, termLabel } from "../../_lib/time-deposit-rules";
import { PlaceTimeDepositDialog } from "./place-time-deposit-dialog";
import { TdStatusBadge } from "./td-status-badge";

export function TimeDepositsScreen() {
  const router = useRouter();
  const [status, setStatus] = useState("all");
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [placing, setPlacing] = useState(false);

  const fetcher = useCallback(
    () =>
      timeDepositService.list({
        page,
        per_page: perPage,
        search: search || undefined,
        status: status === "all" ? undefined : status,
      }),
    [page, perPage, search, status],
  );
  const resource = useApiResource(fetcher);
  const meta = resource.data?.meta;
  const tabs = tdStatusTabs(meta?.stats);
  const today = todayISO();
  const filtered = Boolean(search) || status !== "all";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Time Deposits</h1>
          <p className="text-sm text-muted-foreground">
            Fixed-term placements: maturity, rollovers and pre-terminations.
          </p>
        </div>
        <PermissionButton permission="savings:create" onClick={() => setPlacing(true)}>
          <Plus className="h-4 w-4" /> Place time deposit
        </PermissionButton>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi label="Active placements" value={meta ? String(meta.stats?.active ?? 0) : "—"} />
        <Kpi
          label={filtered ? "Principal (matching)" : "Total principal"}
          value={meta?.totals ? formatCurrency(meta.totals.total_principal) : "—"}
        />
        <Kpi label="Maturing in 30 days" value={meta?.totals ? String(meta.totals.maturing_30_days) : "—"} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={status}
          onValueChange={(v) => {
            setStatus(String(v));
            setPage(1);
          }}
        >
          <TabsList className="flex-wrap">
            {tabs.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
                {meta && t.count !== null && <span className="ml-1 text-xs text-muted-foreground">{t.count}</span>}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <form
          className="flex w-full gap-2 sm:w-auto"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(searchDraft.trim());
            setPage(1);
          }}
        >
          <Input
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            placeholder="Certificate no., member name or code"
            aria-label="Search time deposits"
            className="sm:w-72"
          />
          <Button type="submit" variant="outline" size="icon" aria-label="Search">
            <Search className="h-4 w-4" />
          </Button>
        </form>
      </div>

      <DataState
        resource={resource}
        endpoints={["GET /savings/time-deposits"]}
        summary="Time deposit placements will be listed here, with their maturity dates, once the savings service is connected."
        isEmpty={(res) => res.data.length === 0}
        emptyMessage={search ? "No placement matches this search." : "No time deposits yet."}
      >
        {(res) => (
          <div className="space-y-3">
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Certificate no.</TableHead>
                    <TableHead>Member</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Principal</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead>Term</TableHead>
                    <TableHead>Maturity</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {res.data.map((td) => {
                    const hint = maturityHint(td, today);
                    return (
                      <TableRow
                        key={td.id}
                        className="cursor-pointer"
                        onClick={() => router.push(`/savings/time-deposits/${td.id}`)}
                      >
                        <TableCell className="font-medium">
                          <Link href={`/savings/time-deposits/${td.id}`} onClick={(e) => e.stopPropagation()}>
                            {td.certificate_number}
                          </Link>
                        </TableCell>
                        <TableCell>
                          {td.borrower_name ?? "—"}
                          {td.borrower_code && (
                            <span className="block text-xs text-muted-foreground">{td.borrower_code}</span>
                          )}
                        </TableCell>
                        <TableCell>{td.product.name}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(td.principal)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatRate(td.annual_rate)}%</TableCell>
                        <TableCell>{termLabel(td.term_days)}</TableCell>
                        <TableCell>
                          {formatDate(td.maturity_date)}
                          {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
                        </TableCell>
                        <TableCell>
                          <TdStatusBadge status={td.status} />
                          {pendingApprovalText(td) && (
                            <span className="block text-xs text-amber-700 dark:text-amber-400">{pendingApprovalText(td)}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
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

      <PlaceTimeDepositDialog
        open={placing}
        onOpenChange={setPlacing}
        onPlaced={(td) => router.push(`/savings/time-deposits/${td.id}`)}
      />
    </div>
  );
}
