"use client";

import { useState } from "react";
import { DocumentStatusBadge } from "@/components/loan-origination/badges";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { formatFileSize } from "@/lib/loan-origination";
import type { ApplicationDocument } from "@/types/loan-origination";
import { DocumentReviewDialog, type DocumentReview } from "../../../_components/document-review-dialog";
import { DocumentRowActions } from "../../../_components/document-row-actions";

/** Every document the product asks for, uploaded or not, with its review state. */
export function DocumentsPanel({ documents, onChanged }: { documents: ApplicationDocument[]; onChanged: () => void }) {
  const [review, setReview] = useState<{ doc: ApplicationDocument; kind: DocumentReview } | null>(null);

  if (documents.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">This loan product asks for no documents.</p>;
  }
  return (
    <>
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
            {documents.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="min-w-40">
                  <span className="font-medium">{d.label}</span>
                  {d.required && <span className="ml-1 text-xs text-muted-foreground">required</span>}
                  {d.versions.length > 1 && (
                    <span className="block text-xs text-muted-foreground">{d.versions.length} versions uploaded</span>
                  )}
                </TableCell>
                <TableCell className="min-w-32 text-sm">
                  {d.file_name ? (
                    <>
                      <span className="break-all">{d.file_name}</span>
                      <span className="block text-xs text-muted-foreground">{formatFileSize(d.size_bytes)}</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">Not uploaded</span>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm">
                  {d.uploaded_at ? formatDateTime(d.uploaded_at) : "—"}
                </TableCell>
                <TableCell>
                  <DocumentStatusBadge status={d.status} />
                  {d.rejection_reason && (
                    <span className="mt-1 block max-w-48 text-xs text-muted-foreground">{d.rejection_reason}</span>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {d.verified_by_name ? (
                    <>
                      {d.verified_by_name}
                      {d.verified_at && (
                        <span className="block text-xs text-muted-foreground">{formatDateTime(d.verified_at)}</span>
                      )}
                    </>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  <DocumentRowActions doc={d} onReview={(doc, kind) => setReview({ doc, kind })} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <DocumentReviewDialog
        document={review?.doc ?? null}
        kind={review?.kind ?? "verify"}
        onClose={() => setReview(null)}
        onDone={onChanged}
      />
    </>
  );
}
