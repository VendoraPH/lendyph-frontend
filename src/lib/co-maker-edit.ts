import type { UpdateCoMakerData } from "@/services/co-maker.service";
import type { CoMaker, CoMakerRelationship } from "@/types";

/**
 * The co-maker dialog's fields, as the form holds them.
 *
 * `loan_id` is here because the form renders the Linked Loan picker, not
 * because it is saved: `co_makers` has no such column, and co-makers are linked
 * to loans from the loan side. No payload carries it — see
 * `coMakerUpdatePayload`.
 *
 * The valid ID is not part of this form at all. It has its own endpoint and
 * its own draft — see `@/lib/co-maker-valid-id`.
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
    loan_id: cm.loan_id ?? "",
  };
}

/**
 * Lay a fresh copy of the co-maker over the form without losing any typing.
 *
 * The edit dialog opens on the list's snapshot so it is usable at once, then
 * fetches the co-maker again in case someone changed it since. When that copy
 * landed it used to replace the whole form — wiping whatever had been typed in
 * the meantime. Now it fills only the fields nobody has touched: what the
 * person typed stays, and the fields they didn't touch are saved from the
 * fresh copy, not the older snapshot.
 */
export function mergeFreshIntoForm(
  fresh: CoMakerFormData,
  current: CoMakerFormData,
  touched: ReadonlySet<keyof CoMakerFormData>
): CoMakerFormData {
  const merged = { ...fresh };
  for (const field of touched) keepField(merged, current, field);
  return merged;
}

function keepField<K extends keyof CoMakerFormData>(
  to: CoMakerFormData,
  from: CoMakerFormData,
  field: K
): void {
  to[field] = from[field];
}

export type CoMakerDetailsField = "first_name" | "last_name" | "relationship" | "phone";
export type CoMakerDetailsErrors = Partial<Record<CoMakerDetailsField, string>>;

/**
 * What the form still needs before it can save, field by field. The dialog
 * used to answer a missing relationship — the one required field the browser
 * can't check, being a custom select — by not saving and saying nothing.
 * Names or a phone of only spaces went the same way, since `required` counts
 * spaces as filled in.
 */
export function coMakerDetailsProblems(form: CoMakerFormData): CoMakerDetailsErrors {
  const errors: CoMakerDetailsErrors = {};
  if (!form.first_name.trim()) errors.first_name = "Enter the first name.";
  if (!form.last_name.trim()) errors.last_name = "Enter the last name.";
  if (!form.relationship) errors.relationship = "Choose the relationship.";
  if (!form.phone.trim()) errors.phone = "Enter a contact number.";
  return errors;
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
