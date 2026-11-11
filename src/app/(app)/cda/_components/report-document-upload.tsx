"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { PermissionButton } from "@/components/common/permission-button";
import { usePermission } from "@/hooks";
import { cdaService } from "@/services";
import { notifyError, notifySuccess } from "@/lib/notify";
import type { CdaReport } from "@/types/cda";
import { documentPreset } from "../_lib/document-preset";
import { reportName } from "../_lib/labels";
import type { RecordDraft } from "../_lib/record-form";
import { toUpload, uploadCategories, uploadFields } from "../documents/_lib/document-form";
import { CDA_FILE_ACCEPT, RecordFormDialog } from "./record-form-dialog";

/**
 * Upload a document for this report from the report itself. The form starts
 * on what the open document issue needs (its category, from the report's
 * template, and a final copy); both can be changed. The report is read again
 * straight after, so an issue the upload settles (a document needed to file a
 * finalized report included) clears without a reload, and unsaved edits stay.
 */
export function ReportDocumentUpload({ report, onChange }: { report: CdaReport; onChange: (report: CdaReport) => void }) {
  const { can } = usePermission();
  const [defaults, setDefaults] = useState<RecordDraft | null>(null);
  const [preparing, setPreparing] = useState(false);
  const categories = uploadCategories(can);
  const fields = uploadFields(categories, [{ value: String(report.id), label: reportName(report.report_type, report.part) }]);

  function open() {
    setPreparing(true);
    const definition = report.template
      ? cdaService.getTemplate(report.template.id).then((t) => t.definition, () => null)
      : Promise.resolve(null);
    definition
      .then((def) => {
        const preset = documentPreset(report.issues, def);
        const offered = preset.category !== null && categories.some((c) => c.value === preset.category);
        setDefaults({
          report_id: String(report.id),
          category: offered ? (preset.category ?? "") : "",
          final: preset.final ? "1" : "",
        });
      })
      .finally(() => setPreparing(false));
  }

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
      <PermissionButton permission="cda:upload" size="sm" variant="outline" onClick={open} disabled={preparing}>
        <Upload className="mr-1 h-4 w-4" /> {preparing ? "Opening…" : "Upload a document for this report"}
      </PermissionButton>
      <RecordFormDialog
        open={defaults !== null}
        onOpenChange={(next) => !next && setDefaults(null)}
        title="Upload a document"
        description={reportName(report.report_type, report.part)}
        fields={fields}
        defaults={defaults ?? undefined}
        file={{ label: "File", required: true, accept: CDA_FILE_ACCEPT }}
        onSubmit={upload}
      />
    </>
  );
}
