import { FUNDING_SOURCE_LABELS, SOCIAL_CATEGORY_LABELS, SOCIAL_STATUS_LABELS, toOptions } from "../../_lib/labels";
import type { RecordField } from "../../_lib/record-form";
import type { RecordStepGroup } from "../../_lib/record-steps";

/** A social program's fields, in the form's order. */
export const PROGRAM_FIELDS: RecordField[] = [
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

/** The responsible officer, offered once the year's officers load. */
export const PROGRAM_OFFICER_FIELD: RecordField = {
  key: "responsible_officer_id",
  label: "Responsible officer",
  type: "select",
  help: "From CDA › Officers, serving this year.",
};

/** The form's fields: the officer, when given, just before Remarks. */
export function programFields(officerField: RecordField | null): RecordField[] {
  if (!officerField) return PROGRAM_FIELDS;
  return [...PROGRAM_FIELDS.slice(0, -1), officerField, ...PROGRAM_FIELDS.slice(-1)];
}

/** Three steps, each fitting the dialog at 1366 x 768. */
export const PROGRAM_STEPS: RecordStepGroup[] = [
  {
    id: "program",
    title: "Program",
    fields: ["name", "category", "status", "held_on", "ended_on", "location", "target_beneficiaries", "actual_beneficiaries"],
  },
  {
    id: "funding",
    title: "Funding and objective",
    fields: ["budget", "actual_expense", "funding_source", "cdf_amount", "objective"],
  },
  { id: "details", title: "Description and remarks", fields: ["description", "responsible_officer_id", "remarks"] },
];
