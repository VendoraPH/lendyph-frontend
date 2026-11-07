"use client";

import { useCallback, useState } from "react";
import { FileText, History, Upload } from "lucide-react";
import { RouteGuard } from "@/components/common";
import { PermissionButton } from "@/components/common/permission-button";
import { Button } from "@/components/ui/button";
import { useApiResource } from "@/hooks";
import { cdaService } from "@/services";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { notifyError, notifySuccess } from "@/lib/notify";
import { formatDateTime } from "@/lib/format";
import type { CdaComplianceDocument, CdaDocumentCategory, CdaReportType } from "@/types/cda";
import { CdaPageHeader } from "../_components/cda-page-header";
import { RecordFormDialog } from "../_components/record-form-dialog";
import { RegisterTable, type RegisterColumn } from "../_components/register-table";
import { useCdaYear } from "../_hooks/use-cda-year";
import { DOCUMENT_CATEGORY, REPORT_META, REPORT_OPTIONS, toOptions } from "../_lib/labels";
import type { RecordField } from "../_lib/record-form";
import { DocumentVersionsDialog } from "./_components/document-versions-dialog";

const FILE_ACCEPT = "application/pdf,image/*,.doc,.docx,.xls,.xlsx";

const FIELDS: RecordField[] = [
  { key: "title", label: "Title", type: "text", required: true },
  { key: "category", label: "Category", type: "select", required: true, options: toOptions(DOCUMENT_CATEGORY) },
  { key: "report_type", label: "Report", type: "select", options: REPORT_OPTIONS },
  { key: "notes", label: "Notes", type: "textarea" },
];

const VERSION_FIELDS: RecordField[] = [{ key: "notes", label: "What changed", type: "textarea" }];

const COLUMNS: RegisterColumn<CdaComplianceDocument>[] = [
  { header: "Title", cell: (r) => r.title },
  { header: "Category", cell: (r) => DOCUMENT_CATEGORY[r.category] },
  { header: "Report", cell: (r) => (r.report_type ? REPORT_META[r.report_type].title : "—") },
  { header: "Version", cell: (r) => `v${r.current_version.version} of ${r.version_count}`, align: "right" },
  {
    header: "Uploaded",
    cell: (r) => `${r.current_version.uploaded_by} · ${formatDateTime(r.current_version.uploaded_at)}`,
  },
];

function Documents() {
  const year = useCdaYear();
  const resource = useApiResource(useCallback(() => cdaService.listDocuments(year), [year]));
  const [history, setHistory] = useState<CdaComplianceDocument | null>(null);
  const [revising, setRevising] = useState<CdaComplianceDocument | null>(null);

  function uploadVersion(file: File | null, notes: string | null): Promise<unknown> {
    if (!revising || !file) return Promise.reject(new Error("No file"));
    return cdaService
      .uploadDocumentVersion(revising.id, file, notes ?? undefined)
      .then(() => {
        notifySuccess("New version uploaded");
        resource.refetch();
      })
      .catch((err: unknown) => {
        notifyError(err, "Could not upload the new version");
        throw err;
      });
  }

  return (
    <div className="space-y-6">
      <CdaPageHeader
        title="Compliance Documents"
        description="Signed reports, audit reports, minutes and certificates. Each upload is kept as a version."
      />
      <RegisterTable<CdaComplianceDocument>
        title="Documents"
        noun={["document", "documents"]}
        resource={resource}
        endpoints={[`GET ${API_ENDPOINTS.CDA.DOCUMENTS(year)}`]}
        columns={COLUMNS}
        fields={FIELDS}
        permission="cda:upload"
        file={{ label: "File", required: true, accept: FILE_ACCEPT }}
        onCreate={(v, file) =>
          file
            ? cdaService.uploadDocument(
                year,
                {
                  title: String(v.title),
                  category: v.category as CdaDocumentCategory,
                  report_type: (v.report_type as CdaReportType | null) ?? null,
                  notes: v.notes ? String(v.notes) : undefined,
                },
                file,
              )
            : Promise.reject(new Error("No file"))
        }
        rowActions={(r) => (
          <>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Open current version"
              nativeButton={false}
              render={<a href={r.current_version.file_url} target="_blank" rel="noreferrer" />}
            >
              <FileText className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Version history" onClick={() => setHistory(r)}>
              <History className="h-4 w-4" />
            </Button>
            <PermissionButton
              permission="cda:upload"
              variant="ghost"
              size="icon-sm"
              aria-label="Upload new version"
              onClick={() => setRevising(r)}
            >
              <Upload className="h-4 w-4" />
            </PermissionButton>
          </>
        )}
      />
      <DocumentVersionsDialog document={history} onOpenChange={(open) => !open && setHistory(null)} />
      <RecordFormDialog
        open={revising !== null}
        onOpenChange={(open) => !open && setRevising(null)}
        title="Upload new version"
        description={revising?.title}
        fields={VERSION_FIELDS}
        file={{ label: "File", required: true, accept: FILE_ACCEPT }}
        onSubmit={(v, file) => uploadVersion(file, v.notes ? String(v.notes) : null)}
      />
    </div>
  );
}

export default function Page() {
  return (
    <RouteGuard permission="cda:view" pageName="Compliance Documents">
      <Documents />
    </RouteGuard>
  );
}
