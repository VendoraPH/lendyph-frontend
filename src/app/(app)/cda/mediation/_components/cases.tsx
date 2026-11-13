"use client";

import { useCallback } from "react";
import { useApiResource } from "@/hooks";
import { cdaService, type CdaMediationCaseInput } from "@/services/cda.service";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { formatDate } from "@/lib/format";
import type { CdaMediationCase } from "@/types/cda";
import { AttachButton, useAttachDocument } from "../../_components/attach-document";
import { RegisterDocumentsLink } from "../../_components/register-documents-link";
import { RegisterTable, type RegisterColumn } from "../../_components/register-table";
import { ToneBadge } from "../../_components/tone-badge";
import { HALF_LABELS, MEDIATION_STATUS_META, labelOf, toOptions } from "../../_lib/labels";
import type { RecordField, RecordValues } from "../../_lib/record-form";

const FIELDS: RecordField[] = [
  { key: "filed_on", label: "Filed on", type: "date", required: true },
  { key: "status", label: "Status", type: "select", required: true, options: toOptions(MEDIATION_STATUS_META) },
  { key: "complainant", label: "Complainant", type: "text" },
  { key: "respondent", label: "Respondent", type: "text" },
  { key: "nature", label: "Nature of the dispute", type: "text" },
  { key: "mediator", label: "Mediator or conciliator", type: "text" },
  { key: "mediation_started_on", label: "Mediation started", type: "date" },
  { key: "meetings_count", label: "Meetings held", type: "number" },
  {
    key: "resolved_on",
    label: "Closed on",
    type: "date",
    help: "Needed once the case is resolved, escalated or withdrawn.",
  },
  { key: "resolution", label: "Resolution", type: "textarea" },
  { key: "description", label: "Description", type: "textarea" },
  { key: "remarks", label: "Remarks", type: "textarea" },
];

const COLUMNS: RegisterColumn<CdaMediationCase>[] = [
  { header: "Case", cell: (r) => <span className="font-medium">{r.case_number}</span> },
  { header: "Filed", cell: (r) => formatDate(r.filed_on) },
  {
    header: "Reported in",
    cell: (r) => r.halves.map((h) => labelOf(HALF_LABELS, h)).join(" and ") || "—",
  },
  {
    header: "Parties",
    cell: (r) => (
      <div className="text-xs">
        <p>Complainant: {r.complainant ?? "—"}</p>
        <p>Respondent: {r.respondent ?? "—"}</p>
      </div>
    ),
  },
  { header: "Nature", cell: (r) => r.nature ?? "—" },
  {
    header: "Status",
    cell: (r) => {
      const meta = MEDIATION_STATUS_META[r.status] ?? { label: "Other", tone: "neutral" as const };
      return <ToneBadge tone={meta.tone} label={meta.label} />;
    },
  },
  { header: "Closed", cell: (r) => (r.resolved_on ? formatDate(r.resolved_on) : "—") },
];

/**
 * The year's mediation cases. A case belongs to each half it overlaps, as the
 * server works out (`halves`); the case number is the server's. Case details
 * are confidential: this page needs `cda:view_mediation`.
 */
export function MediationCases({ year, onChanged }: { year: number; onChanged: () => void }) {
  const resource = useApiResource(useCallback(() => cdaService.listMediationCases(year), [year]));
  const asCase = (v: RecordValues) => v as CdaMediationCaseInput;
  const attach = useAttachDocument(year, resource.refetch);
  return (
    <>
      <RegisterTable<CdaMediationCase>
        title={`Mediation and conciliation cases, ${year}`}
        description="A case filed in one half and still open in the next is reported in both."
        noun={["case", "cases"]}
        resource={resource}
        endpoints={[`GET ${API_ENDPOINTS.CDA.MEDIATION_CASES(year)}`]}
        columns={COLUMNS}
        fields={FIELDS}
        defaults={{ status: "pending", meetings_count: "0" }}
        permission="cda:manage_mediation"
        onCreate={(v) => cdaService.createMediationCase(year, asCase(v)).then(onChanged)}
        onUpdate={(id, v) => cdaService.updateMediationCase(id, asCase(v)).then(onChanged)}
        onDelete={(id) => cdaService.deleteMediationCase(id).then(onChanged)}
        rowActions={(r) => (
          <>
            <RegisterDocumentsLink
              subject={{ type: "case", id: r.id }}
              year={year}
              count={r.documents_count}
              name={`Case ${r.case_number}`}
            />
            <AttachButton subject={{ type: "case", id: r.id, name: `Case ${r.case_number}` }} onAttach={attach.open} />
          </>
        )}
      />
      {attach.dialog}
    </>
  );
}
