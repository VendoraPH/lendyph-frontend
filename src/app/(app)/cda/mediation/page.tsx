"use client";

import { useCallback } from "react";
import { RouteGuard } from "@/components/common";
import { useApiResource } from "@/hooks";
import { cdaService } from "@/services";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { formatDate } from "@/lib/format";
import type { CdaMediationCase } from "@/types/cda";
import { ReportWorkspace } from "../_components/report-workspace";
import { RegisterTable, type RegisterColumn } from "../_components/register-table";
import { ToneBadge } from "../_components/tone-badge";
import { useCdaYear } from "../_hooks/use-cda-year";
import { MEDIATION_STATUS, toOptions } from "../_lib/labels";
import type { RecordField } from "../_lib/record-form";

const FIELDS: RecordField[] = [
  { key: "case_number", label: "Case number", type: "text", required: true },
  {
    key: "semester",
    label: "Semester",
    type: "select",
    required: true,
    options: [
      { value: "H1", label: "1st semester (Jan–Jun)" },
      { value: "H2", label: "2nd semester (Jul–Dec)" },
    ],
  },
  { key: "filed_date", label: "Date filed", type: "date", required: true },
  { key: "status", label: "Status", type: "select", required: true, options: toOptions(MEDIATION_STATUS) },
  { key: "parties", label: "Parties", type: "text", required: true },
  { key: "nature", label: "Nature of dispute", type: "text", required: true },
  { key: "mediator", label: "Mediator / conciliator", type: "text" },
  { key: "resolved_date", label: "Date resolved", type: "date" },
  { key: "remarks", label: "Remarks", type: "textarea" },
];

const COLUMNS: RegisterColumn<CdaMediationCase>[] = [
  { header: "Case", cell: (r) => r.case_number },
  { header: "Semester", cell: (r) => r.semester },
  { header: "Filed", cell: (r) => formatDate(r.filed_date) },
  { header: "Parties", cell: (r) => r.parties },
  { header: "Nature", cell: (r) => r.nature },
  { header: "Status", cell: (r) => <ToneBadge {...MEDIATION_STATUS[r.status]} /> },
  { header: "Resolved", cell: (r) => (r.resolved_date ? formatDate(r.resolved_date) : "—") },
];

function MediationCases() {
  const year = useCdaYear();
  const fetcher = useCallback(() => cdaService.listMediationCases(year), [year]);
  const resource = useApiResource(fetcher);

  return (
    <RegisterTable<CdaMediationCase>
      title="Mediation & conciliation cases"
      description="Disputes handled by the Mediation and Conciliation Committee, reported per semester."
      noun={["case", "cases"]}
      resource={resource}
      endpoints={[`GET ${API_ENDPOINTS.CDA.MEDIATION_CASES(year)}`]}
      columns={COLUMNS}
      fields={FIELDS}
      permission="cda:manage_mediation"
      onCreate={(v) => cdaService.createMediationCase(year, v as Partial<CdaMediationCase>)}
      onUpdate={(id, v) => cdaService.updateMediationCase(id, v as Partial<CdaMediationCase>)}
      onDelete={(id) => cdaService.deleteMediationCase(id)}
    />
  );
}

/** Case details are confidential, so the whole screen needs the mediation permission. */
export default function Page() {
  return (
    <RouteGuard permission="cda:manage_mediation" pageName="Mediation & Conciliation">
      <ReportWorkspace type="mediation">
        <MediationCases />
      </ReportWorkspace>
    </RouteGuard>
  );
}
