"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { BranchFilter, ALL_BRANCHES, branchIdParam } from "@/components/common/branch-filter";
import { DataState } from "@/components/common/data-state";
import { TablePagination } from "@/components/common/table-pagination";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { portalAdminService } from "@/services/portal-admin.service";
import type { PortalRequestStatus, PortalRequestType } from "@/types/portal-admin";
import { OptionSelect } from "../../../savings/_components/option-select";
import { usePortalResource } from "../../_hooks/use-portal-resource";
import {
  REQUEST_STATUSES,
  REQUEST_STATUS_LABELS,
  REQUEST_STATUS_TONES,
  REQUEST_TYPE_LABELS,
  labelOf,
  optionsOf,
  toneOf,
} from "../../_lib/labels";
import { StateBadge } from "../../_components/state-badge";

const TYPE_OPTIONS = [{ value: "all", label: "Every request type" }, ...optionsOf(REQUEST_TYPE_LABELS)];
const PER_PAGE = 25;

/**
 * The members' requests queue, for the caller's branches, newest first. The
 * tab counts are the server's `meta.counts` (the other filters applied).
 * Adapted from #513 by Augustin (member requests table).
 */
export function RequestsScreen() {
  const [status, setStatus] = useState<PortalRequestStatus>("submitted");
  const [type, setType] = useState("all");
  const [branch, setBranch] = useState(ALL_BRANCHES);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const fetcher = useCallback(
    () =>
      portalAdminService.requests({
        page,
        status,
        type: type === "all" ? undefined : (type as PortalRequestType),
        branch_id: branchIdParam(branch),
        search: search || undefined,
      }),
    [page, status, type, branch, search],
  );
  const resource = usePortalResource(fetcher);
  const counts = resource.data?.meta.counts;
  const reset = () => setPage(1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Portal Requests</h1>
        <p className="text-sm text-muted-foreground">
          Profile changes, savings withdrawals and new savings accounts members asked for in the portal. Nothing changes
          until a request is approved; a withdrawal&apos;s money is held from the moment it is sent.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <form
          className="relative min-w-56 flex-1"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(draft.trim());
            reset();
          }}
        >
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
          <Input
            aria-label="Search requests"
            placeholder="Search a reference, member name or number, then press Enter"
            className="pl-8"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
        </form>
        <OptionSelect
          value={type}
          onChange={(v) => {
            setType(v);
            reset();
          }}
          options={TYPE_OPTIONS}
          className="w-56"
        />
        <BranchFilter
          value={branch}
          onChange={(v) => {
            setBranch(v);
            reset();
          }}
          className="w-56"
        />
      </div>

      <div className="overflow-x-auto">
        <Tabs
          value={status}
          onValueChange={(v) => {
            setStatus(v as PortalRequestStatus);
            reset();
          }}
        >
          <TabsList>
            {REQUEST_STATUSES.map((s) => (
              <TabsTrigger key={s} value={s}>
                {REQUEST_STATUS_LABELS[s]}
                {counts && <span className="ml-1 text-xs text-muted-foreground tabular-nums">{counts[s] ?? 0}</span>}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <DataState
        resource={resource}
        endpoints={[]}
        summary="Members' portal requests."
        isEmpty={(res) => res.data.length === 0}
        emptyMessage={status === "submitted" ? "No new requests." : "No requests here."}
      >
        {(res) => (
          <div className="space-y-3">
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sent</TableHead>
                    <TableHead>Request</TableHead>
                    <TableHead>Member</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {res.data.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap">
                        {r.created_at ? formatDateTime(r.created_at) : "—"}
                        {r.expires_on && (
                          <span className="block text-xs text-muted-foreground">Expires {formatDate(r.expires_on)}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Link href={`/member-portal/requests/${r.id}`} className="font-medium hover:underline">
                          {labelOf(REQUEST_TYPE_LABELS, r.type)}
                        </Link>
                        <span className="block font-mono text-xs text-muted-foreground">{r.reference}</span>
                        <span className="block max-w-80 truncate text-xs text-muted-foreground">{r.summary}</span>
                      </TableCell>
                      <TableCell>
                        {r.member?.name ?? "—"}
                        <span className="block text-xs text-muted-foreground">
                          {[r.member?.member_number, r.branch?.name].filter(Boolean).join(" · ")}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.amount === null ? "—" : formatCurrency(r.amount)}
                      </TableCell>
                      <TableCell>
                        <StateBadge
                          label={labelOf(REQUEST_STATUS_LABELS, r.status)}
                          tone={toneOf(REQUEST_STATUS_TONES, r.status)}
                        />
                        {r.decided_by && (
                          <span className="block text-xs text-muted-foreground">
                            {r.decided_by.name}
                            {r.decided_at ? `, ${formatDate(r.decided_at)}` : ""}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <TablePagination
              page={page}
              perPage={PER_PAGE}
              total={res.meta.total}
              perPageOptions={[PER_PAGE]}
              onPageChange={setPage}
              onPerPageChange={reset}
            />
          </div>
        )}
      </DataState>
    </div>
  );
}
