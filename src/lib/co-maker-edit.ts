import type { UpdateCoMakerData } from "@/services/co-maker.service";
import type { CoMaker, CoMakerRelationship, ValidIdType } from "@/types";

/**
 * The co-maker dialog's fields, as the form holds them.
 *
 * `valid_id_type`, `valid_id_number`, `valid_id_photo`, `photo` and `loan_id`
 * are here because the form renders them, not because they are saved: the
 * `co_makers` table has no such columns and neither co-maker request validates
 * them. No payload carries them — see `coMakerUpdatePayload`.
 */
export interface CoMakerFormData {
  first_name: string;
  middle_name: string;
  last_name: string;
  suffix: string;
  relationship: CoMakerRelationship | "";
  phone: string;
  address: string;
  occupation: string;
  employer: string;
  monthly_income: string;
  valid_id_type: ValidIdType | "";
  valid_id_number: string;
  valid_id_photo: string | undefined;
  photo: string | undefined;
  loan_id: number | "";
}

/**
 * Fill the form from a co-maker as the API returns it.
 *
 * The API sends the name in parts, and a part with no value arrives as `null`
 * — "no middle name", not "unknown". This used to read each part with `??`,
 * which cannot tell the two apart, so a null middle name fell through to
 * splitting `full_name` on spaces: "Juan Dela Cruz" pre-filled Middle Name
 * with "Dela", "Juan Santos Jr." with "Santos". That stayed invisible only
 * while the edit never sent `middle_name`. Now that it does, an untouched Save
 * would write the guess back — so `full_name` is split only for a record that
 * carries no name parts at all.
 */
export function coMakerToForm(cm: CoMaker): CoMakerFormData {
  const hasNameParts = cm.first_name != null || cm.last_name != null;
  const parts = (cm.full_name ?? "").split(" ");
  return {
    first_name: hasNameParts ? (cm.first_name ?? "") : (parts[0] ?? ""),
    middle_name: hasNameParts
      ? (cm.middle_name ?? "")
      : parts.length > 2
        ? parts.slice(1, -1).join(" ")
        : "",
    last_name: hasNameParts
      ? (cm.last_name ?? "")
      : parts.length > 1
        ? parts[parts.length - 1]!
        : "",
    suffix: cm.suffix ?? "",
    relationship: (cm.relationship_to_borrower ?? cm.relationship ?? "") as CoMakerRelationship | "",
    phone: cm.contact_number ?? cm.phone ?? "",
    address: cm.address ?? "",
    occupation: cm.occupation ?? "",
    employer: cm.employer ?? "",
    monthly_income: cm.monthly_income?.toString() ?? "",
    valid_id_type: cm.valid_id_type ?? "",
    valid_id_number: cm.valid_id_number ?? "",
    valid_id_photo: cm.valid_id_photo,
    photo: cm.photo,
    loan_id: cm.loan_id ?? "",
  };
}

/**
 * Every column the edit form owns — each one present, none `undefined`. The
 * payload below is checked against this, so leaving a key out, sending
 * `undefined`, or adding a key the API does not know (`full_name`, `phone`)
 * fails to compile. Each of those is a way this payload has lost data.
 */
type CoMakerFormColumns = Required<Omit<UpdateCoMakerData, "status">>;

/**
 * The body for `PUT /co-makers/{id}`, in the API's keys and nothing else.
 *
 * The dialog used to send the co-maker as the API had returned it, with the
 * edits laid on top under the FORM's names: `{ ...coMaker, full_name, phone,
 * relationship, ... }`. `UpdateCoMakerRequest` validates only API keys and the
 * controller writes `validated()`, so the edits were dropped while the spread
 * re-sent the ORIGINAL `first_name`, `middle_name`, `last_name`, `suffix`,
 * `contact_number` and `relationship_to_borrower`. Editing a name, phone or
 * relationship saved nothing, and the dialog still said "Co-maker updated".
 *
 * A cleared optional field is sent as an explicit `null` rather than left out:
 * an omitted key leaves the column as it is, so `null` is what actually clears
 * it. The old `|| undefined` meant an emptied address, occupation, employer or
 * income could never be removed — JSON drops an undefined key. Every one of
 * these rules is `nullable` and every column is nullable, so the API already
 * accepts this as-is; clearing was never waiting on a backend change.
 *
 * Every string is trimmed first, so a field of spaces is a cleared field. The
 * API's global TrimStrings middleware would trim them anyway — this changes
 * nothing that gets stored, it makes the payload say what will be.
 *
 * `first_name` and `last_name` stay strings, never `null`: their rules are
 * `sometimes|string`, which refuses a null. The dialog does not submit either
 * one blank.
 */
export function coMakerUpdatePayload(form: CoMakerFormData): UpdateCoMakerData {
  return {
    first_name: form.first_name.trim(),
    middle_name: form.middle_name.trim() || null,
    last_name: form.last_name.trim(),
    suffix: form.suffix.trim() || null,
    relationship_to_borrower: form.relationship.trim() || null,
    contact_number: form.phone.trim() || null,
    address: form.address.trim() || null,
    occupation: form.occupation.trim() || null,
    employer: form.employer.trim() || null,
    monthly_income: monthlyIncome(form.monthly_income),
  } satisfies CoMakerFormColumns;
}

/**
 * A blank income is a cleared one, `null`; anything else is the number typed,
 * and `"0"` is an answer, not a blank. Trimmed before the check because
 * `Number("  ")` is `0` — spaces must not quietly become a zero income.
 *
 * The field is an `<input type="number">`, whose value the browser only ever
 * reports as `""` or a valid number, so `Number()` never meets junk here.
 */
function monthlyIncome(value: string): number | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : Number(trimmed);
}
