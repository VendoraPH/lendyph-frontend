"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { PermissionButton } from "@/components/common/permission-button";
import { usePermission } from "@/hooks";
import { cdaService } from "@/services";
import { notifyError, notifySuccess } from "@/lib/notify";
import type { CdaReport } from "@/types/cda";
import { reportName } from "../_lib/labels";
import { toUpload, uploadCategories, uploadFields } from "../documents/_lib/document-form";
import { CDA_FILE_ACCEPT, RecordFormDialog } from "./record-form-dialog";

/**
 * Upload a document for this report from the report itself. The report is
 * read again straight after, so an issue the upload settles (a document
 * needed to file a finalized report included) clears without a reload, and
 * unsaved edits stay.
 */
export function ReportDocumentUpload({ report, onChange }: { report: CdaReport; onChange: (report: CdaReport) => void }) {
  const { can } = usePermission();
  const [open, setOpen] = useState(false);
  const fields = uploadFields(uploadCategories(can), [{ value: String(report.id), label: reportName(report.report_type, report.part) }]);

  function upload(values: Record<string, string | number | boolean | null>, file: File | null): Promise<unknown> {
    if (!file) return Promise.reject(new Error("No file"));
    return cdaService
      .uploadDocument(report.year, toUpload(values), file)
      .then(() => {
        notifySuccess("Document uploaded");
        return cdaService.getReport(report.id).then(onChange);
      })
      .catch((err: unknown) => {
        notifyError(err, "Could not upload the document");
        throw err;
      });
  }

  return (
    <>
      <PermissionButton permission="cda:upload" size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Upload className="mr-1 h-4 w-4" /> Upload a document for this report
      </PermissionButton>
      <RecordFormDialog
        open={open}
        onOpenChange={setOpen}
        title="Upload a document"
        description={reportName(report.report_type, report.part)}
        fields={fields}
        defaults={{ report_id: String(report.id) }}
        file={{ label: "File", required: true, accept: CDA_FILE_ACCEPT }}
        onSubmit={upload}
      />
    </>
  );
}
