/**
 * The steps of the Add Member and Edit Member forms (UI round, 2026-11-17: a
 * long form becomes numbered steps), their checks, and the payloads they send.
 * Pure, so the rules are unit-tested: every field the forms check or send sits
 * on exactly one step, and a server error opens the step that holds it.
 *
 * The payloads and the required-field labels are the forms' own, moved here
 * unchanged.
 */

import { dateHiredError } from "@/lib/date-hired";
import { todayISO } from "@/lib/format";
import { errorMessages, stepErrorsOf, type FormStepDef, type StepErrors } from "@/lib/form-stepper";
import { formatValidationMessage } from "@/lib/validation-message";
import { validateValidIds, type ValidIdDraft } from "@/lib/valid-id";

export interface MemberFormData {
  first_name: string;
  middle_name: string;
  last_name: string;
  suffix: string;
  birthdate: string;
  gender: string;
  civil_status: string;
  contact_number: string;
  email: string;
  address: string;
  barangay: string;
  city: string;
  province: string;
  employer_or_business: string;
  /** `YYYY-MM-DD`, or blank: it's optional. */
  date_hired: string;
  monthly_income: string;
  branch_id: string;
  spouse_first_name: string;
  spouse_middle_name: string;
  spouse_last_name: string;
  spouse_contact_number: string;
  spouse_occupation: string;
}

/** Add Member also takes the share capital pledge. */
export interface NewMemberFormData extends MemberFormData {
  pledge_amount: string;
}

export type MemberFormMode = "create" | "edit";

const PERSONAL = ["first_name", "last_name", "middle_name", "suffix", "birthdate", "gender", "civil_status"];
const SPOUSE = [
  "spouse_first_name",
  "spouse_middle_name",
  "spouse_last_name",
  "spouse_contact_number",
  "spouse_occupation",
];
// The street goes out as both `address` and `street_address`.
const CONTACT = ["contact_number", "email", "address", "street_address", "barangay", "city", "province"];
const EMPLOYMENT = ["employer_or_business", "date_hired", "monthly_income"];

/**
 * The form's steps. Spouse Information shows only while the civil status is
 * married, as its fields do. Add Member's Branch picker sits with the personal
 * fields; Edit Member keeps its Branch Assignment card as its own step, right
 * after Personal Information, where the card sat.
 */
export function memberFormSteps({ mode, married }: { mode: MemberFormMode; married: boolean }): FormStepDef[] {
  const create = mode === "create";
  const steps: (FormStepDef | null)[] = [
    { id: "personal", title: "Personal Information", fields: create ? [...PERSONAL, "branch_id"] : PERSONAL },
    create ? null : { id: "branch", title: "Branch Assignment", fields: ["branch_id"] },
    married ? { id: "spouse", title: "Spouse Information", fields: SPOUSE } : null,
    { id: "contact", title: "Contact Information", fields: CONTACT },
    {
      id: "employment",
      title: "Employment & Income",
      fields: create ? [...EMPLOYMENT, "pledge_amount"] : EMPLOYMENT,
    },
    { id: "valid_ids", title: create ? "Valid IDs" : "Add Valid IDs", fields: ["valid_ids"] },
  ];
  return steps.filter((s): s is FormStepDef => s !== null);
}

/**
 * The required fields still empty, by field key, with the label the toast
 * lists ("Please complete: First name and Province."), in the form's order.
 * Middle name stays optional.
 */
export function requiredMemberFieldErrors(form: MemberFormData): Record<string, string> {
  const missing: Record<string, string> = {};
  if (!form.first_name.trim()) missing.first_name = "First name";
  if (!form.last_name.trim()) missing.last_name = "Last name";
  if (!form.birthdate) missing.birthdate = "Date of birth";
  if (!form.gender) missing.gender = "Gender";
  if (!form.civil_status) missing.civil_status = "Civil status";
  if (!form.contact_number.trim()) missing.contact_number = "Contact number";
  if (!form.address.trim()) missing.address = "Street address";
  if (!form.city.trim()) missing.city = "City / Municipality";
  if (!form.province.trim()) missing.province = "Province";
  return missing;
}

/**
 * Fields the form refuses for what they hold rather than for being empty, as
 * full sentences. Date Hired (finish run round 2, decision 15) is optional and
 * held to the server's rules, in its words (`dateHiredError`): written
 * year-month-day, after 1900, not after today (Manila) and not before the
 * birthdate.
 */
export function memberFieldErrors(form: MemberFormData, today: string): Record<string, string> {
  const errors: Record<string, string> = {};
  const hired = dateHiredError(form.date_hired, form.birthdate, today);
  if (hired !== null) errors.date_hired = hired;
  return errors;
}

/**
 * A step's toast: the missing fields by name ("Please complete: First name and
 * Province."), then any full sentences as they are ("Enter the ID number for
 * ID 2."). `notifyValidation` alone would wrap a sentence in "Please enter a
 * valid …".
 */
export function memberStepMessage(errors: StepErrors): string {
  const messages = errorMessages(errors);
  const sentences = messages.filter((m) => m.trim().endsWith("."));
  const names = messages.filter((m) => !m.trim().endsWith("."));
  return [names.length > 0 ? formatValidationMessage(names) : "", ...sentences]
    .map((m) => m.trim())
    .filter(Boolean)
    .join(" ");
}

/** The shared valid ID check, keyed `valid_ids.<row>.<field>` so the row's field gets focus. */
export function validIdStepErrors(validIds: readonly ValidIdDraft[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const error of validateValidIds([...validIds], { requireAtLeastOne: false }).errors) {
    out[`valid_ids.${error.index}.${error.field}`] = error.message;
  }
  return out;
}

/** One step's errors, or `true` when it passes (`validateStep` for `FormStepper`). */
export function validateMemberStep(
  step: FormStepDef | undefined,
  form: MemberFormData,
  validIds: readonly ValidIdDraft[],
  today: string = todayISO()
): StepErrors | true {
  if (!step) return true;
  const errors = stepErrorsOf(
    { ...requiredMemberFieldErrors(form), ...memberFieldErrors(form, today), ...validIdStepErrors(validIds) },
    step
  );
  return Object.keys(errors).length > 0 ? errors : true;
}

/** Add Member's POST /borrowers body. */
export function newMemberPayload(form: NewMemberFormData, force: boolean): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    first_name: form.first_name.trim(),
    last_name: form.last_name.trim(),
    branch_id: Number(form.branch_id),
  };

  if (form.middle_name.trim()) payload.middle_name = form.middle_name.trim();
  if (form.suffix && form.suffix !== "none") payload.suffix = form.suffix;
  if (form.birthdate) payload.birthdate = form.birthdate;
  if (form.gender) payload.gender = form.gender;
  if (form.civil_status) payload.civil_status = form.civil_status;
  if (form.contact_number.trim()) payload.contact_number = form.contact_number.trim();
  if (form.email.trim()) payload.email = form.email.trim();
  if (form.address.trim()) {
    const street = form.address.trim();
    payload.street_address = street;
    payload.address = street;
  }
  if (form.barangay.trim()) payload.barangay = form.barangay.trim();
  if (form.city.trim()) payload.city = form.city.trim();
  if (form.province.trim()) payload.province = form.province.trim();
  if (form.employer_or_business.trim()) payload.employer_or_business = form.employer_or_business.trim();
  if (form.date_hired.trim()) payload.date_hired = form.date_hired.trim();
  if (form.monthly_income) payload.monthly_income = Number(form.monthly_income);
  payload.pledge_amount = form.pledge_amount ? Number(form.pledge_amount) : 0;

  if (form.civil_status === "married") {
    if (form.spouse_first_name.trim()) payload.spouse_first_name = form.spouse_first_name.trim();
    if (form.spouse_middle_name.trim()) payload.spouse_middle_name = form.spouse_middle_name.trim();
    if (form.spouse_last_name.trim()) payload.spouse_last_name = form.spouse_last_name.trim();
    if (form.spouse_contact_number.trim()) payload.spouse_contact_number = form.spouse_contact_number.trim();
    if (form.spouse_occupation.trim()) payload.spouse_occupation = form.spouse_occupation.trim();
  }

  if (force) payload.force = true;
  return payload;
}

/** Edit Member's PUT /borrowers/{id} body. */
export function editMemberPayload(form: MemberFormData): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    first_name: form.first_name.trim(),
    last_name: form.last_name.trim(),
    middle_name: form.middle_name.trim() || null,
    suffix: form.suffix && form.suffix !== "none" ? form.suffix : null,
    birthdate: form.birthdate || null,
    gender: form.gender || null,
    civil_status: form.civil_status || null,
    contact_number: form.contact_number.trim() || null,
    email: form.email.trim() || null,
    address: form.address.trim() || null,
    barangay: form.barangay.trim() || null,
    city: form.city.trim() || null,
    province: form.province.trim() || null,
    employer_or_business: form.employer_or_business.trim() || null,
    date_hired: form.date_hired.trim() || null,
    monthly_income: form.monthly_income ? Number(form.monthly_income) : null,
    branch_id: Number(form.branch_id),
  };

  if (form.civil_status === "married") {
    payload.spouse_first_name = form.spouse_first_name.trim() || null;
    payload.spouse_middle_name = form.spouse_middle_name.trim() || null;
    payload.spouse_last_name = form.spouse_last_name.trim() || null;
    payload.spouse_contact_number = form.spouse_contact_number.trim() || null;
    payload.spouse_occupation = form.spouse_occupation.trim() || null;
  }

  return payload;
}
