"use client";

import { useCallback, useState } from "react";
import { Paperclip } from "lucide-react";
import { PermissionButton } from "@/components/common/permission-button";
import { useApiResource, usePermission } from "@/hooks";
import { cdaService, type CdaDocumentSubjectType } from "@/services/cda.service";
import { notifyError, notifySuccess } from "@/lib/notify";
import type { Permission } from "@/types";
import type { RecordValues } from "../_lib/record-form";
import { attachThenReload } from "../_lib/register-documents";
import {
  attachCategories,
  attachDefaults,
  reportOptions,
  toUpload,
  uploadCategories,
  uploadFields,
  type DocumentSubject,
} from "../documents/_lib/document-form";
import { CDA_FILE_ACCEPT, RecordFormDialog } from "./record-form-dialog";

/** What the server asks on top of `cda:upload` for a register's document (`DocumentRepository::writePermissionFor`). */
const REGISTER_WRITE: Record<CdaDocumentSubjectType, Permission | null> = {
  training: "cda:manage_officers",
  program: null,
  case: "cda:manage_mediation",
};

export interface AttachSubject extends DocumentSubject {
  /** How the row reads in the dialog ("Basic cooperative course"). */
  name: string;
}

/** A register row's Attach action: disabled, with the reason, without `cda:upload` or the register's write permission. */
export function AttachButton({ subject, onAttach }: { subject: AttachSubject; onAttach: (subject: AttachSubject) => void }) {
  const { can } = usePermission();
  const write = REGISTER_WRITE[subject.type];
  const missing = !can("cda:upload") ? "cda:upload" : write && !can(write) ? write : null;
  return (
    <PermissionButton
      permission={missing ?? "cda:upload"}
      variant="ghost"
      size="icon-sm"
      aria-label={`Attach a document to ${subject.name}`}
      onClick={() => onAttach(subject)}
    >
      <Paperclip className="h-4 w-4" />
    </PermissionButton>
  );
}

/** The upload form, opened on a row: the year's reports load only once it opens. */
function AttachForm({
  year,
  subject,
  onClose,
  onSaved,
}: {
  year: number;
  subject: AttachSubject;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const { can } = usePermission();
  const period = useApiResource(useCallback(() => cdaService.getPeriod(year), [year]));
  const fields = uploadFields(attachCategories(uploadCategories(can), subject.type), reportOptions(period.data?.reports ?? []));

  function upload(values: RecordValues, file: File | null): Promise<unknown> {
    if (!file) return Promise.reject(new Error("No file"));
    return attachThenReload(() => cdaService.uploadDocument(year, toUpload(values, subject), file), {
      notifySaved: () => notifySuccess("Document attached. It's listed under CDA › Documents."),
      notifyFailed: (err) => notifyError(err, "Could not attach the document"),
      onSaved,
    });
  }

  return (
    <RecordFormDialog
      open
      onOpenChange={(next) => !next && onClose()}
      title="Attach a document"
      description={subject.name}
      fields={fields}
      defaults={attachDefaults(subject.type)}
      file={{ label: "File", required: true, accept: CDA_FILE_ACCEPT }}
      onSubmit={upload}
    />
  );
}

/**
 * Attach on a register: one form for the whole table, opened by a row's
 * AttachButton with that row as the document's subject (`subject_type`,
 * `subject_id`). The category starts on the register's own and can be changed.
 * `onSaved` reloads the register after an upload, so the row's count updates.
 */
export function useAttachDocument(year: number, onSaved?: () => void) {
  const [subject, setSubject] = useState<AttachSubject | null>(null);
  const dialog = subject ? (
    <AttachForm
      key={`${subject.type}-${subject.id}`}
      year={year}
      subject={subject}
      onClose={() => setSubject(null)}
      onSaved={onSaved}
    />
  ) : null;
  return { open: setSubject, dialog };
}
