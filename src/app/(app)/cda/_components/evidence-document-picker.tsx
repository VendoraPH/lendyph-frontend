"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { PermissionButton } from "@/components/common/permission-button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { usePermission } from "@/hooks";
import { cdaService } from "@/services";
import { notifyError, notifySuccess } from "@/lib/notify";
import type { CdaEvidence } from "@/types/cda";
import { reportName } from "../_lib/labels";
import type { RecordValues } from "../_lib/record-form";
import { GAP_PERMISSIONS, documentIdOf, evidenceDocumentOptions, evidenceUploadDefaults } from "../_lib/screen-gaps";
import { toUpload, uploadCategories, uploadFields } from "../documents/_lib/document-form";
import { UPLOAD_FILE_KEY, UPLOAD_STEPS } from "../documents/_lib/upload-steps";
import { useEvidenceDocuments, type EvidenceDocuments } from "./evidence-documents";
import { CDA_FILE_ACCEPT, RecordFormDialog } from "./record-form-dialog";

/**
 * The documents register's upload form, opened on an evidence entry: the new
 * document is filed under Compliance Documents, then linked to the entry. The
 * link is an unsaved edit, kept when the report is saved.
 */
function UploadAndLink({
  docs,
  entry,
  name,
  onClose,
  onLink,
}: {
  docs: EvidenceDocuments;
  entry: CdaEvidence;
  name: string;
  onClose: () => void;
  onLink: (documentId: number) => void;
}) {
  const { can } = usePermission();
  const { report } = docs;
  const fields = uploadFields(uploadCategories(can), [
    { value: String(report.id), label: reportName(report.report_type, report.part) },
  ]);

  function upload(values: RecordValues, file: File | null): Promise<unknown> {
    if (!file) return Promise.reject(new Error("No file"));
    return cdaService.uploadDocument(report.year, toUpload(values), file).then(
      (document) => {
        onLink(document.id);
        docs.reload();
        notifySuccess("Document uploaded and linked. Save the report to keep the link.");
      },
      (err: unknown) => {
        notifyError(err, "Could not upload the document");
        throw err;
      },
    );
  }

  return (
    <RecordFormDialog
      open
      onOpenChange={(next) => !next && onClose()}
      title="Upload and link a document"
      description={`${name}: filed under CDA › Documents, then linked here.`}
      fields={fields}
      defaults={evidenceUploadDefaults(report, entry)}
      file={{ label: "File", required: true, accept: CDA_FILE_ACCEPT, key: UPLOAD_FILE_KEY }}
      steps={UPLOAD_STEPS}
      onSubmit={upload}
    />
  );
}

/**
 * An evidence entry's Compliance Document: one of the year's, picked by
 * title, or a new one uploaded and linked. The list reads as the documents
 * register's does (cda:view); Upload and link needs its Upload's cda:upload.
 */
export function EvidenceDocumentPicker({
  entry,
  name,
  onLink,
}: {
  entry: CdaEvidence;
  /** The entry in words, for screen readers ("Board of Directors evidence 2"). */
  name: string;
  onLink: (documentId: number | null) => void;
}) {
  const docs = useEvidenceDocuments();
  const [uploading, setUploading] = useState(false);
  if (!docs) return null;

  const prompt = docs.documents ? "No document linked" : docs.failed ? "Documents couldn't be loaded" : "Loading documents…";
  return (
    <div className="flex flex-wrap gap-2">
      <NativeSelect
        aria-label={`${name} document`}
        className="min-w-48 flex-1"
        value={typeof entry.document_id === "number" ? String(entry.document_id) : ""}
        onChange={(e) => onLink(documentIdOf(e.target.value))}
        disabled={docs.documents === null}
      >
        <NativeSelectOption value="">{prompt}</NativeSelectOption>
        {evidenceDocumentOptions(docs.documents, entry.document_id).map((o) => (
          <NativeSelectOption key={o.value} value={o.value}>
            {o.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <PermissionButton
        permission={GAP_PERMISSIONS.evidenceUpload}
        variant="outline"
        aria-label={`Upload and link a document for ${name}`}
        onClick={() => setUploading(true)}
      >
        <Upload className="h-4 w-4" aria-hidden="true" />
        Upload and link
      </PermissionButton>
      {uploading && (
        <UploadAndLink docs={docs} entry={entry} name={name} onClose={() => setUploading(false)} onLink={onLink} />
      )}
    </div>
  );
}
