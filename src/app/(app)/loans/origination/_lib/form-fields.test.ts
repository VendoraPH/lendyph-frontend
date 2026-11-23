import { test } from "node:test";
import assert from "node:assert/strict";
import { FORM_FIELDS, FORM_SECTION_LABELS, requiredFieldOptions } from "./form-fields";

// DraftRules::fieldKeys() on the backend: the text and choice fields of the
// application form, in its order. The server refuses any other key on a
// product's required fields ("Required fields must be fields of the
// application form."), so this list must move with it.
const SERVER_FIELD_KEYS = [
  "personal.first_name", "personal.middle_name", "personal.last_name", "personal.suffix", "personal.date_of_birth",
  "personal.gender", "personal.civil_status", "personal.nationality", "personal.region", "personal.province",
  "personal.city", "personal.barangay", "personal.street_address", "personal.postal_code", "personal.years_at_residence",
  "personal.residence_ownership", "personal.dependents", "personal.membership_number",
  "employment.income_source", "employment.employer_name", "employment.employment_type", "employment.job_title",
  "employment.years_employed", "employment.employer_address", "employment.gross_monthly_income",
  "employment.net_monthly_income", "employment.other_regular_income", "employment.salary_frequency",
  "employment.business_name", "employment.business_type", "employment.business_address", "employment.years_operating",
  "employment.monthly_revenue", "employment.monthly_business_expenses", "employment.monthly_net_business_income",
  "employment.other_source_description", "employment.other_income_amount", "employment.other_income_frequency",
  "employment.other_income_details",
  "expenses.housing", "expenses.utilities", "expenses.food", "expenses.transportation", "expenses.education",
  "expenses.family_support", "expenses.other_essential", "expenses.credit_card_payments", "expenses.other_debt_payments",
  "expenses.other_commitments",
  "loan.amount", "loan.purpose", "loan.term", "loan.frequency", "loan.release_method",
];

test("the required-field choices are exactly the server's form fields, in its order", () => {
  assert.deepEqual(
    FORM_FIELDS.map((f) => f.key),
    SERVER_FIELD_KEYS,
  );
});

test("every field reads in words, never as its key", () => {
  for (const f of FORM_FIELDS) {
    assert.doesNotMatch(f.label, /[._]/, f.key);
    assert.match(f.label, /^[A-Z]/, f.key);
    assert.equal(f.section, f.key.split(".")[0], f.key);
    assert.ok(FORM_SECTION_LABELS[f.section], f.key);
  }
  const label = (key: string) => FORM_FIELDS.find((f) => f.key === key)?.label;
  assert.equal(label("employment.employer_name"), "Employer name");
  assert.equal(label("personal.civil_status"), "Civil status");
  assert.equal(label("loan.amount"), "Loan amount");
});

test("a stored key the form no longer has is kept and shown in words, never dropped by itself", () => {
  const options = requiredFieldOptions(["personal.gender", "personal.old_field"]);
  assert.equal(options.length, FORM_FIELDS.length + 1);
  assert.deepEqual(options.at(-1), { key: "personal.old_field", label: "Old field", section: "personal" });
  assert.equal(requiredFieldOptions([]).length, FORM_FIELDS.length);
});
