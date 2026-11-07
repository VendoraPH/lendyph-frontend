"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { TablePagination } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApiResource } from "@/hooks/use-api-resource";
import { formatDateTime } from "@/lib/format";
import { humanize, TONE_CLASS } from "@/lib/portal/labels";
import {
  allowedDecisions,
  DECISION_LABEL,
  decisionNeedsResponse,
  PORTAL_REQUEST_STATUS,
  REQUEST_TYPES,
} from "@/lib/portal/requests";
import { portalAdminService } from "@/services/portal-admin.service";
import type { PortalRequestStatus, PortalRequestType, StaffPortalRequest } from "@/types/portal";
import { DecisionDialog } from "./decision-dialog";

/** Server-paged members' service requests with status/type filters and a decision dialog. */
export function MemberRequestsTable() {
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<PortalRequestStatus | "">("submitted");
  const [type, setType] = useState<PortalRequestType | "">("");
  const [deciding, setDeciding] = useState<StaffPortalRequest | null>(null);

  const fetcher = useCallback(
    () =>
      portalAdminService.requests({
        page,
        per_page: perPage,
        status: status || undefined,
        type: type || undefined,
        search: search || undefined,
      }),
    [page, perPage, status, type, search],
  );
  const resource = useApiResource(fetcher);
  const rows = resource.data?.data ?? [];
  const total = resource.data?.meta?.total ?? rows.length;

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
            aria-label="Search requests"
            placeholder="Search member or reference, then press Enter"
            className="pl-8"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
        </form>
        <NativeSelect
          aria-label="Filter by status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as PortalRequestStatus | "");
            setPage(1);
          }}
        >
          <NativeSelectOption value="">All statuses</NativeSelectOption>
          {(Object.keys(PORTAL_REQUEST_STATUS) as PortalRequestStatus[]).map((s) => (
            <NativeSelectOption key={s} value={s}>
              {PORTAL_REQUEST_STATUS[s].label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label="Filter by type"
          value={type}
          onChange={(e) => {
            setType(e.target.value as PortalRequestType | "");
            setPage(1);
          }}
        >
          <NativeSelectOption value="">All types</NativeSelectOption>
          {(Object.keys(REQUEST_TYPES) as PortalRequestType[]).map((t) => (
            <NativeSelectOption key={t} value={t}>
              {REQUEST_TYPES[t].label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      {resource.unavailable && (
        <p className="text-sm text-muted-foreground">Member requests are not connected yet (GET /portal-admin/requests).</p>
      )}
      {resource.error && <p className="text-sm text-destructive">{resource.error}</p>}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Request</TableHead>
              <TableHead>Member</TableHead>
              <TableHead className="hidden md:table-cell">Submitted</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  {resource.loading ? "Loading requests…" : "No requests match these filters."}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => {
                const st = PORTAL_REQUEST_STATUS[r.status] ?? { label: humanize(r.status), tone: "muted" as const };
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <p className="font-medium">{REQUEST_TYPES[r.type]?.label ?? humanize(r.type)}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.reference}
                        {r.summary && ` · ${r.summary}`}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Link href={`/borrowers/${r.borrower_id}`} className="font-medium hover:underline">
                        {r.member_name}
                      </Link>
                      <p className="text-xs text-muted-foreground">{r.member_number}</p>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{formatDateTime(r.submitted_at)}</TableCell>
                    <TableCell>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TONE_CLASS[st.tone]}`}>
                        {st.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {allowedDecisions(r.status).length > 0 && (
                        <Button size="sm" variant="outline" onClick={() => setDeciding(r)}>
                          Review
                        </Button>
                      )}
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
        onPageChange={setPage}
        onPerPageChange={(n) => {
          setPerPage(n);
          setPage(1);
        }}
      />

      <DecisionDialog
        subject={deciding}
        options={(deciding ? allowedDecisions(deciding.status) : []).map((d) => ({ value: d, label: DECISION_LABEL[d] }))}
        needsResponse={decisionNeedsResponse}
        submit={(id, decision, response) =>
          portalAdminService.decideRequest(id, { decision, response: response || undefined })
        }
        onOpenChange={(open) => !open && setDeciding(null)}
        onDone={resource.refetch}
      >
        {deciding && <RequestDetails request={deciding} />}
      </DecisionDialog>
    </div>
  );
}

/** What the member asked for, labelled with the request form's own field names. */
function RequestDetails({ request }: { request: StaffPortalRequest }) {
  const fields = REQUEST_TYPES[request.type]?.fields ?? [];
  const entries = Object.entries(request.details ?? {}).filter(([, v]) => v !== null && v !== "");
  return (
    <div className="space-y-2 rounded-md border bg-muted/30 p-3 text-sm">
      <p className="font-medium">
        {REQUEST_TYPES[request.type]?.label ?? humanize(request.type)} · {request.member_name}
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        {entries.map(([key, value]) => (
          <div key={key} className="contents">
            <dt className="text-muted-foreground">{fields.find((f) => f.key === key)?.label ?? humanize(key)}</dt>
            <dd className="break-words">{String(value)}</dd>
          </div>
        ))}
      </dl>
      {request.remarks && <p className="text-muted-foreground">Member&apos;s note: {request.remarks}</p>}
      {request.attachments.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {request.attachments.map((a) => (
            <li key={a.id}>
              <a href={a.url} target="_blank" rel="noreferrer" className="text-primary underline">
                {a.name}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
