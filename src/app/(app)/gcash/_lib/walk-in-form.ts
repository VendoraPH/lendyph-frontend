import { httpStatusOf } from "@/lib/api-error";
import type { GCashNonMember, GCashNonMemberInput } from "@/types";

/** The walk-in form's fields, named as the API names them. */
export type WalkInField = keyof GCashNonMemberInput;

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

/** What the form sends: trimmed, with empty remarks as null. */
export function walkInPayload(form: WalkInFormState): GCashNonMemberInput {
  return {
    full_name: form.full_name.trim(),
    mobile_number: form.mobile_number.trim(),
    id_type: form.id_type.trim(),
    id_number: form.id_number.trim(),
    remarks: form.remarks.trim() || null,
  };
}

/**
 * Checks the backend would fail, caught before submitting. Required fields
 * are not here: the submit button stays disabled until they are filled.
 */
export function validateWalkInForm(form: WalkInFormState): WalkInFieldErrors {
  const idNumber = form.id_number.trim();
  if (idNumber !== "" && normaliseIdNumber(idNumber) === "") {
    return { id_number: ID_NUMBER_NOT_BLANK };
  }
  return {};
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
