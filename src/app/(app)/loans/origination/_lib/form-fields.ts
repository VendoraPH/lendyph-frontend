/**
 * The application form's fields in words. No endpoint sends them, so this
 * mirrors the backend's DraftRules::fieldKeys() (the text and choice fields,
 * in its order); `form-fields.test.ts` pins the list to it. A product's
 * settings may make any of them required, and the server refuses any other
 * key ("Required fields must be fields of the application form.").
 */

import { words } from "./words";

export type FormSection = "personal" | "employment" | "expenses" | "loan";

export const FORM_SECTION_LABELS: Record<FormSection, string> = {
  personal: "Personal details",
  employment: "Income",
  expenses: "Expenses and debts",
  loan: "Loan request",
};

export interface FormField {
  key: string;
  label: string;
  section: FormSection;
}

const field = (section: FormSection, name: string, label: string): FormField => ({ key: `${section}.${name}`, label, section });

export const FORM_FIELDS: readonly FormField[] = [
  field("personal", "first_name", "First name"),
  field("personal", "middle_name", "Middle name"),
  field("personal", "last_name", "Last name"),
  field("personal", "suffix", "Suffix"),
  field("personal", "date_of_birth", "Date of birth"),
  field("personal", "gender", "Gender"),
  field("personal", "civil_status", "Civil status"),
  field("personal", "nationality", "Nationality"),
  field("personal", "region", "Region"),
  field("personal", "province", "Province"),
  field("personal", "city", "City or municipality"),
  field("personal", "barangay", "Barangay"),
  field("personal", "street_address", "Street address"),
  field("personal", "postal_code", "Postal code"),
  field("personal", "years_at_residence", "Years at address"),
  field("personal", "residence_ownership", "Residence"),
  field("personal", "dependents", "Dependents"),
  field("personal", "membership_number", "Membership number"),
  field("employment", "income_source", "Income source"),
  field("employment", "employer_name", "Employer name"),
  field("employment", "employment_type", "Employment type"),
  field("employment", "job_title", "Job title"),
  field("employment", "years_employed", "Years employed"),
  field("employment", "employer_address", "Employer address"),
  field("employment", "gross_monthly_income", "Gross monthly pay"),
  field("employment", "net_monthly_income", "Take-home pay a month"),
  field("employment", "other_regular_income", "Other regular income"),
  field("employment", "salary_frequency", "How often paid"),
  field("employment", "business_name", "Business name"),
  field("employment", "business_type", "Business type"),
  field("employment", "business_address", "Business address"),
  field("employment", "years_operating", "Years operating"),
  field("employment", "monthly_revenue", "Average sales a month"),
  field("employment", "monthly_business_expenses", "Business costs a month"),
  field("employment", "monthly_net_business_income", "Net business income a month"),
  field("employment", "other_source_description", "Source of income"),
  field("employment", "other_income_amount", "Income amount"),
  field("employment", "other_income_frequency", "How often income is received"),
  field("employment", "other_income_details", "Income details"),
  field("expenses", "housing", "Rent or housing"),
  field("expenses", "utilities", "Electricity, water and internet"),
  field("expenses", "food", "Food"),
  field("expenses", "transportation", "Transportation"),
  field("expenses", "education", "School fees"),
  field("expenses", "family_support", "Support to family"),
  field("expenses", "other_essential", "Other necessary expenses"),
  field("expenses", "credit_card_payments", "Credit card payments"),
  field("expenses", "other_debt_payments", "Other debt payments"),
  field("expenses", "other_commitments", "Other regular commitments"),
  field("loan", "amount", "Loan amount"),
  field("loan", "purpose", "Loan purpose"),
  field("loan", "term", "Term"),
  field("loan", "frequency", "Payment frequency"),
  field("loan", "release_method", "Release method"),
];

export interface RequiredFieldOption {
  key: string;
  label: string;
  section: FormSection | null;
}

const isSection = (value: string): value is FormSection => value in FORM_SECTION_LABELS;

/**
 * What a product's required fields can be picked from: the form's fields,
 * plus any stored key the form no longer has, kept in words so nothing is
 * dropped without staff choosing to (the server refuses it on save).
 */
export function requiredFieldOptions(stored: readonly string[]): RequiredFieldOption[] {
  const extra = stored
    .filter((key) => !FORM_FIELDS.some((f) => f.key === key))
    .map((key) => {
      const [section, ...rest] = key.split(".");
      return { key, label: words(rest.at(-1) ?? key), section: isSection(section) ? section : null };
    });
  return [...FORM_FIELDS, ...extra];
}
