import { CIVIL_STATUS_OPTIONS, GENDER_OPTIONS } from "@/constants";
import { formatCurrency, formatDate } from "@/lib/format";
import { DEBT_LINES, EMPLOYMENT_TYPES, EXPENSE_LINES, FREQUENCY_LABELS, INCOME_SOURCE_LABELS, inWords } from "@/lib/loan-origination";
import type { ApplicantEmployment, ApplicantExpenses, ApplicantPersonal, ExistingDebt, IncomeFrequency } from "@/types/loan-origination";
import { RESIDENCE_OWNERSHIP } from "./options";
import { typedAmount } from "./wizard-state";

/**
 * The Review step's answers: everything the applicant entered in a section,
 * in words (choices by their labels, amounts in pesos as typed). Blank
 * answers are left out. Nothing is added up here; the monthly figures are the
 * server's `declared_totals`.
 */

export interface ReviewRow {
  label: string;
  value: string;
}

const rows = (entries: readonly [label: string, value: string | null | undefined][]): ReviewRow[] =>
  entries.flatMap(([label, value]) => (value && value.trim() ? [{ label, value: value.trim() }] : []));

/** A typed amount in pesos with two decimals; text that isn't an amount reads as typed. */
function pesos(value: string): string {
  const amount = typedAmount(value);
  return amount === null ? value.trim() : formatCurrency(amount);
}

const joined = (parts: readonly string[], separator: string) => parts.map((s) => s.trim()).filter(Boolean).join(separator);

export function personalRows(p: ApplicantPersonal, branches: readonly { id: number; name: string }[]): ReviewRow[] {
  return rows([
    ["Name", joined([p.first_name, p.middle_name, p.last_name, p.suffix], " ")],
    ["Date of birth", /^\d{4}-\d{2}-\d{2}$/.test(p.date_of_birth) ? formatDate(p.date_of_birth) : p.date_of_birth],
    ["Gender", inWords(p.gender, GENDER_OPTIONS)],
    ["Civil status", inWords(p.civil_status, CIVIL_STATUS_OPTIONS)],
    ["Nationality", p.nationality],
    ["Number of dependents", p.dependents],
    ["Address", joined([p.street_address, p.barangay, p.city, p.province, p.region, p.postal_code], ", ")],
    ["Years at this address", p.years_at_residence],
    ["This home is", inWords(p.residence_ownership, RESIDENCE_OWNERSHIP)],
    ["Membership number", p.membership_number],
    ["Nearest branch", branches.find((b) => b.id === p.branch_id)?.name],
  ]);
}

type IncomeField = Exclude<keyof ApplicantEmployment, "income_source">;
type Kind = "text" | "money" | "frequency" | "employment_type";

/** The Income step's fields in its order, with the review's labels. */
const INCOME_FIELDS: readonly { field: IncomeField; label: string; kind: Kind }[] = [
  { field: "employer_name", label: "Employer", kind: "text" },
  { field: "job_title", label: "Job title", kind: "text" },
  { field: "employment_type", label: "Employment type", kind: "employment_type" },
  { field: "years_employed", label: "Years with this employer", kind: "text" },
  { field: "gross_monthly_income", label: "Gross monthly pay", kind: "money" },
  { field: "net_monthly_income", label: "Take-home pay a month", kind: "money" },
  { field: "salary_frequency", label: "How often you're paid", kind: "frequency" },
  { field: "employer_address", label: "Employer address", kind: "text" },
  { field: "business_name", label: "Business name", kind: "text" },
  { field: "business_type", label: "Type of business", kind: "text" },
  { field: "years_operating", label: "Years in operation", kind: "text" },
  { field: "business_address", label: "Business address", kind: "text" },
  { field: "monthly_revenue", label: "Average sales a month", kind: "money" },
  { field: "monthly_business_expenses", label: "Business costs a month", kind: "money" },
  { field: "monthly_net_business_income", label: "Net income a month", kind: "money" },
  { field: "other_source_description", label: "Source of income", kind: "text" },
  { field: "other_income_amount", label: "Amount received", kind: "money" },
  { field: "other_income_frequency", label: "How often you receive it", kind: "frequency" },
  { field: "other_income_details", label: "Details", kind: "text" },
  { field: "other_regular_income", label: "Other regular income a month", kind: "money" },
];

function answer(kind: Kind, value: string): string | null {
  if (!value.trim()) return null;
  if (kind === "money") return pesos(value);
  if (kind === "frequency") return FREQUENCY_LABELS[value as IncomeFrequency] ?? inWords(value);
  if (kind === "employment_type") return inWords(value, EMPLOYMENT_TYPES);
  return value;
}

/** The income source and the fields the Income step shows (`visibleFields`), as entered. */
export function incomeRows(e: ApplicantEmployment, shown: ReadonlySet<string>): ReviewRow[] {
  return rows([
    ["Main source", e.income_source ? INCOME_SOURCE_LABELS[e.income_source] : null],
    ...INCOME_FIELDS.filter(({ field }) => shown.has(field)).map(({ field, label, kind }): [string, string | null] => [label, answer(kind, e[field])]),
  ]);
}

/** An existing loan in one line: "₱1,500.00 weekly · ₱12,000.00 left · 8 payments left". */
function existingLoan(l: ExistingDebt): string {
  const term = l.remaining_term.trim();
  return joined(
    [
      l.payment_amount.trim() ? joined([pesos(l.payment_amount), l.payment_frequency ? FREQUENCY_LABELS[l.payment_frequency].toLowerCase() : ""], " ") : "",
      l.outstanding_balance.trim() ? `${pesos(l.outstanding_balance)} left` : "",
      term ? `${term} ${term === "1" ? "payment" : "payments"} left` : "",
    ],
    " · ",
  );
}

/** Expenses, the loans still being paid and the other regular payments, as entered. */
export function expenseRows(x: ApplicantExpenses): ReviewRow[] {
  const amount = (key: keyof ApplicantExpenses) => answer("money", x[key] as string);
  return rows([
    ...EXPENSE_LINES.map(({ key, label }): [string, string | null] => [label, amount(key)]),
    ["Loans still being paid", x.has_existing_loans === null ? null : x.has_existing_loans ? "Yes" : "No"],
    ...(x.has_existing_loans ? x.existing_loans : []).map((l): [string, string] => [l.institution.trim() || "Unnamed lender", existingLoan(l)]),
    ...DEBT_LINES.map(({ key, label }): [string, string | null] => [label, amount(key)]),
  ]);
}
