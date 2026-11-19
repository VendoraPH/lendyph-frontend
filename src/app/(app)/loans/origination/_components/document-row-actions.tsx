"use client";

import { Check, Download, RefreshCw, X } from "lucide-react";
import { PermissionButton } from "@/components/common/permission-button";
import { Button } from "@/components/ui/button";
import { documentAwaitsReview } from "@/lib/loan-origination";
import { notifyError } from "@/lib/notify";
import { saveBlob } from "@/lib/save-blob";
import { loanOriginationService } from "@/services";
import type { ApplicationDocument } from "@/types/loan-origination";
import type { DocumentReview } from "./document-review-dialog";

function download(doc: ApplicationDocument) {
  loanOriginationService
    .downloadDocument(doc.id)
    .then((blob) => saveBlob(blob, doc.file_name ?? `${doc.type}`))
    .catch((err) => notifyError(err, "Could not download the document"));
}

/** Download plus the three review actions, for one document. */
export function DocumentRowActions({
  doc,
  onReview,
}: {
  doc: ApplicationDocument;
  onReview: (doc: ApplicationDocument, kind: DocumentReview) => void;
}) {
  const reviewable = documentAwaitsReview(doc.status);
  return (
    <div className="flex flex-wrap justify-end gap-1">
      {doc.file_name && (
        <Button size="sm" variant="ghost" onClick={() => download(doc)} aria-label={`Download ${doc.label}`}>
          <Download className="h-4 w-4" />
        </Button>
      )}
      {reviewable && (
        <>
          <PermissionButton
            permission="loan_origination:update"
            size="sm"
            variant="outline"
            onClick={() => onReview(doc, "verify")}
          >
            <Check className="mr-1 h-4 w-4" /> Verify
          </PermissionButton>
          <PermissionButton
            permission="loan_origination:update"
            size="sm"
            variant="outline"
            onClick={() => onReview(doc, "replace")}
          >
            <RefreshCw className="mr-1 h-4 w-4" /> Ask again
          </PermissionButton>
          <PermissionButton
            permission="loan_origination:update"
            size="sm"
            variant="outline"
            className="text-destructive"
            onClick={() => onReview(doc, "reject")}
          >
            <X className="mr-1 h-4 w-4" /> Reject
          </PermissionButton>
        </>
      )}
    </div>
  );
}
