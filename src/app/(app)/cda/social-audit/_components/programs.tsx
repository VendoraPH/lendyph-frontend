"use client";

import { useCallback, useMemo } from "react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiResource } from "@/hooks";
import { cdaService, type CdaSocialProgramInput } from "@/services/cda.service";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { formatDate } from "@/lib/format";
import type { CdaSocialProgram, CdaSocialTotals } from "@/types/cda";
import { AttachButton, useAttachDocument } from "../../_components/attach-document";
import { RegisterTable, type RegisterColumn } from "../../_components/register-table";
import { FUNDING_SOURCE_LABELS, SOCIAL_CATEGORY_LABELS, SOCIAL_STATUS_LABELS, labelOf, toOptions } from "../../_lib/labels";
import { cdaCount, cdaMoney } from "../../_lib/money";
import type { RecordField, RecordValues } from "../../_lib/record-form";
import { officerIdOf, officerOptions } from "../../_lib/screen-gaps";

/** A program as the form reads it: the server's responsible officer, by id. */
type ProgramRow = CdaSocialProgram & { responsible_officer_id: number | null };

const FIELDS: RecordField[] = [
  { key: "name", label: "Program", type: "text", required: true },
  { key: "category", label: "Category", type: "select", required: true, options: toOptions(SOCIAL_CATEGORY_LABELS) },
  { key: "status", label: "Status", type: "select", required: true, options: toOptions(SOCIAL_STATUS_LABELS) },
  { key: "held_on", label: "Held on", type: "date" },
  { key: "ended_on", label: "Ended on", type: "date" },
  { key: "location", label: "Location", type: "text" },
  { key: "target_beneficiaries", label: "Target beneficiaries", type: "number" },
  { key: "actual_beneficiaries", label: "Actual beneficiaries", type: "number" },
  { key: "budget", label: "Budget (₱)", type: "money" },
  { key: "actual_expense", label: "Actual expense (₱)", type: "money" },
  { key: "funding_source", label: "Funding source", type: "select", options: toOptions(FUNDING_SOURCE_LABELS) },
  {
    key: "cdf_amount",
    label: "From the Community Development Fund (₱)",
    type: "money",
    help: "Can't be more than the actual expense.",
  },
  { key: "objective", label: "Objective", type: "textarea" },
  { key: "description", label: "Description", type: "textarea" },
  { key: "remarks", label: "Remarks", type: "textarea" },
];

const OFFICER_FIELD: RecordField = {
  key: "responsible_officer_id",
  label: "Responsible officer",
  type: "select",
  help: "From CDA › Officers, serving this year.",
};

const COLUMNS: RegisterColumn<ProgramRow>[] = [
  {
    header: "Program",
    cell: (r) => (
      <div>
        <p className="font-medium">{r.name}</p>
        <p className="text-xs text-muted-foreground">{labelOf(SOCIAL_CATEGORY_LABELS, r.category)}</p>
      </div>
    ),
  },
  { header: "Held", cell: (r) => (r.held_on ? formatDate(r.held_on) : "—") },
  { header: "Status", cell: (r) => labelOf(SOCIAL_STATUS_LABELS, r.status) },
  {
    header: "Beneficiaries (target / actual)",
    cell: (r) => `${cdaCount(r.target_beneficiaries)} / ${cdaCount(r.actual_beneficiaries)}`,
    align: "right",
  },
  { header: "Budget", cell: (r) => cdaMoney(r.budget), align: "right" },
  { header: "Actual expense", cell: (r) => cdaMoney(r.actual_expense), align: "right" },
  { header: "From the CDF", cell: (r) => cdaMoney(r.cdf_amount), align: "right" },
  { header: "Funding", cell: (r) => labelOf(FUNDING_SOURCE_LABELS, r.funding_source) },
  { header: "Responsible officer", cell: (r) => r.responsible_officer?.name ?? "—" },
];

/** Money stays as typed; a blank expense or CDF figure is left for the server's ₱0.00 default. */
function asProgram(values: RecordValues): CdaSocialProgramInput {
  const input = { ...(values as CdaSocialProgramInput) };
  if ("responsible_officer_id" in values) input.responsible_officer_id = officerIdOf(values.responsible_officer_id);
  if (values.actual_expense === null) delete input.actual_expense;
  if (values.cdf_amount === null) delete input.cdf_amount;
  return input;
}

function Totals({ totals }: { totals: CdaSocialTotals }) {
  const cards: [string, string][] = [
    ["Programs held", cdaCount(totals.count)],
    ["Beneficiaries", cdaCount(totals.beneficiaries)],
    ["Budget", cdaMoney(totals.budget)],
    ["Actual expense", cdaMoney(totals.actual_expense)],
    ["From the CDF", cdaMoney(totals.cdf_amount)],
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map(([label, value]) => (
        <Card key={label}>
          <CardHeader>
            <CardDescription>{label}</CardDescription>
            <CardTitle className="text-lg tabular-nums">{value}</CardTitle>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}

/**
 * The year's social programs, with the server's totals over ongoing and
 * completed ones. The responsible officer is picked from the officers serving
 * that year (cda:view lists them); until that list loads the form leaves out
 * the pick, so a save never clears it.
 */
export function SocialPrograms({ year, onChanged }: { year: number; onChanged: () => void }) {
  const resource = useApiResource(
    useCallback(
      () =>
        cdaService.listSocialPrograms(year).then((result) => ({
          ...result,
          rows: result.rows.map((p): ProgramRow => ({ ...p, responsible_officer_id: p.responsible_officer?.id ?? null })),
        })),
      [year],
    ),
  );
  const officers = useApiResource(useCallback(() => cdaService.listOfficers({ year }), [year]));
  const changed = () => onChanged();
  const attach = useAttachDocument(year);

  const fields = useMemo(() => {
    if (!officers.data) return FIELDS;
    const chosen = (resource.data?.rows ?? []).flatMap((r) => (r.responsible_officer ? [r.responsible_officer] : []));
    const officerField = { ...OFFICER_FIELD, options: officerOptions(officers.data.rows, chosen) };
    return [...FIELDS.slice(0, -1), officerField, ...FIELDS.slice(-1)];
  }, [officers.data, resource.data]);

  return (
    <div className="space-y-4">
      {resource.data?.totals && <Totals totals={resource.data.totals} />}
      <RegisterTable<ProgramRow>
        title={`Social programs in ${year}`}
        description="Totals count ongoing and completed programs; planned and cancelled ones are left out."
        noun={["program", "programs"]}
        resource={resource}
        endpoints={[`GET ${API_ENDPOINTS.CDA.SOCIAL_PROGRAMS(year)}`]}
        columns={COLUMNS}
        fields={fields}
        defaults={{ status: "completed" }}
        permission="cda:manage_social"
        onCreate={(v) => cdaService.createSocialProgram(year, asProgram(v)).then(changed)}
        onUpdate={(id, v) => cdaService.updateSocialProgram(id, asProgram(v)).then(changed)}
        onDelete={(id) => cdaService.deleteSocialProgram(id).then(changed)}
        rowActions={(r) => <AttachButton subject={{ type: "program", id: r.id, name: r.name }} onAttach={attach.open} />}
      />
      {attach.dialog}
    </div>
  );
}
