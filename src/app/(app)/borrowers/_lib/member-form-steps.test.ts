import { test } from "node:test";
import assert from "node:assert/strict";
import { firstStepWithError, stepIndexForField, type FormStepDef } from "@/lib/form-stepper";
import {
  editMemberPayload,
  memberFieldErrors,
  memberFormSteps,
  memberStepMessage,
  newMemberPayload,
  requiredMemberFieldErrors,
  validateMemberStep,
  validIdStepErrors,
  type MemberFormData,
  type NewMemberFormData,
} from "./member-form-steps";

const TODAY = "2026-11-24";

function filledForm(overrides: Partial<NewMemberFormData> = {}): NewMemberFormData {
  return {
    first_name: "Juan",
    middle_name: "Dela",
    last_name: "Santos",
    suffix: "jr",
    birthdate: "1990-01-02",
    gender: "male",
    civil_status: "married",
    contact_number: "09171234567",
    email: "juan@example.com",
    address: "1 Rizal St",
    barangay: "Poblacion",
    city: "Cebu City",
    province: "Cebu",
    employer_or_business: "Store",
    date_hired: "2015-06-01",
    monthly_income: "15000",
    pledge_amount: "500",
    branch_id: "2",
    spouse_first_name: "Maria",
    spouse_middle_name: "Reyes",
    spouse_last_name: "Santos",
    spouse_contact_number: "09181234567",
    spouse_occupation: "Teacher",
    ...overrides,
  };
}

function emptyForm(): NewMemberFormData {
  const form = filledForm();
  return Object.fromEntries(Object.keys(form).map((k) => [k, ""])) as unknown as NewMemberFormData;
}

function stepsHolding(key: string, steps: readonly FormStepDef[]): string[] {
  return steps
    .filter((s) => (s.fields ?? []).some((f) => key === f || key.startsWith(`${f}.`)))
    .map((s) => s.id);
}

const blankId = {
  type: "",
  custom_type_name: "",
  id_number: "",
  front_file: null,
  back_file: null,
};

test("Add Member: Personal, Spouse (married only), Contact, Employment and Valid IDs, in that order", () => {
  assert.deepEqual(
    memberFormSteps({ mode: "create", married: true }).map((s) => s.title),
    ["Personal Information", "Spouse Information", "Contact Information", "Employment & Income", "Valid IDs"],
  );
  assert.deepEqual(
    memberFormSteps({ mode: "create", married: false }).map((s) => s.id),
    ["personal", "contact", "employment", "valid_ids"],
  );
});

test("Edit Member: the same steps plus Branch Assignment after Personal, and its own Valid IDs title", () => {
  assert.deepEqual(
    memberFormSteps({ mode: "edit", married: true }).map((s) => s.title),
    [
      "Personal Information",
      "Branch Assignment",
      "Spouse Information",
      "Contact Information",
      "Employment & Income",
      "Add Valid IDs",
    ],
  );
  assert.deepEqual(
    memberFormSteps({ mode: "edit", married: false }).map((s) => s.id),
    ["personal", "branch", "contact", "employment", "valid_ids"],
  );
});

test("no field is listed on two steps", () => {
  for (const mode of ["create", "edit"] as const) {
    const all = memberFormSteps({ mode, married: true }).flatMap((s) => s.fields ?? []);
    assert.equal(new Set(all).size, all.length, mode);
  }
});

test("every field Add Member sends belongs to exactly one step", () => {
  const steps = memberFormSteps({ mode: "create", married: true });
  const keys = Object.keys(newMemberPayload(filledForm(), true)).filter((k) => k !== "force");
  assert.ok(keys.includes("spouse_first_name") && keys.includes("pledge_amount") && keys.includes("street_address"));
  for (const key of keys) assert.equal(stepsHolding(key, steps).length, 1, key);
});

test("every field Edit Member sends belongs to exactly one step", () => {
  const steps = memberFormSteps({ mode: "edit", married: true });
  const keys = Object.keys(editMemberPayload(filledForm()));
  assert.ok(keys.includes("spouse_occupation") && keys.includes("branch_id"));
  for (const key of keys) assert.equal(stepsHolding(key, steps).length, 1, key);
});

test("every field the forms check belongs to exactly one step", () => {
  const ids = [{ ...blankId, type: "others", front_file: null, id_number: "" }];
  const keys = [
    ...Object.keys(requiredMemberFieldErrors(emptyForm())),
    ...Object.keys(validIdStepErrors(ids)),
    ...Object.keys(memberFieldErrors(filledForm({ date_hired: "2027-01-01" }), TODAY)),
  ];
  assert.ok(keys.length > 9);
  for (const mode of ["create", "edit"] as const) {
    const steps = memberFormSteps({ mode, married: false });
    for (const key of keys) assert.equal(stepsHolding(key, steps).length, 1, `${mode}: ${key}`);
  }
});

test("the payloads are the same as before: Add Member", () => {
  assert.deepEqual(newMemberPayload(filledForm({ civil_status: "single", suffix: "none" }), false), {
    first_name: "Juan",
    last_name: "Santos",
    branch_id: 2,
    middle_name: "Dela",
    birthdate: "1990-01-02",
    gender: "male",
    civil_status: "single",
    contact_number: "09171234567",
    email: "juan@example.com",
    street_address: "1 Rizal St",
    address: "1 Rizal St",
    barangay: "Poblacion",
    city: "Cebu City",
    province: "Cebu",
    employer_or_business: "Store",
    date_hired: "2015-06-01",
    monthly_income: 15000,
    pledge_amount: 500,
  });
  const married = newMemberPayload(filledForm({ pledge_amount: "", date_hired: "" }), true);
  assert.equal(married.pledge_amount, 0);
  assert.equal("date_hired" in married, false, "a blank Date Hired is left out of a new member");
  assert.equal(married.suffix, "jr");
  assert.equal(married.spouse_occupation, "Teacher");
  assert.equal(married.force, true);
});

test("the payloads are the same as before: Edit Member", () => {
  const form: MemberFormData = filledForm({ civil_status: "single", middle_name: " ", suffix: "none" });
  assert.deepEqual(editMemberPayload(form), {
    first_name: "Juan",
    last_name: "Santos",
    middle_name: null,
    suffix: null,
    birthdate: "1990-01-02",
    gender: "male",
    civil_status: "single",
    contact_number: "09171234567",
    email: "juan@example.com",
    address: "1 Rizal St",
    barangay: "Poblacion",
    city: "Cebu City",
    province: "Cebu",
    employer_or_business: "Store",
    date_hired: "2015-06-01",
    monthly_income: 15000,
    branch_id: 2,
  });
  assert.equal(editMemberPayload(filledForm({ spouse_middle_name: "" })).spouse_middle_name, null);
  assert.equal(editMemberPayload(filledForm({ date_hired: "" })).date_hired, null, "a cleared Date Hired is cleared");
});

test("the required fields keep their labels and order, split by step", () => {
  assert.deepEqual(Object.values(requiredMemberFieldErrors(emptyForm())), [
    "First name",
    "Last name",
    "Date of birth",
    "Gender",
    "Civil status",
    "Contact number",
    "Street address",
    "City / Municipality",
    "Province",
  ]);
  const steps = memberFormSteps({ mode: "create", married: false });
  const step = (id: string) => steps.find((s) => s.id === id);
  assert.deepEqual(validateMemberStep(step("personal"), emptyForm(), []), {
    first_name: "First name",
    last_name: "Last name",
    birthdate: "Date of birth",
    gender: "Gender",
    civil_status: "Civil status",
  });
  assert.deepEqual(Object.values(validateMemberStep(step("contact"), emptyForm(), []) as object), [
    "Contact number",
    "Street address",
    "City / Municipality",
    "Province",
  ]);
  assert.equal(validateMemberStep(step("employment"), emptyForm(), []), true);
  assert.equal(validateMemberStep(step("personal"), filledForm(), []), true);
  assert.equal(validateMemberStep(undefined, emptyForm(), []), true);
});

test("the Valid IDs step: blank rows pass, a started row must be complete", () => {
  const steps = memberFormSteps({ mode: "edit", married: false });
  const ids = steps.find((s) => s.id === "valid_ids");
  assert.equal(validateMemberStep(ids, filledForm(), [blankId]), true);
  assert.deepEqual(validateMemberStep(ids, filledForm(), [blankId, { ...blankId, type: "passport" }]), {
    "valid_ids.1.id_number": "Enter the ID number for ID 2.",
    "valid_ids.1.front_file": "Upload the front of ID 2.",
  });
});

test("server 422 keys open the right step, dotted keys included", () => {
  const create = memberFormSteps({ mode: "create", married: true });
  const at = (key: string, steps: readonly FormStepDef[]) => steps[stepIndexForField(key, steps)]?.id;
  assert.equal(at("first_name", create), "personal");
  assert.equal(at("branch_id", create), "personal");
  assert.equal(at("spouse_contact_number", create), "spouse");
  assert.equal(at("street_address", create), "contact");
  assert.equal(at("pledge_amount", create), "employment");
  assert.equal(at("valid_ids.0.id_number", create), "valid_ids");
  const edit = memberFormSteps({ mode: "edit", married: true });
  assert.equal(at("branch_id", edit), "branch");
  assert.equal(at("monthly_income", edit), "employment");
  assert.equal(at("date_hired", create), "employment");
  assert.equal(at("date_hired", edit), "employment");
  assert.equal(
    create[firstStepWithError({ province: ["Required."], "valid_ids.1.type": ["Pick one."] }, create)].id,
    "contact",
  );
});

test("a spouse error opens no step while the form shows no spouse fields", () => {
  const single = memberFormSteps({ mode: "create", married: false });
  assert.equal(stepIndexForField("spouse_first_name", single), -1);
  assert.equal(firstStepWithError({ spouse_first_name: ["Too long."] }, single), -1);
});

// ── Date Hired (finish run round 2, decision 15) ──

test("Date Hired sits on the Employment step, in both forms", () => {
  for (const mode of ["create", "edit"] as const) {
    const employment = memberFormSteps({ mode, married: false }).find((s) => s.id === "employment");
    assert.ok(employment?.fields?.includes("date_hired"), mode);
  }
});

test("Date Hired is optional, written year-month-day, after 1900, not after today and not before the birthdate, in the server's words", () => {
  const problem = (overrides: Partial<NewMemberFormData>) => memberFieldErrors(filledForm(overrides), TODAY).date_hired;
  assert.equal(problem({ date_hired: "" }), undefined);
  assert.equal(problem({ date_hired: "2026-11-24" }), undefined);
  assert.equal(problem({ date_hired: "1990-01-02" }), undefined, "the birthdate itself is not before the birthdate");
  assert.equal(problem({ date_hired: "2026-11-25" }), "The date hired cannot be in the future.");
  assert.equal(problem({ date_hired: "1990-01-01" }), "The date hired cannot be before the birthdate.");
  assert.equal(
    problem({ date_hired: "2015-02-30" }),
    "The date hired must be a date written as year-month-day, such as 2020-06-01.",
  );
  assert.equal(problem({ date_hired: "06/01/2015" }), "The date hired must be a date written as year-month-day, such as 2020-06-01.");
  // Without a birthdate there is nothing to compare with, but 1900 still holds.
  assert.equal(problem({ birthdate: "", date_hired: "1950-01-01" }), undefined);
  assert.equal(problem({ birthdate: "", date_hired: "1900-01-01" }), "The date hired field must be a date after 1900-01-01.");
});

test("the Employment step checks Date Hired on Next; the other steps don't", () => {
  const steps = memberFormSteps({ mode: "create", married: false });
  const step = (id: string) => steps.find((s) => s.id === id);
  const late = filledForm({ date_hired: "2026-12-01" });
  assert.deepEqual(validateMemberStep(step("employment"), late, [], TODAY), {
    date_hired: "The date hired cannot be in the future.",
  });
  assert.equal(validateMemberStep(step("personal"), late, [], TODAY), true);
  assert.equal(validateMemberStep(step("employment"), filledForm(), [], TODAY), true);
});

test("a step's toast: missing fields by name, and full sentences as they are", () => {
  assert.equal(memberStepMessage({ first_name: "First name", last_name: "Last name" }), "Please complete: First name and Last name.");
  assert.equal(memberStepMessage({ province: "Province" }), "Please enter a valid Province.");
  assert.equal(
    memberStepMessage({ date_hired: "The date hired cannot be in the future." }),
    "The date hired cannot be in the future.",
  );
  assert.equal(
    memberStepMessage({ "valid_ids.1.id_number": "Enter the ID number for ID 2.", "valid_ids.1.front_file": "Upload the front of ID 2." }),
    "Enter the ID number for ID 2. Upload the front of ID 2.",
  );
  assert.equal(
    memberStepMessage({ city: "City / Municipality", date_hired: "The date hired cannot be in the future." }),
    "Please enter a valid City / Municipality. The date hired cannot be in the future.",
  );
});
