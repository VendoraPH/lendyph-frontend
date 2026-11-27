"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { VALID_ID_OPTIONS } from "@/constants";
import { useDialogOpening } from "@/hooks/use-dialog-opening";
import { loanOriginationService } from "@/services";
import type { StaffDocument } from "@/types/loan-origination";
import { fileLine, verifyPayload, type DocumentReview, type VerifyForm } from "../_lib/document-review";
import { ActionDialog } from "./action-dialog";

const COPY: Record<DocumentReview, { title: string; confirm: string; done: string; field: string; hint: string }> = {
  verify: {
    title: "Verify document",
    confirm: "Mark verified",
    done: "Document verified",
    field: "Notes (optional)",
    hint: "Staff only.",
  },
  reject: {
    title: "Reject document",
    confirm: "Reject document",
    done: "Document rejected",
    field: "Reason",
    hint: "Kept with the document for staff. To ask the applicant for another file, use Ask again.",
  },
  replace: {
    title: "Ask for another file",
    confirm: "Ask again",
    done: "Another file requested: logged, not sent",
    field: "What is wrong with this file",
    hint: "Sent to the applicant as a message, logged, not sent: text messages and email aren't switched on yet. They see it when they track the application.",
  },
};

const EMPTY: VerifyForm = { notes: "", idType: "", customTypeName: "", idNumber: "" };

/**
 * Verify, reject or ask again for one document; the application page and the
 * documents queue share it. Verifying an ID records its type and number, which
 * the hand-off files as the member's valid ID; the server refuses it without.
 */
export function DocumentReviewDialog({
  document,
  kind,
  onClose,
  onDone,
}: {
  document: StaffDocument | null;
  kind: DocumentReview;
  onClose: () => void;
  onDone: () => void;
}) {
  const open = document !== null;
  const [form, setForm] = useState<VerifyForm>(EMPTY);
  const [reason, setReason] = useState("");
  if (useDialogOpening(open, document?.id)) {
    setForm(EMPTY);
    setReason("");
  }
  const set = (patch: Partial<VerifyForm>) => setForm((f) => ({ ...f, ...patch }));
  const copy = COPY[kind];
  const idDocument = kind === "verify" && document?.id_document === true;
  const verify = verifyPayload(idDocument, form);

  const send = () => {
    if (!document) return Promise.resolve();
    if (kind === "verify") return loanOriginationService.verifyDocument(document.id, verify.body);
    if (kind === "reject") return loanOriginationService.rejectDocument(document.id, reason.trim());
    return loanOriginationService.requestReplacement(document.id, reason.trim());
  };
  const file = document ? fileLine(document) : null;

  return (
    <ActionDialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={copy.title}
      description={document ? `${document.label}${file && !file.hidden ? ` · ${file.text}` : ""}` : undefined}
      confirmLabel={copy.confirm}
      destructive={kind === "reject"}
      successMessage={copy.done}
      errorMessage="Could not update the document"
      canConfirm={kind === "verify" ? verify.problem === null : reason.trim() !== ""}
      onConfirm={send}
      onDone={onDone}
      size={idDocument ? "md" : "default"}
    >
      {idDocument && (
        <div className="grid gap-3 sm:grid-cols-2">
          <p className="text-sm text-muted-foreground sm:col-span-2">
            Read the ID type and number off the ID. The hand-off files it as the member&apos;s valid ID with them.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="verify-id-type">ID type</Label>
            <NativeSelect id="verify-id-type" className="w-full" value={form.idType} onChange={(e) => set({ idType: e.target.value })}>
              <NativeSelectOption value="" disabled>
                Choose the ID type
              </NativeSelectOption>
              {VALID_ID_OPTIONS.map((o) => (
                <NativeSelectOption key={o.value} value={o.value}>
                  {o.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="verify-id-number">ID number</Label>
            <Input id="verify-id-number" maxLength={100} value={form.idNumber} onChange={(e) => set({ idNumber: e.target.value })} />
          </div>
          {form.idType === "others" && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="verify-id-name">ID type&apos;s name</Label>
              <Input
                id="verify-id-name"
                maxLength={100}
                placeholder="Barangay ID"
                value={form.customTypeName}
                onChange={(e) => set({ customTypeName: e.target.value })}
              />
            </div>
          )}
        </div>
      )}
      {kind === "verify" ? (
        <div className="space-y-1.5">
          <Label htmlFor="document-review-notes">{copy.field}</Label>
          <Textarea id="document-review-notes" rows={3} maxLength={1000} value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
          <p className="text-xs text-muted-foreground">{copy.hint}</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="document-review-reason">{copy.field}</Label>
          <Textarea id="document-review-reason" rows={3} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} />
          <p className="text-xs text-muted-foreground">{copy.hint}</p>
        </div>
      )}
      {idDocument && verify.problem && <p className="text-xs text-muted-foreground">{verify.problem}</p>}
    </ActionDialog>
  );
}
