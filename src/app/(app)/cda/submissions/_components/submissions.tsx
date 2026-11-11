"use client";

import { useCallback, useState } from "react";
import { FileText, Pencil, Upload } from "lucide-react";
import { DataState } from "@/components/common/data-state";
import { PermissionButton } from "@/components/common/permission-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApiResource } from "@/hooks";
import { cdaService } from "@/services";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { formatDate } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/notify";
import type { CdaSubmission } from "@/types/cda";
import { CDA_FILE_ACCEPT, RecordFormDialog } from "../../_components/record-form-dialog";
import { ToneBadge } from "../../_components/tone-badge";
import { SUBMISSION_METHOD_LABELS, SUBMISSION_STATUS_META, labelOf, reportName } from "../../_lib/labels";
import type { RecordField, RecordValues } from "../../_lib/record-form";
import { signedUrl } from "../../_lib/safe-url";

/** The filing's references and remarks; how and when it was filed belong to the workflow. */
const EDIT_FIELDS: RecordField[] = [
  { key: "cda_reference_no", label: "CDA reference number", type: "text" },
  { key: "acknowledgment_no", label: "Acknowledgment number", type: "text" },
  { key: "submitted_by_name", label: "Filed by", type: "text" },
  { key: "remarks", label: "Remarks", type: "textarea" },
];

const PROOF_FIELDS: RecordField[] = [{ key: "notes", label: "Notes", type: "textarea" }];

function text(values: RecordValues, key: string): string | null {
  return values[key] === null || values[key] === undefined ? null : String(values[key]);
}

function SubmissionRow({ row, onEdit, onProof }: { row: CdaSubmission; onEdit: () => void; onProof: () => void }) {
  const status = SUBMISSION_STATUS_META[row.status] ?? { label: "Other", tone: "neutral" as const };
  const proof = signedUrl(row.proof?.url);
  return (
    <TableRow>
      <TableCell>
        <p className="font-medium">{reportName(row.report_type, row.part)}</p>
        {row.snapshot && <p className="text-xs text-muted-foreground">Finalized version {row.snapshot.version}</p>}
      </TableCell>
      <TableCell>{labelOf(SUBMISSION_METHOD_LABELS, row.method)}</TableCell>
      <TableCell>{row.submitted_on ? formatDate(row.submitted_on) : "—"}</TableCell>
      <TableCell className="text-xs">
        {row.cda_reference_no && <p>CDA reference: {row.cda_reference_no}</p>}
        {row.acknowledgment_no && <p>Acknowledgment: {row.acknowledgment_no}</p>}
        {!row.cda_reference_no && !row.acknowledgment_no && "—"}
      </TableCell>
      <TableCell>
        <ToneBadge tone={status.tone} label={status.label} />
      </TableCell>
      <TableCell>{row.submitted_by_name ?? row.recorded_by?.name ?? "—"}</TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          {proof && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Open the proof of submission"
              nativeButton={false}
              render={<a href={proof} target="_blank" rel="noopener noreferrer" />}
            >
              <FileText className="h-4 w-4" />
            </Button>
          )}
          <PermissionButton permission="cda:submit" variant="ghost" size="icon-sm" aria-label="Upload proof of submission" onClick={onProof}>
            <Upload className="h-4 w-4" />
          </PermissionButton>
          <PermissionButton permission="cda:submit" variant="ghost" size="icon-sm" aria-label="Edit references" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
          </PermissionButton>
        </div>
      </TableCell>
    </TableRow>
  );
}

/**
 * The year's filings with CDA (carried over from #510 by Augustin). A filing is
 * made by the report's "Record filing with CDA" step; here staff keep its
 * references and remarks and upload the proof. Filings of restricted reports
 * the user may not see are left out by the server.
 */
export function Submissions({ year }: { year: number }) {
  const resource = useApiResource(useCallback(() => cdaService.listSubmissions(year), [year]));
  const [editing, setEditing] = useState<CdaSubmission | null>(null);
  const [proofFor, setProofFor] = useState<CdaSubmission | null>(null);

  function settle(request: Promise<unknown>, done: string, failed: string): Promise<unknown> {
    return request
      .then(() => {
        notifySuccess(done);
        resource.refetch();
      })
      .catch((err: unknown) => {
        notifyError(err, failed);
        throw err;
      });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Filings for {year}</CardTitle>
        <CardDescription>Record a filing from its report once the report is finalized.</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <DataState
          resource={resource}
          endpoints={[`GET ${API_ENDPOINTS.CDA.SUBMISSIONS(year)}`]}
          summary={`The ${year} filings with CDA`}
          isEmpty={(rows) => rows.length === 0}
          emptyMessage="Nothing filed for this year yet."
        >
          {(rows) => (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Report</TableHead>
                  <TableHead>How</TableHead>
                  <TableHead>Filed on</TableHead>
                  <TableHead>References</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Filed by</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <SubmissionRow key={row.id} row={row} onEdit={() => setEditing(row)} onProof={() => setProofFor(row)} />
                ))}
              </TableBody>
            </Table>
          )}
        </DataState>
      </CardContent>

      <RecordFormDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title="Edit the filing's references"
        description={editing ? reportName(editing.report_type, editing.part) : undefined}
        fields={EDIT_FIELDS}
        record={editing}
        onSubmit={(v) =>
          editing
            ? settle(
                cdaService.updateSubmission(editing.id, {
                  cda_reference_no: text(v, "cda_reference_no"),
                  acknowledgment_no: text(v, "acknowledgment_no"),
                  submitted_by_name: text(v, "submitted_by_name"),
                  remarks: text(v, "remarks"),
                }),
                "Filing saved",
                "Could not save the filing",
              )
            : Promise.resolve()
        }
      />
      <RecordFormDialog
        open={proofFor !== null}
        onOpenChange={(open) => !open && setProofFor(null)}
        title="Upload proof of submission"
        description={proofFor ? reportName(proofFor.report_type, proofFor.part) : undefined}
        fields={PROOF_FIELDS}
        file={{ label: "Proof", required: true, accept: CDA_FILE_ACCEPT }}
        onSubmit={(v, file) =>
          proofFor && file
            ? settle(cdaService.uploadProof(proofFor.id, file, text(v, "notes")), "Proof uploaded", "Could not upload the proof")
            : Promise.reject(new Error("No file"))
        }
      />
    </Card>
  );
}
