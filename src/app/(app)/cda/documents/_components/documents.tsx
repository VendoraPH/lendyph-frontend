"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Ban, FileText, History, Upload } from "lucide-react";
import { PermissionButton } from "@/components/common/permission-button";
import { Button } from "@/components/ui/button";
import { useApiResource, usePermission } from "@/hooks";
import { cdaService } from "@/services";
import type { CdaDocumentSubjectType } from "@/services/cda.service";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { formatDate, formatDateTime } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/notify";
import type { CdaDocument } from "@/types/cda";
import { ReasonDialog } from "../../_components/reason-dialog";
import { CDA_FILE_ACCEPT, RecordFormDialog } from "../../_components/record-form-dialog";
import { RegisterTable, type RegisterColumn } from "../../_components/register-table";
import { ToneBadge } from "../../_components/tone-badge";
import { DOCUMENT_CATEGORY_LABELS, labelOf, reportName } from "../../_lib/labels";
import { signedUrl } from "../../_lib/safe-url";
import { linkedDocumentSubject, subjectDocumentsParams } from "../../_lib/register-documents";
import { VERSION_FIELDS, reportOptions, toUpload, uploadCategories, uploadFields } from "../_lib/document-form";
import { DocumentVersionsDialog } from "./document-versions-dialog";

const COLUMNS: RegisterColumn<CdaDocument>[] = [
  {
    header: "Title",
    cell: (r) => (
      <div>
        <p className="font-medium">{r.title}</p>
        {r.status === "withdrawn" && (
          <p className="text-xs text-muted-foreground">
            <ToneBadge tone="neutral" label="Withdrawn" /> {r.withdraw_reason}
          </p>
        )}
      </div>
    ),
  },
  { header: "Category", cell: (r) => r.category_label || labelOf(DOCUMENT_CATEGORY_LABELS, r.category) },
  { header: "Report", cell: (r) => (r.report_type ? reportName(r.report_type, r.report_part) : "—") },
  {
    header: "Version",
    cell: (r) => (
      <div className="flex flex-wrap items-center gap-1">
        {r.current_version ? `${r.current_version.version} of ${r.version_count}` : "—"}
        {r.final_version && <ToneBadge tone="success" label="Final" />}
        {r.current_version?.is_draft && <ToneBadge tone="warning" label="DRAFT" />}
      </div>
    ),
  },
  {
    header: "Uploaded",
    cell: (r) =>
      r.current_version ? `${r.current_version.uploaded_by?.name ?? "System"} · ${formatDateTime(r.current_version.created_at)}` : "—",
  },
  { header: "Expires", cell: (r) => (r.expires_on ? formatDate(r.expires_on) : "—") },
];

/** A register row in words, for the filtered list's heading. */
const SUBJECT_NOUNS: Record<CdaDocumentSubjectType, string> = {
  training: "training",
  program: "social program",
  case: "mediation case",
};

/** Exports and withdrawn documents take no new versions. */
function canRevise(d: CdaDocument): boolean {
  return d.status === "active" && d.category !== "report_export" && d.category !== "submission_proof";
}

/**
 * The year's compliance documents, versioned (carried over from #510 by
 * Augustin). The server leaves out restricted documents the user may not see;
 * each file opens by its signed link; withdrawing keeps the files and needs a
 * reason. A register row's documents link opens it filtered to that row
 * (`?subject_type=&subject_id=`), active documents only, as the row counts them.
 */
export function Documents({ year }: { year: number }) {
  const { can } = usePermission();
  const searchParams = useSearchParams();
  const subject = useMemo(() => linkedDocumentSubject(searchParams.toString()), [searchParams]);
  const resource = useApiResource(
    useCallback(() => cdaService.listDocuments(year, subjectDocumentsParams(subject)), [year, subject]),
  );
  const period = useApiResource(useCallback(() => cdaService.getPeriod(year), [year]));
  const [history, setHistory] = useState<CdaDocument | null>(null);
  const [revising, setRevising] = useState<CdaDocument | null>(null);
  const [withdrawing, setWithdrawing] = useState<CdaDocument | null>(null);

  const fields = uploadFields(uploadCategories(can), reportOptions(period.data?.reports ?? []));

  function addVersion(values: Record<string, unknown>, file: File | null): Promise<unknown> {
    if (!revising || !file) return Promise.reject(new Error("No file"));
    return cdaService
      .addVersion(revising.id, file, {
        version_label: (values.version_label as string | null) ?? null,
        notes: (values.notes as string | null) ?? null,
        final: values.final === true,
      })
      .then(() => {
        notifySuccess("New version uploaded");
        resource.refetch();
      })
      .catch((err: unknown) => {
        notifyError(err, "Could not upload the new version");
        throw err;
      });
  }

  function withdraw(reason: string): Promise<void> {
    if (!withdrawing) return Promise.resolve();
    return cdaService
      .withdrawDocument(withdrawing.id, reason)
      .then(() => {
        notifySuccess("Document withdrawn; its files are kept");
        resource.refetch();
      })
      .catch((err: unknown) => {
        notifyError(err, "Could not withdraw the document");
        throw err;
      });
  }

  return (
    <>
      {subject && (
        <p role="status" className="flex flex-wrap items-center gap-x-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
          <span>Showing the active documents attached to one {SUBJECT_NOUNS[subject.type]}.</span>
          <Link href={`/cda/documents?year=${year}`} className="font-medium text-primary underline-offset-4 hover:underline">
            Show every document for {year}
          </Link>
        </p>
      )}
      <RegisterTable<CdaDocument>
        title={subject ? `Documents attached to this ${SUBJECT_NOUNS[subject.type]}` : `Documents for ${year}`}
        description="Signed reports, audit reports, minutes and certificates. Each upload is kept as a version."
        noun={["document", "documents"]}
        resource={resource}
        endpoints={[`GET ${API_ENDPOINTS.CDA.DOCUMENTS(year)}`]}
        columns={COLUMNS}
        fields={fields}
        permission="cda:upload"
        file={{ label: "File", required: true, accept: CDA_FILE_ACCEPT }}
        onCreate={(v, file) => (file ? cdaService.uploadDocument(year, toUpload(v), file) : Promise.reject(new Error("No file")))}
        rowActions={(r) => {
          const url = signedUrl(r.current_version?.url);
          return (
            <>
              {url && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Open the latest version"
                  nativeButton={false}
                  render={<a href={url} target="_blank" rel="noopener noreferrer" />}
                >
                  <FileText className="h-4 w-4" />
                </Button>
              )}
              <Button variant="ghost" size="icon-sm" aria-label="Versions" onClick={() => setHistory(r)}>
                <History className="h-4 w-4" />
              </Button>
              {canRevise(r) && (
                <>
                  <PermissionButton permission="cda:upload" variant="ghost" size="icon-sm" aria-label="Upload a new version" onClick={() => setRevising(r)}>
                    <Upload className="h-4 w-4" />
                  </PermissionButton>
                  <PermissionButton permission="cda:upload" variant="ghost" size="icon-sm" aria-label="Withdraw" onClick={() => setWithdrawing(r)}>
                    <Ban className="h-4 w-4 text-destructive" />
                  </PermissionButton>
                </>
              )}
            </>
          );
        }}
      />
      <DocumentVersionsDialog document={history} onOpenChange={(open) => !open && setHistory(null)} />
      <RecordFormDialog
        open={revising !== null}
        onOpenChange={(open) => !open && setRevising(null)}
        title="Upload a new version"
        description={revising?.title}
        fields={VERSION_FIELDS}
        file={{ label: "File", required: true, accept: CDA_FILE_ACCEPT }}
        onSubmit={(v, file) => addVersion(v, file)}
      />
      <ReasonDialog
        open={withdrawing !== null}
        onOpenChange={(open) => !open && setWithdrawing(null)}
        title="Withdraw this document?"
        description="It stops counting for its report. Every version is kept, and the reason is recorded."
        confirmLabel="Withdraw"
        onConfirm={withdraw}
      />
    </>
  );
}
