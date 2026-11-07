"use client";

import { useCallback } from "react";
import { RouteGuard } from "@/components/common";
import { useApiResource } from "@/hooks";
import { cdaService } from "@/services";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { formatCurrency, formatDate } from "@/lib/format";
import type { CdaSocialProgram } from "@/types/cda";
import { ReportWorkspace } from "../_components/report-workspace";
import { RegisterTable, type RegisterColumn } from "../_components/register-table";
import { useCdaYear } from "../_hooks/use-cda-year";
import { SOCIAL_CATEGORY, toOptions } from "../_lib/labels";
import type { RecordField } from "../_lib/record-form";

const FIELDS: RecordField[] = [
  { key: "name", label: "Program", type: "text", required: true },
  { key: "category", label: "Category", type: "select", required: true, options: toOptions(SOCIAL_CATEGORY) },
  { key: "date", label: "Date", type: "date", required: true },
  { key: "beneficiaries", label: "Beneficiaries", type: "number", required: true },
  { key: "amount_spent", label: "Amount spent", type: "money", required: true },
  { key: "fund_source", label: "Fund source", type: "text", placeholder: "e.g. Community Development Fund" },
  { key: "description", label: "Description", type: "textarea" },
];

const COLUMNS: RegisterColumn<CdaSocialProgram>[] = [
  { header: "Program", cell: (r) => r.name },
  { header: "Category", cell: (r) => SOCIAL_CATEGORY[r.category] },
  { header: "Date", cell: (r) => formatDate(r.date) },
  { header: "Beneficiaries", cell: (r) => r.beneficiaries, align: "right" },
  { header: "Amount", cell: (r) => formatCurrency(r.amount_spent), align: "right" },
  { header: "Fund source", cell: (r) => r.fund_source || "—" },
];

function SocialPrograms() {
  const year = useCdaYear();
  const fetcher = useCallback(() => cdaService.listSocialPrograms(year), [year]);
  const resource = useApiResource(fetcher);

  return (
    <RegisterTable<CdaSocialProgram>
      title="Social programs"
      description="Activities funded by the Community Development Fund and other social funds this year."
      noun={["program", "programs"]}
      resource={resource}
      endpoints={[`GET ${API_ENDPOINTS.CDA.SOCIAL_PROGRAMS(year)}`]}
      columns={COLUMNS}
      fields={FIELDS}
      permission="cda:manage_social"
      onCreate={(v) => cdaService.createSocialProgram(year, v as Partial<CdaSocialProgram>)}
      onUpdate={(id, v) => cdaService.updateSocialProgram(id, v as Partial<CdaSocialProgram>)}
      onDelete={(id) => cdaService.deleteSocialProgram(id)}
    />
  );
}

export default function Page() {
  return (
    <RouteGuard permission="cda:view" pageName="Social Audit">
      <ReportWorkspace type="social_audit">
        <SocialPrograms />
      </ReportWorkspace>
    </RouteGuard>
  );
}
