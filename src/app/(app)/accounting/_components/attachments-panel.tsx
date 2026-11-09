"use client";

import { useCallback, useId, useMemo, useRef, useState, type MouseEvent } from "react";
import { ExternalLink, Paperclip, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApiResource, usePermission } from "@/hooks";
import { accountingService } from "@/services/accounting.service";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { getErrorMessage, httpStatusOf } from "@/lib/api-error";
import { notifyError, notifySuccess, notifyWarning } from "@/lib/notify";
import { formatValue } from "@/lib/report-format";
import type { Permission } from "@/types";
import type { AccountingAttachment, ExpenseStatus, JournalStatus } from "@/types/accounting";
import { DataState } from "./data-state";
import { AttachmentRemoveDialog } from "./attachment-remove-dialog";

/** What the attachments belong to. A journal's status decides the removal rule. */
export type AttachmentOwner =
  | { kind: "journal"; id: number; status?: JournalStatus }
  | { kind: "expense"; id: number; status?: ExpenseStatus };

/** The calls for one owner, over the FE-C0 service. */
export interface AttachmentCalls {
  list: () => Promise<AccountingAttachment[]>;
  upload: (file: File, label: string) => Promise<AccountingAttachment>;
  remove: (attachmentId: number, reason: string | undefined) => Promise<{ message: string }>;
}

/** The server's limits (C6, backend #250). */
export const MAX_ATTACHMENTS = 20;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_REASON_LENGTH = 500;
const ACCEPTED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".pdf", ".doc", ".docx"];
/** The signed link lasts 30 minutes; a list older than this is read again before opening. */
const LINK_FRESH_MS = 5 * 60_000;

export function attachmentCallsFor(owner: AttachmentOwner): AttachmentCalls {
  const label = (text: string) => text.trim() || undefined;
  if (owner.kind === "journal") {
    return {
      list: () => accountingService.journalAttachments(owner.id),
      upload: (file, text) => accountingService.uploadJournalAttachment(owner.id, file, label(text)),
      remove: (attachmentId, reason) =>
        accountingService.removeJournalAttachment(owner.id, attachmentId, reason),
    };
  }
  return {
    list: () => accountingService.expenseAttachments(owner.id),
    upload: (file, text) => accountingService.uploadExpenseAttachment(owner.id, file, label(text)),
    remove: (attachmentId, reason) =>
      accountingService.removeExpenseAttachment(owner.id, attachmentId, reason),
  };
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 bytes";
  if (bytes < 1024) return bytes === 1 ? "1 byte" : `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isLinkStale(fetchedAt: number | null, now: number): boolean {
  return fetchedAt === null || now - fetchedAt > LINK_FRESH_MS;
}

export function uploadPermission(kind: AttachmentOwner["kind"]): Permission {
  return kind === "journal" ? "journals:create" : "expenses:create";
}

export type UploadState =
  | { shown: false }
  | { shown: true; disabledReason: string | null; countText: string };

export function uploadState(owner: AttachmentOwner, canCreate: boolean, count: number): UploadState {
  if (!canCreate) return { shown: false };
  const full = count >= MAX_ATTACHMENTS;
  return {
    shown: true,
    disabledReason: full
      ? `${owner.kind === "journal" ? "A journal" : "An expense"} can hold at most ${MAX_ATTACHMENTS} attachments.`
      : null,
    countText: `${count} of ${MAX_ATTACHMENTS} attachments`,
  };
}

/** Blocks only the obvious; the server judges the content and its words win. */
export function precheckFile(file: File): string | null {
  const dot = file.name.lastIndexOf(".");
  const extension = dot === -1 ? "" : file.name.slice(dot).toLowerCase();
  if (!ACCEPTED_EXTENSIONS.includes(extension)) return "Use a JPG, PNG, PDF, DOC or DOCX file.";
  if (file.size > MAX_FILE_BYTES) return "This file is larger than 10 MB.";
  return null;
}

/** Only a draft journal's attachment goes without a reason. */
export function removalNeedsReason(owner: AttachmentOwner): boolean {
  return !(owner.kind === "journal" && owner.status === "draft");
}

/** The reason to send: none on a draft, the trimmed text otherwise. */
export function removalReason(owner: AttachmentOwner, reason: string): string | undefined {
  return removalNeedsReason(owner) ? reason.trim() : undefined;
}

export function reasonError(reason: string, needed: boolean): string | null {
  if (!needed) return null;
  const text = reason.trim();
  if (!text) return "Say why this attachment is being removed.";
  if (text.length > MAX_REASON_LENGTH) return `Keep the reason to ${MAX_REASON_LENGTH} characters.`;
  return null;
}

/** Why the Remove action is off for this user, in words. */
export function removeBlockedReason(owner: AttachmentOwner): string {
  if (owner.kind === "expense") {
    return "Only users who manage accounting settings can remove an attachment from an expense.";
  }
  if (owner.status === "draft") {
    return "Only users who can create journal entries can remove an attachment from a draft.";
  }
  return "Only users who manage accounting settings can remove an attachment from a posted or reversed journal.";
}

/**
 * A removal that lost a race (posted meanwhile, already gone, or a permission
 * changed so `can_remove` was stale) reloads the list.
 */
export function removalFailure(err: unknown): { message: string; reload: boolean } {
  const status = httpStatusOf(err);
  return {
    message: getErrorMessage(err, "Could not remove this attachment."),
    reload: status === 409 || status === 404 || status === 403,
  };
}

function uploadedLine(attachment: AccountingAttachment): string {
  const when = formatValue(attachment.created_at, "datetime");
  return attachment.uploaded_by
    ? `Uploaded by ${attachment.uploaded_by.name}, ${when}`
    : `Uploaded ${when}`;
}

interface AttachmentRowsProps {
  attachments: AccountingAttachment[];
  onOpen: (attachment: AccountingAttachment, event: MouseEvent<HTMLAnchorElement>) => void;
  onRemove: (attachment: AccountingAttachment) => void;
  /** Shown when a row's Remove is off; null when every row can be removed. */
  removeBlockedReason: string | null;
}

export function AttachmentRows({ attachments, onOpen, onRemove, removeBlockedReason }: AttachmentRowsProps) {
  const anyBlocked = attachments.some((a) => !a.can_remove);
  const reasonId = useId();
  return (
    <div className="space-y-2">
      <ul className="divide-y rounded-lg border">
        {attachments.map((attachment) => (
          <li key={attachment.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
            <Paperclip className="hidden h-4 w-4 shrink-0 text-muted-foreground sm:block" aria-hidden="true" />
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="truncate text-sm font-medium">{attachment.original_filename}</p>
              {attachment.label && <p className="text-sm text-muted-foreground">{attachment.label}</p>}
              <p className="text-xs text-muted-foreground">
                {formatFileSize(attachment.file_size)} · {uploadedLine(attachment)}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                variant="outline"
                size="sm"
                render={
                  <a
                    href={attachment.url}
                    target="_blank"
                    rel="noopener"
                    onClick={(event) => onOpen(attachment, event)}
                  />
                }
                nativeButton={false}
              >
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                Open
                <span className="sr-only"> {attachment.original_filename}</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!attachment.can_remove}
                aria-describedby={!attachment.can_remove && removeBlockedReason ? reasonId : undefined}
                onClick={() => onRemove(attachment)}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                Remove
                <span className="sr-only"> {attachment.original_filename}</span>
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {anyBlocked && removeBlockedReason && (
        <p id={reasonId} className="text-xs text-muted-foreground">
          {removeBlockedReason}
        </p>
      )}
    </div>
  );
}

interface AttachmentsPanelProps {
  owner: AttachmentOwner;
  /** Defaults to the FE-C0 service calls for this owner. */
  calls?: AttachmentCalls;
}

/** Receipts, invoices and bank slips on a journal or an expense. */
export function AttachmentsPanel({ owner, calls }: AttachmentsPanelProps) {
  const { kind, id, status } = owner;
  const bound = useMemo(
    () => calls ?? attachmentCallsFor({ kind, id, status } as AttachmentOwner),
    [calls, kind, id, status],
  );
  const fetchedAt = useRef<number | null>(null);
  const fetcher = useCallback(
    () =>
      bound.list().then((rows) => {
        fetchedAt.current = Date.now();
        return rows;
      }),
    [bound],
  );
  const resource = useApiResource(fetcher);
  const { can } = usePermission();
  const rows = resource.data ?? [];
  const upload = uploadState(owner, can(uploadPermission(kind)), rows.length);

  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState("");
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState<AccountingAttachment | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const submitUpload = () => {
    if (!file) return;
    const problem = precheckFile(file);
    if (problem) {
      notifyWarning(problem);
      return;
    }
    setUploading(true);
    bound.upload(file, label).then(
      () => {
        notifySuccess("Attachment uploaded.");
        setFile(null);
        setLabel("");
        if (fileInput.current) fileInput.current.value = "";
        setUploading(false);
        resource.refetch();
      },
      (err: unknown) => {
        notifyError(err, "Could not upload this file.");
        setUploading(false);
      },
    );
  };

  const openFresh = (attachment: AccountingAttachment, event: MouseEvent<HTMLAnchorElement>) => {
    if (!isLinkStale(fetchedAt.current, Date.now())) return;
    event.preventDefault();
    fetcher().then(
      (fresh) => {
        resource.refetch();
        const row = fresh.find((a) => a.id === attachment.id);
        if (row) window.open(row.url, "_blank", "noopener");
        else notifyWarning("This attachment has been removed.");
      },
      (err: unknown) => notifyError(err, "Could not open this attachment."),
    );
  };

  const formId = useId();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Attachments</CardTitle>
        <CardDescription>Receipts, invoices and bank slips. JPG, PNG, PDF, DOC or DOCX, up to 10 MB.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {upload.shown && (
          <div className="space-y-3 rounded-lg border p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`${formId}-file`}>File</Label>
                <Input
                  id={`${formId}-file`}
                  ref={fileInput}
                  type="file"
                  accept={ACCEPTED_EXTENSIONS.join(",")}
                  disabled={Boolean(upload.disabledReason) || !resource.data || uploading}
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${formId}-label`}>Label (optional)</Label>
                <Input
                  id={`${formId}-label`}
                  value={label}
                  maxLength={255}
                  placeholder="Official receipt, bank slip, …"
                  disabled={Boolean(upload.disabledReason) || uploading}
                  onChange={(e) => setLabel(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p id={`${formId}-count`} className="text-xs text-muted-foreground">
                {upload.countText}
                {upload.disabledReason && ` · ${upload.disabledReason}`}
              </p>
              <Button
                size="sm"
                aria-describedby={`${formId}-count`}
                disabled={!file || Boolean(upload.disabledReason) || uploading}
                onClick={submitUpload}
              >
                <Upload className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                {uploading ? "Uploading…" : "Upload"}
              </Button>
            </div>
          </div>
        )}

        <DataState
          resource={resource}
          endpoints={[
            kind === "journal"
              ? API_ENDPOINTS.ACCOUNTING.JOURNAL_ATTACHMENTS(id)
              : API_ENDPOINTS.ACCOUNTING.EXPENSE_ATTACHMENTS(id),
          ]}
          summary="The files attached to this record."
          isEmpty={(data) => data.length === 0}
          emptyMessage="No attachments yet."
        >
          {(data) => (
            <AttachmentRows
              attachments={data}
              onOpen={openFresh}
              onRemove={setRemoving}
              removeBlockedReason={removeBlockedReason(owner)}
            />
          )}
        </DataState>
      </CardContent>

      <AttachmentRemoveDialog
        attachment={removing}
        needsReason={removalNeedsReason(owner)}
        onClose={() => setRemoving(null)}
        validateReason={(reason) => reasonError(reason, removalNeedsReason(owner))}
        onRemove={(attachment, reason) => bound.remove(attachment.id, removalReason(owner, reason))}
        failure={removalFailure}
        onDone={() => resource.refetch()}
      />
    </Card>
  );
}
