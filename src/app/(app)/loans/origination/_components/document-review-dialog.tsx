"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useDialogOpening } from "@/hooks/use-dialog-opening";
import { loanOriginationService } from "@/services";
import type { ApplicationDocument } from "@/types/loan-origination";
import { ActionDialog } from "./action-dialog";

export type DocumentReview = "verify" | "reject" | "replace";

const COPY: Record<DocumentReview, { title: string; confirm: string; done: string; field: string; required: boolean }> = {
  verify: { title: "Verify document", confirm: "Mark verified", done: "Document verified", field: "Notes (optional)", required: false },
  reject: { title: "Reject document", confirm: "Reject document", done: "Document rejected", field: "Reason (the applicant sees this)", required: true },
  replace: {
    title: "Request a replacement",
    confirm: "Request replacement",
    done: "Replacement requested",
    field: "What is wrong with this file (the applicant sees this)",
    required: true,
  },
};

function send(kind: DocumentReview, docId: number, text: string) {
  if (kind === "verify") return loanOriginationService.verifyDocument(docId, text);
  if (kind === "reject") return loanOriginationService.rejectDocument(docId, text);
  return loanOriginationService.requestReplacement(docId, text);
}

/** Verify, reject or ask again for one uploaded document. Shared by the application page and the document queue. */
export function DocumentReviewDialog({
  document,
  kind,
  onClose,
  onDone,
}: {
  document: ApplicationDocument | null;
  kind: DocumentReview;
  onClose: () => void;
  onDone: () => void;
}) {
  const open = document !== null;
  const [text, setText] = useState("");
  if (useDialogOpening(open, document?.id)) setText("");
  const copy = COPY[kind];

  return (
    <ActionDialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={copy.title}
      description={document ? `${document.label}${document.file_name ? ` · ${document.file_name}` : ""}` : undefined}
      confirmLabel={copy.confirm}
      destructive={kind === "reject"}
      successMessage={copy.done}
      errorMessage="Could not update the document"
      canConfirm={!copy.required || text.trim() !== ""}
      onConfirm={() => (document ? send(kind, document.id, text.trim()) : Promise.resolve())}
      onDone={onDone}
    >
      <Label htmlFor="document-review-text">{copy.field}</Label>
      <Textarea id="document-review-text" rows={3} value={text} onChange={(e) => setText(e.target.value)} />
    </ActionDialog>
  );
}
