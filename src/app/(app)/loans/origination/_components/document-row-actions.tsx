"use client";

import { Check, Download, RefreshCw, X } from "lucide-react";
import { PermissionButton } from "@/components/common/permission-button";
import { Button } from "@/components/ui/button";
import { notifyError } from "@/lib/notify";
import { saveBlob } from "@/lib/save-blob";
import { loanOriginationService } from "@/services";
import type { StaffDocument } from "@/types/loan-origination";
import { reviewActions, type DocumentReview } from "../_lib/document-review";

function download(doc: StaffDocument) {
  loanOriginationService
    .downloadDocument(doc.id)
    .then((blob) => saveBlob(blob, doc.file_name ?? doc.type))
    .catch((err) => notifyError(err, "Could not download the document"));
}

const BUTTONS: Record<DocumentReview, { label: string; Icon: typeof Check; className?: string }> = {
  verify: { label: "Verify", Icon: Check },
  replace: { label: "Ask again", Icon: RefreshCw },
  reject: { label: "Reject", Icon: X, className: "text-destructive" },
};

/**
 * Download, and the decisions the document's status allows. The file opens
 * only for a viewer the server shows its name to (`borrowers:view` and the
 * branch, since a document shows the applicant's address and contacts).
 */
export function DocumentRowActions({
  doc,
  onReview,
}: {
  doc: StaffDocument;
  onReview: (doc: StaffDocument, kind: DocumentReview) => void;
}) {
  return (
    <div className="flex flex-wrap justify-end gap-1">
      {doc.file_name && (
        <Button size="sm" variant="ghost" onClick={() => download(doc)} aria-label={`Download ${doc.label}`}>
          <Download className="h-4 w-4" />
        </Button>
      )}
      {reviewActions(doc).map((kind) => {
        const { label, Icon, className } = BUTTONS[kind];
        return (
          <PermissionButton
            key={kind}
            permission="loan_origination:update"
            size="sm"
            variant="outline"
            className={className}
            onClick={() => onReview(doc, kind)}
          >
            <Icon className="mr-1 h-4 w-4" /> {label}
          </PermissionButton>
        );
      })}
    </div>
  );
}
