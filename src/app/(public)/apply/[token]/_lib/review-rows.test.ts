import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDate } from "@/lib/format";
import { emptyDraft } from "@/lib/loan-origination";
import { visibleFields } from "./employment-fields";
import { expenseRows, incomeRows, personalRows } from "./review-rows";

// The Review step lists everything the applicant entered in each section, in
// words (browser check of #657: the Income section left out Employer, the
// source "Farmer" and its frequency "Monthly"). Only the server's monthly
// figures are worked out; these rows are the answers as typed.

const pairs = (rows: { label: string; value: string }[]) => rows.map((r) => [r.label, r.value]);

test("a farmer's income lists the source, every field entered and its frequency, in words", () => {
  const e = emptyDraft().employment;
  Object.assign(e, {
    income_source: "farmer",
    employer_name: "Binhs Rice Mill",
    other_source_description: "Farmer",
    other_income_amount: "20,000",
    other_income_frequency: "monthly",
    other_regular_income: "1500.5",
  });
  assert.deepEqual(pairs(incomeRows(e, visibleFields("farmer", ["draft.employment.employer_name"], {}))), [
    ["Main source", "Farmer or Agricultural Income Earner"],
    ["Employer", "Binhs Rice Mill"],
    ["Source of income", "Farmer"],
    ["Amount received", "₱20,000.00"],
    ["How often you receive it", "Monthly"],
    ["Other regular income a month", "₱1,500.50"],
  ]);
});

test("answers left from another income source aren't listed", () => {
  const e = emptyDraft().employment;
  Object.assign(e, { income_source: "farmer", business_name: "Old Shop", employer_name: "Old Job", other_source_description: "Fishing" });
  const labels = incomeRows(e, visibleFields("farmer", [], {})).map((r) => r.label);
  assert.deepEqual(labels, ["Main source", "Source of income"]);
});

test("an employee's choices read in words, and an amount that isn't one reads as typed", () => {
  const e = emptyDraft().employment;
  Object.assign(e, { income_source: "employed", employment_type: "contractual", salary_frequency: "semi_monthly", gross_monthly_income: "about 20k" });
  assert.deepEqual(pairs(incomeRows(e, visibleFields("employed", [], {}))), [
    ["Main source", "Employed"],
    ["Employment type", "Contractual"],
    ["Gross monthly pay", "about 20k"],
    ["How often you're paid", "Twice a month"],
  ]);
});

test("personal details list every field entered, in words, and leave blanks out", () => {
  const p = emptyDraft().personal;
  Object.assign(p, {
    first_name: "Juana",
    middle_name: "Santos",
    last_name: "Dela Cruz",
    date_of_birth: "1990-05-01",
    gender: "female",
    civil_status: "married",
    nationality: "Filipino",
    dependents: "2",
    street_address: "12 Mabini St",
    barangay: "San Isidro",
    city: "Cabanatuan",
    region: "Central Luzon",
    province: "Nueva Ecija",
    postal_code: "3100",
    years_at_residence: "5",
    residence_ownership: "rented",
    membership_number: "M-0042",
    branch_id: 4,
  });
  assert.deepEqual(pairs(personalRows(p, [{ id: 3, name: "Main Office" }, { id: 4, name: "Cabanatuan Branch" }])), [
    ["Name", "Juana Santos Dela Cruz"],
    ["Date of birth", formatDate("1990-05-01")],
    ["Gender", "Female"],
    ["Civil status", "Married"],
    ["Nationality", "Filipino"],
    ["Number of dependents", "2"],
    ["Address", "12 Mabini St, San Isidro, Cabanatuan, Nueva Ecija, Central Luzon, 3100"],
    ["Years at this address", "5"],
    ["This home is", "Rented"],
    ["Membership number", "M-0042"],
    ["Nearest branch", "Cabanatuan Branch"],
  ]);
  assert.deepEqual(pairs(personalRows(emptyDraft().personal, [])), [["Nationality", "Filipino"]]);
});

test("expenses list each line, the existing loans and the other payments as entered", () => {
  const x = emptyDraft().expenses;
  Object.assign(x, {
    food: "8000",
    utilities: "2,500",
    has_existing_loans: true,
    existing_loans: [
      { institution: "ABC Lending", outstanding_balance: "12000", payment_amount: "1500", payment_frequency: "weekly", remaining_term: "8" },
      { institution: "", outstanding_balance: "", payment_amount: "500", payment_frequency: "monthly", remaining_term: "" },
    ],
    credit_card_payments: "1000",
  });
  assert.deepEqual(pairs(expenseRows(x)), [
    ["Electricity, water and internet", "₱2,500.00"],
    ["Food", "₱8,000.00"],
    ["Loans still being paid", "Yes"],
    ["ABC Lending", "₱1,500.00 weekly · ₱12,000.00 left · 8 payments left"],
    ["Unnamed lender", "₱500.00 monthly"],
    ["Credit card payments", "₱1,000.00"],
  ]);
  assert.deepEqual(pairs(expenseRows({ ...x, has_existing_loans: false })).slice(2, 3), [["Loans still being paid", "No"]]);
});
