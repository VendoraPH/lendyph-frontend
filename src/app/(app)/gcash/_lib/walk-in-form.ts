import { httpStatusOf } from "@/lib/api-error";
import type { GCashNonMember, GCashNonMemberInput } from "@/types";

/** The walk-in form's fields, named as the API names them. */
export type WalkInField = Exclude<
  keyof GCashNonMemberInput,
  "acknowledge_possible_duplicate"
>;

/** One message per field that needs fixing. */
export type WalkInFieldErrors = Partial<Record<WalkInField, string>>;

export interface WalkInFormState {
  full_name: string;
  mobile_number: string;
  id_type: string;
  id_number: string;
  remarks: string;
}

export const EMPTY_WALK_IN_FORM: WalkInFormState = {
  full_name: "",
  mobile_number: "",
  id_type: "",
  id_number: "",
  remarks: "",
};

/** The form order, so the first problem can take focus. */
export const WALK_IN_FIELDS: readonly WalkInField[] = [
  "full_name",
  "mobile_number",
  "id_type",
  "id_number",
  "remarks",
];

/** `max:` from StoreGCashNonMemberRequest (and the update request, its child). */
export const WALK_IN_MAX_LENGTH: Record<WalkInField, number> = {
  full_name: 255,
  mobile_number: 32,
  id_type: 64,
  id_number: 64,
  remarks: 2000,
};

/** UniqueWalkInIdNumber's message, word for word. */
export const ID_NUMBER_NOT_BLANK =
  "The ID number must contain letters or numbers, not only dashes or spaces.";

/** StoreGCashNonMemberRequest's both-or-neither messages, word for word. */
export const ID_TYPE_NEEDS_NUMBER =
  "Enter the ID number too, or leave both ID fields blank.";
export const ID_NUMBER_NEEDS_TYPE =
  "Enter the ID type too, or leave both ID fields blank.";

/**
 * UniqueWalkInIdNumber::normalise(): spaces and dashes out, upper case. The
 * same comparison the duplicate rule and the walk-in search use.
 */
export function normaliseIdNumber(idNumber: string): string {
  return idNumber.replace(/[ -]/g, "").toUpperCase();
}

/** A saved walk-in as form values, for editing. */
export function walkInFormFrom(nonMember: GCashNonMember): WalkInFormState {
  return {
    full_name: nonMember.full_name ?? "",
    mobile_number: nonMember.mobile_number ?? "",
    id_type: nonMember.id_type ?? "",
    id_number: nonMember.id_number ?? "",
    remarks: nonMember.remarks ?? "",
  };
}

/**
 * What the form sends: trimmed, with empty remarks and an empty ID field as
 * null. The ID is optional; an empty one is sent as "no ID", not as "".
 */
export function walkInPayload(form: WalkInFormState): GCashNonMemberInput {
  return {
    full_name: form.full_name.trim(),
    mobile_number: form.mobile_number.trim(),
    id_type: form.id_type.trim() || null,
    id_number: form.id_number.trim() || null,
    remarks: form.remarks.trim() || null,
  };
}

/** The same payload, resent after the teller chose "Save anyway". */
export function acknowledgedWalkInPayload(
  payload: GCashNonMemberInput,
): GCashNonMemberInput {
  return { ...payload, acknowledge_possible_duplicate: true };
}

/** Name and mobile number are the only required fields; the ID is optional. */
export function hasRequiredWalkInFields(payload: GCashNonMemberInput): boolean {
  return payload.full_name.length > 0 && payload.mobile_number.length > 0;
}

/**
 * Checks the backend would fail, caught before submitting. Required fields
 * are not here: the submit button stays disabled until they are filled.
 *
 * The ID fields are both or neither: a type without a number (or the reverse)
 * names no document, so the missing one gets the message.
 */
export function validateWalkInForm(form: WalkInFormState): WalkInFieldErrors {
  const idType = form.id_type.trim();
  const idNumber = form.id_number.trim();
  const errors: WalkInFieldErrors = {};
  if (idType !== "" && idNumber === "") errors.id_number = ID_TYPE_NEEDS_NUMBER;
  if (idNumber !== "" && idType === "") errors.id_type = ID_NUMBER_NEEDS_TYPE;
  if (idNumber !== "" && normaliseIdNumber(idNumber) === "") {
    errors.id_number = ID_NUMBER_NOT_BLANK;
  }
  return errors;
}

/**
 * The server's soft warning for a walk-in saved without an ID: another
 * walk-in has the same name and mobile number. Its message (which names that
 * walk-in) when the 422 carries `errors.possible_duplicate`, otherwise null.
 */
export function possibleDuplicateWarning(err: unknown): string | null {
  if (httpStatusOf(err) !== 422) return null;
  const errors = (err as { response?: { data?: { errors?: unknown } } })
    .response?.data?.errors;
  if (!errors || typeof errors !== "object") return null;
  const messages = (errors as Record<string, unknown>).possible_duplicate;
  if (!Array.isArray(messages)) return null;
  const first = messages.find(
    (m): m is string => typeof m === "string" && m.length > 0,
  );
  return first ?? null;
}

/**
 * A 422's `errors` bag as one message per form field — the first the server
 * gave for each. Fields the form doesn't have are dropped; the caller toasts
 * when nothing maps, so no error goes unshown.
 */
export function walkInFieldErrors(err: unknown): WalkInFieldErrors {
  if (httpStatusOf(err) !== 422) return {};
  const errors = (err as { response?: { data?: { errors?: unknown } } })
    .response?.data?.errors;
  if (!errors || typeof errors !== "object") return {};
  const bag = errors as Record<string, unknown>;
  const mapped: WalkInFieldErrors = {};
  for (const field of WALK_IN_FIELDS) {
    const messages = bag[field];
    if (!Array.isArray(messages)) continue;
    const first = messages.find(
      (m): m is string => typeof m === "string" && m.length > 0,
    );
    if (first) mapped[field] = first;
  }
  return mapped;
}
