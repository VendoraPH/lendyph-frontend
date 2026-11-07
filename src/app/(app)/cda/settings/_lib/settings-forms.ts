import type { CdaRegulatoryProfile, CdaSettings, CdaTemplate, CdaTemplateInput } from "@/types/cda";
import type { RecordDraft, RecordField, RecordValues } from "../../_lib/record-form";
import { REPORT_OPTIONS } from "../../_lib/labels";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
].map((label, i) => ({ value: String(i + 1), label }));

export const PROFILE_FIELDS: RecordField[] = [
  { key: "registered_name", label: "Registered name", type: "text", required: true },
  { key: "cda_registration_number", label: "CDA registration no.", type: "text", required: true },
  { key: "registration_date", label: "Registration date", type: "date" },
  { key: "tin", label: "TIN", type: "text" },
  { key: "cooperative_type", label: "Cooperative type", type: "text", placeholder: "Credit, Multipurpose…" },
  {
    key: "cooperative_category",
    label: "Category",
    type: "select",
    options: [
      { value: "micro", label: "Micro" },
      { value: "small", label: "Small" },
      { value: "medium", label: "Medium" },
      { value: "large", label: "Large" },
    ],
  },
  { key: "asset_size_class", label: "Asset size class", type: "text" },
  { key: "area_of_operation", label: "Area of operation", type: "text" },
  { key: "principal_office_address", label: "Principal office address", type: "textarea" },
  { key: "cda_extension_office", label: "CDA extension office", type: "text" },
  { key: "fiscal_year_end_month", label: "Fiscal year ends in", type: "select", required: true, options: MONTHS },
  {
    key: "cte_status",
    label: "Certificate of Tax Exemption",
    type: "select",
    required: true,
    options: [
      { value: "yes", label: "Valid CTE" },
      { value: "pending", label: "Application pending" },
      { value: "expired", label: "Expired" },
      { value: "no", label: "None" },
    ],
  },
  { key: "cte_number", label: "CTE number", type: "text" },
  { key: "cte_expiry", label: "CTE expiry", type: "date" },
  { key: "bir_rdo", label: "BIR RDO", type: "text" },
  { key: "external_auditor", label: "External auditor", type: "text" },
  { key: "external_auditor_accreditation", label: "Auditor CDA accreditation no.", type: "text" },
  { key: "chairperson", label: "Chairperson", type: "text" },
  { key: "general_manager", label: "General manager", type: "text" },
  { key: "treasurer", label: "Treasurer", type: "text" },
  { key: "secretary", label: "Secretary", type: "text" },
  { key: "compliance_officer", label: "Compliance officer", type: "text" },
  { key: "contact_email", label: "Contact email", type: "text" },
  { key: "contact_phone", label: "Contact phone", type: "text" },
];

const NULLABLE_PROFILE_KEYS = new Set(["registration_date", "cte_expiry"]);

/** Form values → profile. Blank text is "", blank dates are null. */
export function toProfile(values: RecordValues): CdaRegulatoryProfile {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    if (key === "fiscal_year_end_month") out[key] = Number(value ?? 12);
    else out[key] = value ?? (NULLABLE_PROFILE_KEYS.has(key) ? null : "");
  }
  return out as unknown as CdaRegulatoryProfile;
}

/** "30, 15, 7" → [30, 15, 7], dropping anything that is not a whole positive number. */
export function parseDayList(raw: string): number[] {
  const days = raw
    .split(/[\s,]+/)
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);
  return [...new Set(days)].sort((a, b) => b - a);
}

/** "a, b" → ["a", "b"], trimmed, blanks dropped. */
export function parseList(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function settingsToDraft(s: CdaSettings): RecordDraft {
  return {
    deadline_days: String(s.deadline_days),
    reminder_days: s.reminder_days.join(", "),
    notify_roles: s.notify_roles.join(", "),
  };
}

export const TEMPLATE_FIELDS: RecordField[] = [
  { key: "report_type", label: "Report", type: "select", required: true, options: REPORT_OPTIONS },
  { key: "name", label: "Name", type: "text", required: true },
  { key: "version", label: "Version", type: "text", required: true, placeholder: "2026.1" },
  {
    key: "status",
    label: "Status",
    type: "select",
    required: true,
    options: [
      { value: "draft", label: "Draft" },
      { value: "active", label: "Active" },
      { value: "retired", label: "Retired" },
    ],
  },
  { key: "effective_from", label: "Effective from", type: "date", required: true },
  { key: "effective_until", label: "Effective until", type: "date" },
  { key: "cooperative_types", label: "Cooperative types (comma-separated; blank = all)", type: "text" },
  { key: "asset_classes", label: "Asset classes (comma-separated; blank = all)", type: "text" },
  { key: "definition", label: "Definition (JSON)", type: "textarea" },
];

export function templateToDraft(t: CdaTemplate | null): RecordDraft {
  if (!t) return { status: "draft", definition: "{\n  \"sections\": []\n}" };
  return {
    report_type: t.report_type,
    name: t.name,
    version: t.version,
    status: t.status,
    effective_from: t.effective_from,
    effective_until: t.effective_until ?? "",
    cooperative_types: t.cooperative_types.join(", "),
    asset_classes: t.asset_classes.join(", "),
    definition: JSON.stringify(t.definition, null, 2),
  };
}

/** Draft → template input, or an error message when the JSON does not parse to an object. */
export function draftToTemplate(d: RecordDraft): CdaTemplateInput | string {
  let definition: unknown;
  try {
    definition = JSON.parse(d.definition || "{}");
  } catch {
    return "The definition is not valid JSON.";
  }
  if (!definition || typeof definition !== "object" || Array.isArray(definition)) {
    return "The definition must be a JSON object.";
  }
  return {
    report_type: d.report_type as CdaTemplateInput["report_type"],
    name: d.name.trim(),
    version: d.version.trim(),
    status: d.status as CdaTemplateInput["status"],
    effective_from: d.effective_from,
    effective_until: d.effective_until || null,
    cooperative_types: parseList(d.cooperative_types ?? ""),
    asset_classes: parseList(d.asset_classes ?? ""),
    definition: definition as Record<string, unknown>,
  };
}
