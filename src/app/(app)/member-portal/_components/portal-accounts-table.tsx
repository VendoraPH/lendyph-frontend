"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { DataState } from "@/components/common/data-state";
import { TablePagination } from "@/components/common/table-pagination";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { portalAdminService } from "@/services/portal-admin.service";
import type { PortalAccessState } from "@/types/portal-admin";
import { OptionSelect } from "../../savings/_components/option-select";
import { usePortalResource } from "../_hooks/use-portal-resource";
import { ACCESS_STATE_LABELS, ACCESS_STATE_TONES, MEMBER_STATUS_LABELS, labelOf, optionsOf, toneOf } from "../_lib/labels";
import { StateBadge } from "./state-badge";

const STATE_OPTIONS = [{ value: "all", label: "Every state" }, ...optionsOf(ACCESS_STATE_LABELS)];

/**
 * Members with their portal state, paged by the server. Contact details are
 * the server's: null without `borrowers:view`. Adapted from #511 by Augustin.
 */
export function PortalAccountsTable({ branchId }: { branchId: number | undefined }) {
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [state, setState] = useState("all");

  const fetcher = useCallback(
    () =>
      portalAdminService.accounts({
        page,
        per_page: perPage,
        search: search || undefined,
        status: state === "all" ? undefined : (state as PortalAccessState),
        branch_id: branchId,
      }),
    [page, perPage, search, state, branchId],
  );
  const resource = usePortalResource(fetcher);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <form
          className="relative min-w-56 flex-1"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(draft.trim());
            setPage(1);
          }}
        >
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
          <Input
            aria-label="Search members"
            placeholder="Search a name or member number, then press Enter"
            className="pl-8"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
        </form>
        <OptionSelect
          value={state}
          onChange={(v) => {
            setState(v);
            setPage(1);
          }}
          options={STATE_OPTIONS}
          className="w-48"
        />
      </div>

      <DataState
        resource={resource}
        endpoints={[]}
        summary="Members and their portal state."
        isEmpty={(res) => res.data.length === 0}
        emptyMessage="No members match these filters."
      >
        {(res) => (
          <div className="space-y-3">
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead className="hidden md:table-cell">Branch</TableHead>
                    <TableHead>Portal</TableHead>
                    <TableHead className="hidden md:table-cell">Last sign-in</TableHead>
                    <TableHead className="hidden lg:table-cell">Contact</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {res.data.map((r) => (
                    <TableRow key={r.borrower_id}>
                      <TableCell>
                        <Link href={`/borrowers/${r.borrower_id}`} className="font-medium hover:underline">
                          {r.full_name}
                        </Link>
                        <span className="block text-xs text-muted-foreground">
                          {r.member_number} · {labelOf(MEMBER_STATUS_LABELS, r.member_status)}
                        </span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{r.branch?.name ?? "—"}</TableCell>
                      <TableCell>
                        <StateBadge
                          label={labelOf(ACCESS_STATE_LABELS, r.state)}
                          tone={toneOf(ACCESS_STATE_TONES, r.state)}
                        />
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {r.last_login_at ? formatDateTime(r.last_login_at) : "—"}
                      </TableCell>
                      <TableCell className="hidden text-xs lg:table-cell">
                        {[r.contact_number, r.email].filter(Boolean).join(" · ") || "—"}
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
              perPageOptions={[25, 50, 100]}
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
