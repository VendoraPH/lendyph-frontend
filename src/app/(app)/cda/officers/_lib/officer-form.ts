import type { CdaOfficer } from "@/types/cda";
import type { CdaOfficerInput } from "@/services/cda.service";
import { OFFICER_STATUS_LABELS, POSITION_LABELS, SEX_LABELS, toOptions } from "../../_lib/labels";
import { fromDraft, type RecordDraft, type RecordField } from "../../_lib/record-form";

/** What every officer has, linked to a member or not. */
export const OFFICER_FIELDS: RecordField[] = [
  { key: "position", label: "Position", type: "select", required: true, options: toOptions(POSITION_LABELS) },
  { key: "committee", label: "Committee", type: "text", placeholder: "e.g. Audit Committee" },
  { key: "position_title", label: "Title as written", type: "text", placeholder: "e.g. Chairperson, Election Committee" },
  { key: "term_start", label: "Term start", type: "date", required: true },
  { key: "term_end", label: "Term end", type: "date" },
  { key: "election_date", label: "Election date", type: "date" },
  { key: "status", label: "Status", type: "select", required: true, options: toOptions(OFFICER_STATUS_LABELS) },
  { key: "remarks", label: "Remarks", type: "textarea" },
];

/** An officer who isn't linked to a member keeps their own name and sex. */
export const UNLINKED_FIELDS: RecordField[] = [
  { key: "name", label: "Name", type: "text", required: true },
  { key: "sex", label: "Sex", type: "select", required: true, options: toOptions(SEX_LABELS) },
];

export const OFFICER_DEFAULTS: RecordDraft = { status: "active" };

/**
 * The officer's body. A linked officer sends the member's id and no name or
 * sex (the server reads both from the member); an unlinked one sends no
 * member and its own name and sex.
 */
export function officerInput(draft: RecordDraft, memberId: number | null): CdaOfficerInput {
  const values = fromDraft(OFFICER_FIELDS, draft);
  const own = fromDraft(UNLINKED_FIELDS, draft);
  return {
    ...(values as CdaOfficerInput),
    borrower_id: memberId,
    name: memberId === null ? ((own.name as string | null) ?? null) : null,
    sex: memberId === null ? ((own.sex as CdaOfficer["sex"]) ?? null) : null,
  };
}

/** The labels a form still needs filled. */
export function officerMissing(draft: RecordDraft, linked: boolean): string[] {
  const fields = linked ? OFFICER_FIELDS : [...UNLINKED_FIELDS, ...OFFICER_FIELDS];
  return fields.filter((f) => f.required && !(draft[f.key] ?? "").trim()).map((f) => f.label);
}
