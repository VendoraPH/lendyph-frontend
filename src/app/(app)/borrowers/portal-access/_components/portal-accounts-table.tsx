"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { TablePagination } from "@/components/common";
import { PermissionButton } from "@/components/common/permission-button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApiResource } from "@/hooks/use-api-resource";
import { formatDateTime } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/notify";
import { ACCOUNT_STATUS, TONE_CLASS } from "@/lib/portal/labels";
import { portalAdminService } from "@/services/portal-admin.service";
import type { PortalAccountStatus } from "@/types/portal";

/** Server-paged member list with portal status, filters and bulk invite. */
export function PortalAccountsTable({ onChanged }: { onChanged: () => void }) {
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<PortalAccountStatus | "">("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [inviting, setInviting] = useState(false);

  const fetcher = useCallback(
    () =>
      portalAdminService.accounts({
        page,
        per_page: perPage,
        search: search || undefined,
        status: status || undefined,
      }),
    [page, perPage, search, status],
  );
  const resource = useApiResource(fetcher);
  const rows = resource.data?.data ?? [];
  const total = resource.data?.meta?.total ?? rows.length;
  const invitable = rows.filter((r) => r.status === "not_invited" || r.status === "invitation_sent");

  const toggle = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };
  const allSelected = invitable.length > 0 && invitable.every((r) => selected.has(r.borrower_id));

  const inviteSelected = () => {
    setInviting(true);
    portalAdminService
      .bulkInvite({ borrower_ids: [...selected] })
      .then((res) => {
        const skipped = res.skipped.length ? ` ${res.skipped.length} skipped (no email or mobile on file).` : "";
        notifySuccess(`${res.invited} invitation${res.invited === 1 ? "" : "s"} sent.${skipped}`);
        setSelected(new Set());
        resource.refetch();
        onChanged();
      })
      .catch((err) => notifyError(err, "The invitations could not be sent."))
      .finally(() => setInviting(false));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <form
          className="relative min-w-56 flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(draft.trim());
            setPage(1);
          }}
        >
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
          <Input
            aria-label="Search members"
            placeholder="Search name or member number, then press Enter"
            className="pl-8"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
        </form>
        <NativeSelect
          aria-label="Filter by status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as PortalAccountStatus | "");
            setPage(1);
          }}
        >
          <NativeSelectOption value="">All statuses</NativeSelectOption>
          {(Object.keys(ACCOUNT_STATUS) as PortalAccountStatus[]).map((s) => (
            <NativeSelectOption key={s} value={s}>
              {ACCOUNT_STATUS[s].label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <PermissionButton
          permission="member_portal:manage"
          disabled={selected.size === 0 || inviting}
          onClick={inviteSelected}
        >
          Invite selected{selected.size > 0 ? ` (${selected.size})` : ""}
        </PermissionButton>
      </div>

      {resource.error && <p className="text-sm text-destructive">{resource.error}</p>}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  aria-label="Select all invitable members on this page"
                  checked={allSelected}
                  disabled={invitable.length === 0}
                  onCheckedChange={(on) =>
                    setSelected(on ? new Set(invitable.map((r) => r.borrower_id)) : new Set())
                  }
                />
              </TableHead>
              <TableHead>Member</TableHead>
              <TableHead className="hidden md:table-cell">Branch</TableHead>
              <TableHead className="hidden lg:table-cell">Contact</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Last sign-in</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  {resource.loading ? "Loading members…" : "No members match these filters."}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => {
                const st = ACCOUNT_STATUS[r.status] ?? { label: r.status, tone: "muted" as const };
                const canInvite = r.status === "not_invited" || r.status === "invitation_sent";
                return (
                  <TableRow key={r.borrower_id}>
                    <TableCell>
                      {canInvite && (
                        <Checkbox
                          aria-label={`Select ${r.full_name}`}
                          checked={selected.has(r.borrower_id)}
                          onCheckedChange={() => toggle(r.borrower_id)}
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      <Link href={`/borrowers/${r.borrower_id}`} className="font-medium hover:underline">
                        {r.full_name}
                      </Link>
                      <p className="text-xs text-muted-foreground">{r.member_number}</p>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{r.branch_name ?? "—"}</TableCell>
                    <TableCell className="hidden text-xs lg:table-cell">
                      {[r.email, r.mobile].filter(Boolean).join(" · ") || (
                        <span className="text-amber-600">No email or mobile</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TONE_CLASS[st.tone]}`}>
                        {st.label}
                      </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {r.last_login_at ? formatDateTime(r.last_login_at) : "—"}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      <TablePagination
        page={page}
        perPage={perPage}
        total={total}
        onPageChange={(p) => {
          setPage(p);
          setSelected(new Set());
        }}
        onPerPageChange={(n) => {
          setPerPage(n);
          setPage(1);
        }}
      />
    </div>
  );
}
