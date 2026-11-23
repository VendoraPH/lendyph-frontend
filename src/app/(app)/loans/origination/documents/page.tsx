"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { DataState } from "@/components/common/data-state";
import { ScrollBox } from "@/components/common/page-fill";
import { TablePagination } from "@/components/common/table-pagination";
import { DocumentStatusBadge } from "@/components/loan-origination/badges";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApiResource } from "@/hooks";
import { formatDateTime } from "@/lib/format";
import { emptyArt, filtersActive } from "@/lib/illustrations";
import { DOCUMENT_STATUS_LABELS, formatFileSize } from "@/lib/loan-origination";
import { FIT_CLASSES } from "@/lib/page-fill";
import { cn } from "@/lib/utils";
import { loanOriginationService, type DocumentQueueFilters } from "@/services/loan-origination.service";
import type { DocumentStatus, StaffDocument } from "@/types/loan-origination";
import { DocumentReviewDialog } from "../_components/document-review-dialog";
import { DocumentRowActions } from "../_components/document-row-actions";
import { SearchInput } from "../_components/search-input";
import { StatusTabs } from "../_components/status-tabs";
import { DEFAULT_QUEUE_STATUS, fileLine, type DocumentReview } from "../_lib/document-review";

const PER_PAGE_OPTIONS = [20, 50, 100] as const;
// "Not submitted" is a gap in an application, not something to review here.
const STATUSES = (Object.keys(DOCUMENT_STATUS_LABELS) as DocumentStatus[]).filter((s) => s !== "not_submitted");

/**
 * Files of submitted applications in the caller's branches, oldest change
 * first, with the server's per-status counts. It opens on Uploaded, where new
 * files land.
 */
export default function DocumentQueuePage() {
  const [filters, setFilters] = useState<DocumentQueueFilters>({ page: 1, per_page: 20, status: DEFAULT_QUEUE_STATUS });
  const fetcher = useCallback(() => loanOriginationService.listDocuments(filters), [filters]);
  const list = useApiResource(fetcher);
  const [review, setReview] = useState<{ doc: StaffDocument; kind: DocumentReview } | null>(null);

  return (
    <div className={cn(FIT_CLASSES.section, "gap-3")}>
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={filters.search}
          placeholder="Applicant or reference, then Enter"
          onChange={(search) => setFilters((f) => ({ ...f, search, page: 1 }))}
        />
        <StatusTabs
          value={filters.status}
          statuses={STATUSES}
          labels={DOCUMENT_STATUS_LABELS}
          stats={list.data?.meta.stats}
          onChange={(status) => setFilters((f) => ({ ...f, status, page: 1 }))}
        />
      </div>
      <DataState
        resource={list}
        summary="Uploaded application documents waiting for verification will be listed here once online applications are connected."
        endpoints={["GET /loan-origination/documents"]}
        isEmpty={(res) => res.data.length === 0}
        emptyMessage="No documents match these filters."
        emptyIllustration={emptyArt("emptyDocuments", filtersActive(filters))}
      >
        {(res) => (
          <div className={cn(FIT_CLASSES.section, "gap-3")}>
            <div className={cn("rounded-xl border bg-card", FIT_CLASSES.section)}>
              <ScrollBox>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Application</TableHead>
                      <TableHead>Document</TableHead>
                      <TableHead>File</TableHead>
                      <TableHead>Uploaded</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {res.data.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="min-w-40">
                          <Link
                            href={`/loans/origination/applications/${d.application_id}`}
                            className="font-medium text-brand-orange hover:underline"
                          >
                            {d.applicant_name}
                          </Link>
                          <span className="block text-xs text-muted-foreground">{d.reference_number ?? `Draft #${d.application_id}`}</span>
                        </TableCell>
                        <TableCell className="min-w-32">{d.label}</TableCell>
                        <TableCell className="min-w-32 text-sm">
                          <span className={cn("break-all", fileLine(d).hidden && "text-muted-foreground")}>{fileLine(d).text}</span>
                          <span className="block text-xs text-muted-foreground">
                            {formatFileSize(d.size_bytes)}
                            {d.scan_label && <> · {d.scan_label}</>}
                          </span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {d.uploaded_at ? formatDateTime(d.uploaded_at) : "—"}
                        </TableCell>
                        <TableCell>
                          <DocumentStatusBadge status={d.status} label={d.status_label} />
                        </TableCell>
                        <TableCell>
                          <DocumentRowActions doc={d} onReview={(doc, kind) => setReview({ doc, kind })} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollBox>
            </div>
            <TablePagination
              page={res.meta.current_page}
              perPage={res.meta.per_page}
              total={res.meta.total}
              perPageOptions={PER_PAGE_OPTIONS}
              onPageChange={(page) => setFilters((f) => ({ ...f, page }))}
              onPerPageChange={(per_page) => setFilters((f) => ({ ...f, per_page, page: 1 }))}
            />
          </div>
        )}
      </DataState>
      <DocumentReviewDialog
        document={review?.doc ?? null}
        kind={review?.kind ?? "verify"}
        onClose={() => setReview(null)}
        onDone={list.refetch}
      />
    </div>
  );
}
