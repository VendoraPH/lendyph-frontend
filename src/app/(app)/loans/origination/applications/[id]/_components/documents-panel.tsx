"use client";

import { useState } from "react";
import { DocumentStatusBadge } from "@/components/loan-origination/badges";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { formatFileSize } from "@/lib/loan-origination";
import { cn } from "@/lib/utils";
import type { ApplicationDetail, StaffDocument } from "@/types/loan-origination";
import { DocumentReviewDialog } from "../../../_components/document-review-dialog";
import { DocumentRowActions } from "../../../_components/document-row-actions";
import { fileLine, type DocumentReview } from "../../../_lib/document-review";

/** The application's documents with their review state; required ones the applicant hasn't handed in are listed above. */
export function DocumentsPanel({ application, onChanged }: { application: ApplicationDetail; onChanged: () => void }) {
  const [review, setReview] = useState<{ doc: StaffDocument; kind: DocumentReview } | null>(null);
  const { documents, missing_documents: missing } = application;

  return (
    <div className="space-y-3">
      {missing.length > 0 && (
        <p className="text-sm text-muted-foreground">Required and not handed in: {missing.join(", ")}.</p>
      )}
      {documents.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No documents uploaded yet.</p>
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document</TableHead>
                <TableHead>File</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reviewed</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((d) => {
                const file = fileLine(d);
                return (
                  <TableRow key={d.id}>
                    <TableCell className="min-w-40">
                      <span className="font-medium">{d.label}</span>
                      {d.required && <span className="ml-1 text-xs text-muted-foreground">required</span>}
                      {d.versions.length > 1 && (
                        <span className="block text-xs text-muted-foreground">{d.versions.length} versions uploaded</span>
                      )}
                      {d.id_document && d.id_type_label && (
                        <span className="block text-xs text-muted-foreground">
                          {d.id_type_label}
                          {d.id_number && <> · {d.id_number}</>}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="min-w-32 text-sm">
                      <span className={cn("break-all", file.hidden && "text-muted-foreground")}>{file.text}</span>
                      {d.uploaded_at && (
                        <span className="block text-xs text-muted-foreground">
                          {formatFileSize(d.size_bytes)}
                          {d.scan_label && <> · {d.scan_label}</>}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{d.uploaded_at ? formatDateTime(d.uploaded_at) : "—"}</TableCell>
                    <TableCell>
                      <DocumentStatusBadge status={d.status} label={d.status_label} />
                      {d.rejection_reason && (
                        <span className="mt-1 block max-w-48 text-xs whitespace-normal text-muted-foreground">{d.rejection_reason}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {d.verified_by_name ? (
                        <>
                          {d.verified_by_name}
                          {d.verified_at && <span className="block text-xs text-muted-foreground">{formatDateTime(d.verified_at)}</span>}
                        </>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <DocumentRowActions doc={d} onReview={(doc, kind) => setReview({ doc, kind })} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      <DocumentReviewDialog
        document={review?.doc ?? null}
        kind={review?.kind ?? "verify"}
        onClose={() => setReview(null)}
        onDone={onChanged}
      />
    </div>
  );
}
