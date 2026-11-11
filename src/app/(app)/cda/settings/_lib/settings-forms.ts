import type { CdaOfficerPosition, CdaProfileFields, CdaSettings, CdaTemplate, CdaTemplateInput } from "@/types/cda";
import {
  ASSET_CLASS_LABELS,
  COOPERATIVE_CATEGORY_LABELS,
  CTE_STATUS_LABELS,
  POSITION_LABELS,
  REPORT_TYPE_LABELS,
  toOptions,
} from "../../_lib/labels";
import { fromDraft, type RecordDraft, type RecordField } from "../../_lib/record-form";

/**
 * CDA settings forms (carried over from #510 by Augustin, on the server's
 * fields). The name, address and contact are edited in Settings › Branding;
 * here are CDA's own fields.
 */
export const PROFILE_FIELDS: RecordField[] = [
  { key: "cda_registration_no", label: "CDA registration number", type: "text" },
  { key: "cda_registration_date", label: "Registration date", type: "date" },
  { key: "previous_name", label: "Previous name", type: "text" },
  { key: "cda_region", label: "CDA region", type: "text" },
  { key: "cda_extension_office", label: "CDA extension office", type: "text" },
  { key: "cooperative_type", label: "Type of cooperative", type: "text", placeholder: "e.g. Credit" },
  { key: "cooperative_category", label: "Category", type: "select", options: toOptions(COOPERATIVE_CATEGORY_LABELS) },
  {
    key: "asset_class",
    label: "Asset size",
    type: "select",
    options: toOptions(ASSET_CLASS_LABELS),
    help: "Leave blank to use the size the total assets suggest.",
  },
  { key: "tin", label: "TIN", type: "text" },
  { key: "cte_status", label: "Certificate of Tax Exemption", type: "select", required: true, options: toOptions(CTE_STATUS_LABELS) },
  { key: "cte_number", label: "CTE number", type: "text" },
  { key: "cte_issued_on", label: "CTE issued on", type: "date" },
  { key: "cte_expires_on", label: "CTE expires on", type: "date" },
  { key: "address_line", label: "Street address", type: "text" },
  { key: "address_barangay", label: "Barangay", type: "text" },
  { key: "address_city", label: "City or municipality", type: "text" },
  { key: "address_province", label: "Province", type: "text" },
  { key: "address_region", label: "Region", type: "text" },
  { key: "phone", label: "Phone", type: "text" },
  { key: "email", label: "Email", type: "text" },
  { key: "website", label: "Website", type: "text", placeholder: "https://" },
  { key: "primary_activity", label: "Primary activity", type: "text" },
  { key: "sector", label: "Sector", type: "text" },
  { key: "subsector", label: "Subsector", type: "text" },
  { key: "satellite_offices", label: "Satellite offices", type: "number" },
];

/** The profile's body: every field, blank as null. */
export function toProfile(draft: RecordDraft): Partial<CdaProfileFields> {
  return fromDraft(PROFILE_FIELDS, draft) as Partial<CdaProfileFields>;
}

/** The pulled values' words, in the order the profile shows them. */
export const PULLED_LABELS: Record<string, string> = {
  name: "Registered name",
  address: "Address",
  contact: "Contact",
  branch_count: "Active branches",
  chairperson: "Chairperson",
  general_manager: "General Manager",
  secretary: "Secretary",
  treasurer: "Treasurer",
};

/** "30, 15, 7" → [30, 15, 7]: whole numbers only, each once, in the order typed. Anything else is left for the server to refuse. */
export function parseDayList(raw: string): number[] | null {
  const parts = raw.split(/[\s,]+/).filter(Boolean);
  if (!parts.every((p) => /^\d+$/.test(p))) return null;
  return [...new Set(parts.map((p) => Number(p)))];
}

/** "basic_coop_course, governance" → ["basic_coop_course", "governance"], trimmed, blanks dropped. */
export function parseKeyList(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export const POSITIONS = Object.keys(POSITION_LABELS) as CdaOfficerPosition[];

export interface SettingsDraft {
  annual_deadline_days: string;
  mediation_deadline_days: string;
  reminder_days: string;
  micro: string;
  small: string;
  medium: string;
  trainings: Partial<Record<CdaOfficerPosition, string>>;
}

export function settingsToDraft(s: CdaSettings): SettingsDraft {
  return {
    annual_deadline_days: String(s.annual_deadline_days),
    mediation_deadline_days: String(s.mediation_deadline_days),
    reminder_days: s.reminder_days.join(", "),
    micro: s.asset_class_thresholds.micro ?? "",
    small: s.asset_class_thresholds.small ?? "",
    medium: s.asset_class_thresholds.medium ?? "",
    trainings: Object.fromEntries(POSITIONS.map((p) => [p, (s.required_trainings[p] ?? []).join(", ")])),
  };
}

/** The settings' body, or the labels that don't read right. Amounts go as typed. */
export function draftToSettings(d: SettingsDraft): { body: Partial<Omit<CdaSettings, "updated_by" | "updated_at">> } | { invalid: string[] } {
  const invalid: string[] = [];
  const days = (raw: string, label: string) => {
    if (!/^\d+$/.test(raw.trim())) invalid.push(label);
    return Number(raw.trim());
  };
  const annual = days(d.annual_deadline_days, "Annual reports due (days after Dec 31)");
  const mediation = days(d.mediation_deadline_days, "Mediation reports due (days after each half)");
  const reminders = parseDayList(d.reminder_days);
  if (reminders === null) invalid.push("Reminder days");
  if ([d.micro, d.small, d.medium].some((v) => v.trim() === "")) invalid.push("Asset size bounds");
  if (invalid.length > 0) return { invalid };

  const required: Partial<Record<CdaOfficerPosition, string[]>> = {};
  for (const position of POSITIONS) {
    const keys = parseKeyList(d.trainings[position] ?? "");
    if (keys.length > 0) required[position] = keys;
  }
  return {
    body: {
      annual_deadline_days: annual,
      mediation_deadline_days: mediation,
      reminder_days: reminders ?? [],
      asset_class_thresholds: { micro: d.micro.trim(), small: d.small.trim(), medium: d.medium.trim() },
      required_trainings: required,
    },
  };
}

export const TEMPLATE_FIELDS: RecordField[] = [
  { key: "report_type", label: "Report", type: "select", required: true, options: toOptions(REPORT_TYPE_LABELS) },
  { key: "name", label: "Name", type: "text", required: true },
  { key: "version", label: "Version", type: "text", required: true, placeholder: "2026.1" },
  { key: "effective_from", label: "Effective from", type: "date", required: true },
  { key: "effective_until", label: "Effective until", type: "date" },
  { key: "cooperative_types", label: "Cooperative types (comma-separated; blank for all)", type: "text" },
  { key: "asset_classes", label: "Asset sizes (comma-separated: micro, small, medium, large; blank for all)", type: "text" },
  { key: "definition", label: "Definition (JSON)", type: "textarea" },
];

export function templateToDraft(t: CdaTemplate | null): RecordDraft {
  if (!t) return { definition: '{\n  "schema_version": 1,\n  "sections": []\n}' };
  return {
    report_type: t.report_type,
    name: t.name,
    version: t.version,
    effective_from: t.effective_from,
    effective_until: t.effective_until ?? "",
    cooperative_types: t.cooperative_types.join(", "),
    asset_classes: t.asset_classes.join(", "),
    definition: JSON.stringify(t.definition, null, 2),
  };
}

/** Draft → template body, or a message in words when the JSON isn't an object. */
export function draftToTemplate(d: RecordDraft): CdaTemplateInput | string {
  let definition: unknown;
  try {
    definition = JSON.parse(d.definition || "{}");
  } catch {
    return "The definition isn't valid JSON.";
  }
  if (!definition || typeof definition !== "object" || Array.isArray(definition)) {
    return "The definition must be a JSON object.";
  }
  return {
    report_type: d.report_type as CdaTemplateInput["report_type"],
    name: (d.name ?? "").trim(),
    version: (d.version ?? "").trim(),
    effective_from: d.effective_from ?? "",
    effective_until: d.effective_until || null,
    cooperative_types: parseKeyList(d.cooperative_types ?? ""),
    asset_classes: parseKeyList(d.asset_classes ?? "") as CdaTemplateInput["asset_classes"],
    definition: definition as Record<string, unknown>,
  };
}
