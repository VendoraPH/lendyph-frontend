"use client";

import { useCallback } from "react";
import { FileText } from "lucide-react";
import { RouteGuard } from "@/components/common";
import { Button } from "@/components/ui/button";
import { useApiResource } from "@/hooks";
import { cdaService } from "@/services";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { formatDate } from "@/lib/format";
import type { CdaSubmission } from "@/types/cda";
import { CdaPageHeader } from "../_components/cda-page-header";
import { RegisterTable, type RegisterColumn } from "../_components/register-table";
import { ToneBadge } from "../_components/tone-badge";
import { useCdaYear } from "../_hooks/use-cda-year";
import { REPORT_META, REPORT_OPTIONS, SUBMISSION_METHOD, SUBMISSION_STATUS, toOptions } from "../_lib/labels";
import type { RecordField } from "../_lib/record-form";

const FIELDS: RecordField[] = [
  { key: "report_type", label: "Report", type: "select", required: true, options: REPORT_OPTIONS },
  { key: "method", label: "Method", type: "select", required: true, options: toOptions(SUBMISSION_METHOD) },
  { key: "submitted_date", label: "Date submitted", type: "date" },
  { key: "status", label: "Status", type: "select", required: true, options: toOptions(SUBMISSION_STATUS) },
  { key: "reference_number", label: "Reference / acknowledgement no.", type: "text" },
  { key: "remarks", label: "Remarks", type: "textarea" },
];

const COLUMNS: RegisterColumn<CdaSubmission>[] = [
  { header: "Report", cell: (r) => REPORT_META[r.report_type].title },
  { header: "Method", cell: (r) => SUBMISSION_METHOD[r.method] },
  { header: "Submitted", cell: (r) => (r.submitted_date ? formatDate(r.submitted_date) : "—") },
  { header: "Reference", cell: (r) => r.reference_number || "—" },
  { header: "Status", cell: (r) => <ToneBadge {...SUBMISSION_STATUS[r.status]} /> },
  { header: "By", cell: (r) => r.submitted_by || "—" },
];

function Submissions() {
  const year = useCdaYear();
  const resource = useApiResource(useCallback(() => cdaService.listSubmissions(year), [year]));

  return (
    <div className="space-y-6">
      <CdaPageHeader
        title="Submission History"
        description="Where and when each report went to CDA, with the acknowledgement and CDA's response."
      />
      <RegisterTable<CdaSubmission>
        title="Submissions"
        noun={["submission", "submissions"]}
        resource={resource}
        endpoints={[`GET ${API_ENDPOINTS.CDA.SUBMISSIONS(year)}`]}
        columns={COLUMNS}
        fields={FIELDS}
        permission="cda:submit"
        file={{ label: "Proof of submission", accept: "application/pdf,image/*" }}
        onCreate={(v, file) => cdaService.createSubmission(year, v as Partial<CdaSubmission>, file)}
        onUpdate={(id, v) => cdaService.updateSubmission(id, v as Partial<CdaSubmission>)}
        rowActions={(r) =>
          r.proof_url ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Open proof"
              nativeButton={false}
              render={<a href={r.proof_url} target="_blank" rel="noreferrer" />}
            >
              <FileText className="h-4 w-4" />
            </Button>
          ) : null
        }
      />
    </div>
  );
}

export default function Page() {
  return (
    <RouteGuard permission="cda:view" pageName="Submission History">
      <Submissions />
    </RouteGuard>
  );
}
