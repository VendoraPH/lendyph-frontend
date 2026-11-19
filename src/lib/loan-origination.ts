/**
 * Loan Origination rules the screens share, as pure functions: status labels
 * and allowed moves, what an applicant is told, the declared amounts as
 * entered, the wizard's own checks, and dashboard rates.
 *
 * The server is the authority for every one of these. The transitions here
 * only decide which buttons to offer; the API refuses any other move. The
 * assessment figures are never computed here: the browser shows what the
 * server calculated (see `docs/LOAN_ORIGINATION_BACKEND_HANDOFF.md`).
 */

import type {
  ApplicantEmployment,
  ApplicantExpenses,
  ApplicantLoanRequest,
  ApplicantPersonal,
  ApplicationDraft,
  ApplicationStatus,
  AssessmentResult,
  BorrowerFacingStatus,
  DocumentStatus,
  IncomeFrequency,
  IncomeSource,
  OtpRequestResult,
  PublicApplicationPortal,
  PublicLoanProduct,
  ReminderResult,
} from "@/types/loan-origination";
import { DOCUMENT_EXTENSIONS } from "./file-validation";
import { formatCurrency } from "./format";

export type Tone = "neutral" | "info" | "warning" | "success" | "danger";

export const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  info: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300",
  warning: "bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300",
  success: "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300",
  danger: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300",
};

// ── Application statuses ───────────────────────────────────────────────────

export const APPLICATION_STATUSES: readonly ApplicationStatus[] = [
  "draft",
  "incomplete",
  "submitted",
  "document_verification",
  "additional_info_required",
  "under_assessment",
  "pending_approval",
  "approved",
  "rejected",
  "withdrawn",
  "converted",
  "expired",
];

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  draft: "Draft",
  incomplete: "Incomplete",
  submitted: "Submitted",
  document_verification: "Under Document Verification",
  additional_info_required: "Additional Information Required",
  under_assessment: "Under Assessment",
  pending_approval: "Pending Approval",
  approved: "Approved",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  converted: "Converted to Loan",
  expired: "Expired",
};

export const STATUS_TONES: Record<ApplicationStatus, Tone> = {
  draft: "neutral",
  incomplete: "neutral",
  submitted: "info",
  document_verification: "info",
  additional_info_required: "warning",
  under_assessment: "info",
  pending_approval: "warning",
  approved: "success",
  rejected: "danger",
  withdrawn: "neutral",
  converted: "success",
  expired: "neutral",
};

/**
 * The moves staff may make by hand. Draft → incomplete → submitted belong to
 * the applicant (and the expiry job), approved → converted to the conversion
 * action, and approval itself to the existing approval workflow, so none of
 * those appear here.
 */
export const STAFF_TRANSITIONS: Record<ApplicationStatus, readonly ApplicationStatus[]> = {
  draft: [],
  incomplete: [],
  submitted: ["document_verification", "additional_info_required", "rejected"],
  document_verification: ["additional_info_required", "under_assessment", "rejected"],
  additional_info_required: ["document_verification", "under_assessment", "rejected", "withdrawn"],
  under_assessment: ["additional_info_required", "pending_approval", "rejected"],
  pending_approval: ["additional_info_required", "rejected"],
  approved: [],
  rejected: [],
  withdrawn: [],
  converted: [],
  expired: [],
};

export function allowedTransitions(status: ApplicationStatus): readonly ApplicationStatus[] {
  return STAFF_TRANSITIONS[status] ?? [];
}

/** Statuses where nothing more happens to the application. */
export function isClosed(status: ApplicationStatus): boolean {
  return ["rejected", "withdrawn", "converted", "expired"].includes(status);
}

/** Not yet submitted: never a loan application until the applicant submits. */
export function isUnsubmitted(status: ApplicationStatus): boolean {
  return status === "draft" || status === "incomplete";
}

/** The status an applicant sees. Internal steps all read "Under Review". */
export function borrowerFacingStatus(status: ApplicationStatus): BorrowerFacingStatus {
  switch (status) {
    case "draft":
    case "incomplete":
      return "draft";
    case "submitted":
      return "received";
    case "document_verification":
    case "under_assessment":
    case "pending_approval":
      return "under_review";
    case "additional_info_required":
      return "additional_info_required";
    case "approved":
    case "converted":
      return "approved";
    case "rejected":
      return "not_approved";
    case "withdrawn":
      return "withdrawn";
    case "expired":
      return "expired";
  }
}

export const BORROWER_STATUS_LABELS: Record<BorrowerFacingStatus, string> = {
  draft: "Not yet submitted",
  received: "Application Received",
  under_review: "Under Review",
  additional_info_required: "Additional Information Required",
  decision_available: "Decision Available",
  approved: "Approved",
  not_approved: "Not Approved",
  withdrawn: "Withdrawn",
  expired: "Expired",
};

export const BORROWER_STATUS_TONES: Record<BorrowerFacingStatus, Tone> = {
  draft: "neutral",
  received: "info",
  under_review: "info",
  additional_info_required: "warning",
  decision_available: "info",
  approved: "success",
  not_approved: "danger",
  withdrawn: "neutral",
  expired: "neutral",
};

// ── Documents and assessments ──────────────────────────────────────────────

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  not_submitted: "Not Submitted",
  uploaded: "Uploaded",
  pending_verification: "Pending Verification",
  verified: "Verified",
  rejected: "Rejected",
  replacement_requested: "Replacement Requested",
};

export const DOCUMENT_STATUS_TONES: Record<DocumentStatus, Tone> = {
  not_submitted: "neutral",
  uploaded: "info",
  pending_verification: "warning",
  verified: "success",
  rejected: "danger",
  replacement_requested: "warning",
};

/** A file staff can still act on (verify, reject, ask for another). */
export function documentAwaitsReview(status: DocumentStatus): boolean {
  return status === "uploaded" || status === "pending_verification";
}

export const ASSESSMENT_LABELS: Record<AssessmentResult, string> = {
  within_capacity: "Appears Within Configured Capacity",
  further_review: "Requires Further Financial Review",
  above_capacity: "Appears Above Configured Capacity",
  insufficient_information: "Insufficient Verified Information",
};

/** Short form for table cells. */
export const ASSESSMENT_SHORT_LABELS: Record<AssessmentResult, string> = {
  within_capacity: "Within capacity",
  further_review: "Further review",
  above_capacity: "Above capacity",
  insufficient_information: "Insufficient info",
};

export const ASSESSMENT_TONES: Record<AssessmentResult, Tone> = {
  within_capacity: "success",
  further_review: "warning",
  above_capacity: "danger",
  insufficient_information: "neutral",
};

/** Whether a computed ratio passes a configured limit, for colouring only. */
export function ratioTone(
  value: number | null,
  limit: number,
  direction: "max" | "min",
): Tone {
  if (value === null || !Number.isFinite(value)) return "neutral";
  const passes = direction === "max" ? value <= limit : value >= limit;
  return passes ? "success" : "danger";
}

// ── Income and frequencies ─────────────────────────────────────────────────

export const INCOME_SOURCE_LABELS: Record<IncomeSource, string> = {
  employed: "Employed",
  self_employed: "Self-Employed",
  business_owner: "Business Owner",
  farmer: "Farmer or Agricultural Income Earner",
  pensioner: "Pensioner",
  other: "Other Income Source",
};

export const FREQUENCY_LABELS: Record<IncomeFrequency, string> = {
  daily: "Daily",
  weekly: "Weekly",
  bi_weekly: "Every two weeks",
  semi_monthly: "Twice a month",
  monthly: "Monthly",
  quarterly: "Every three months",
  semi_annual: "Every six months",
  annual: "Yearly",
};

/** Options a wizard select offers: the stored value and its words. */
export type Option = { value: string; label: string };

export const EMPLOYMENT_TYPES: readonly Option[] = [
  { value: "regular", label: "Regular or permanent" },
  { value: "contractual", label: "Contractual" },
  { value: "probationary", label: "Probationary" },
  { value: "government", label: "Government" },
  { value: "ofw", label: "Overseas worker" },
];

export const RELEASE_METHODS: readonly Option[] = [
  { value: "cash", label: "Cash at the office" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "gcash", label: "GCash" },
  { value: "check", label: "Check" },
];

/**
 * A stored key in words: its option's label, a frequency's label, else the
 * key with spaces and a capital ("bi_weekly" reads "Bi weekly").
 */
export function inWords(value: string | null | undefined, options: readonly Option[] = []): string | null {
  if (!value) return null;
  const option = options.find((o) => o.value === value);
  if (option) return option.label;
  if (value in FREQUENCY_LABELS) return FREQUENCY_LABELS[value as IncomeFrequency];
  const text = value.replace(/_/g, " ").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : null;
}

/**
 * A money field's value as a number, or null when blank or not a number.
 * Commas are accepted ("25,000"); a negative amount is not an amount.
 */
export function parseAmount(value: string): number | null {
  const cleaned = value.replace(/[,\s₱]/g, "");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** A label and what the applicant entered for it, ready to show. */
export type DeclaredRow = [label: string, value: string];

/** An entered amount in pesos, with its frequency in words when it has one. */
function declared(value: string, frequency?: IncomeFrequency | ""): string | null {
  const n = parseAmount(value);
  if (n === null) return null;
  return frequency ? `${formatCurrency(n)} ${FREQUENCY_LABELS[frequency].toLowerCase()}` : formatCurrency(n);
}

function rows(entries: [string, string | null][]): DeclaredRow[] {
  return entries.filter((e): e is DeclaredRow => e[1] !== null && e[1] !== "");
}

/**
 * The income the applicant declared, each amount as entered. Nothing is added
 * up or converted to a month here: the server's assessment works out monthly
 * income by its own recognition rules (`AssessmentFigures`).
 */
export function declaredIncomeRows(e: ApplicantEmployment): DeclaredRow[] {
  const other: [string, string | null] = ["Other regular income a month", declared(e.other_regular_income)];
  switch (e.income_source) {
    case "employed":
      return rows([
        ["Gross monthly pay", declared(e.gross_monthly_income)],
        ["Take-home pay a month", declared(e.net_monthly_income)],
        ["Paid", e.salary_frequency ? FREQUENCY_LABELS[e.salary_frequency] : null],
        other,
      ]);
    case "self_employed":
    case "business_owner":
      return rows([
        ["Average sales a month", declared(e.monthly_revenue)],
        ["Business costs a month", declared(e.monthly_business_expenses)],
        ["Net income a month", declared(e.monthly_net_business_income)],
        other,
      ]);
    case "farmer":
    case "pensioner":
    case "other":
      return rows([["Amount received", declared(e.other_income_amount, e.other_income_frequency)], other]);
    default:
      return [];
  }
}

/** Monthly household expenses, as the wizard asks for them. */
export const EXPENSE_LINES: readonly { key: keyof ApplicantExpenses & string; label: string }[] = [
  { key: "housing", label: "Rent or housing" },
  { key: "utilities", label: "Electricity, water and internet" },
  { key: "food", label: "Food" },
  { key: "transportation", label: "Transportation" },
  { key: "education", label: "School fees" },
  { key: "family_support", label: "Support to family" },
  { key: "other_essential", label: "Other necessary expenses" },
];

/** Other regular payments, as the wizard asks for them. */
export const DEBT_LINES: readonly { key: keyof ApplicantExpenses & string; label: string }[] = [
  { key: "credit_card_payments", label: "Credit card payments" },
  { key: "other_debt_payments", label: "Other debt payments" },
  { key: "other_commitments", label: "Other regular commitments" },
];

/**
 * The expenses and debts the applicant declared, each line as entered, then
 * each existing loan's payment with its frequency. No totals: the server's
 * assessment adds them up.
 */
export function declaredExpenseRows(x: ApplicantExpenses): DeclaredRow[] {
  return rows([
    ...[...EXPENSE_LINES, ...DEBT_LINES].map(({ key, label }): [string, string | null] => [label, declared(x[key] as string)]),
    ...(x.has_existing_loans ? x.existing_loans : []).map((l): [string, string | null] => [
      l.institution.trim() || "Unnamed lender",
      declared(l.payment_amount, l.payment_frequency),
    ]),
  ]);
}

// ── Wizard ─────────────────────────────────────────────────────────────────

export const WIZARD_STEPS = [
  { id: "product", title: "Loan product" },
  { id: "contact", title: "Verify contact" },
  { id: "personal", title: "Personal details" },
  { id: "employment", title: "Income" },
  { id: "expenses", title: "Expenses and debts" },
  { id: "loan", title: "Loan details" },
  { id: "documents", title: "Documents" },
  { id: "review", title: "Review and submit" },
] as const;

export type WizardStepId = (typeof WIZARD_STEPS)[number]["id"];

/** Field key to a message the applicant can act on. Empty means it passes. */
export type WizardErrors = Record<string, string>;

const MOBILE_RE = /^(?:\+?63|0)9\d{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeMobile(value: string): string {
  return value.replace(/[\s-()]/g, "");
}

export function validateContact(mobile: string, email: string): WizardErrors {
  const errors: WizardErrors = {};
  if (!MOBILE_RE.test(normalizeMobile(mobile))) {
    errors.mobile = "Enter a Philippine mobile number, like 09171234567.";
  }
  if (email.trim() && !EMAIL_RE.test(email.trim())) {
    errors.email = "Enter a valid email address, or leave it blank.";
  }
  return errors;
}

/** Whole years between a `YYYY-MM-DD` birth date and `today` (`YYYY-MM-DD`). */
export function ageOn(dateOfBirth: string, today: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOfBirth);
  const t = /^(\d{4})-(\d{2})-(\d{2})$/.exec(today);
  if (!m || !t) return null;
  let age = Number(t[1]) - Number(m[1]);
  if (Number(t[2]) < Number(m[2]) || (t[2] === m[2] && Number(t[3]) < Number(m[3]))) age -= 1;
  return age;
}

export function validatePersonal(p: ApplicantPersonal, today: string): WizardErrors {
  const errors: WizardErrors = {};
  if (!p.first_name.trim()) errors.first_name = "Enter your first name.";
  if (!p.last_name.trim()) errors.last_name = "Enter your last name.";
  const age = ageOn(p.date_of_birth, today);
  if (age === null) errors.date_of_birth = "Enter your date of birth.";
  else if (age < 18) errors.date_of_birth = "You must be at least 18 years old to apply.";
  else if (age > 120) errors.date_of_birth = "Check the year of your date of birth.";
  if (!p.province.trim()) errors.province = "Enter your province.";
  if (!p.city.trim()) errors.city = "Enter your city or municipality.";
  if (!p.barangay.trim()) errors.barangay = "Enter your barangay.";
  if (!p.street_address.trim()) errors.street_address = "Enter your house number and street.";
  if (p.postal_code.trim() && !/^\d{4}$/.test(p.postal_code.trim())) {
    errors.postal_code = "A postal code has 4 digits.";
  }
  if (p.dependents.trim() && !/^\d{1,2}$/.test(p.dependents.trim())) {
    errors.dependents = "Enter the number of dependents, like 2.";
  }
  return errors;
}

function requireAmount(errors: WizardErrors, key: string, value: string, label: string) {
  if (parseAmount(value) === null) errors[key] = `Enter your ${label}.`;
}

function optionalAmount(errors: WizardErrors, key: string, value: string) {
  if (value.trim() && parseAmount(value) === null) errors[key] = "Enter an amount in pesos, like 5000.";
}

export function validateEmployment(e: ApplicantEmployment): WizardErrors {
  const errors: WizardErrors = {};
  optionalAmount(errors, "other_regular_income", e.other_regular_income);
  switch (e.income_source) {
    case "":
      errors.income_source = "Choose where most of your income comes from.";
      break;
    case "employed":
      if (!e.employer_name.trim()) errors.employer_name = "Enter your employer's name.";
      if (!e.job_title.trim()) errors.job_title = "Enter your job title.";
      requireAmount(errors, "gross_monthly_income", e.gross_monthly_income, "gross monthly income");
      optionalAmount(errors, "net_monthly_income", e.net_monthly_income);
      if (!e.salary_frequency) errors.salary_frequency = "Choose how often you are paid.";
      break;
    case "self_employed":
    case "business_owner":
      if (!e.business_type.trim()) errors.business_type = "Enter the type of business.";
      requireAmount(errors, "monthly_revenue", e.monthly_revenue, "average monthly revenue");
      optionalAmount(errors, "monthly_business_expenses", e.monthly_business_expenses);
      optionalAmount(errors, "monthly_net_business_income", e.monthly_net_business_income);
      break;
    default:
      if (!e.other_source_description.trim()) errors.other_source_description = "Describe your source of income.";
      requireAmount(errors, "other_income_amount", e.other_income_amount, "income amount");
      if (!e.other_income_frequency) errors.other_income_frequency = "Choose how often you receive it.";
  }
  return errors;
}

export function validateExpenses(x: ApplicantExpenses): WizardErrors {
  const errors: WizardErrors = {};
  for (const key of [
    "housing",
    "utilities",
    "food",
    "transportation",
    "education",
    "family_support",
    "other_essential",
    "credit_card_payments",
    "other_debt_payments",
    "other_commitments",
  ] as const) {
    optionalAmount(errors, key, x[key]);
  }
  if (x.has_existing_loans === null) errors.has_existing_loans = "Tell us whether you have existing loans.";
  if (x.has_existing_loans) {
    if (x.existing_loans.length === 0) errors.existing_loans = "Add at least one existing loan.";
    x.existing_loans.forEach((l, i) => {
      if (!l.institution.trim()) errors[`existing_loans.${i}.institution`] = "Enter the lender's name.";
      if (parseAmount(l.payment_amount) === null) {
        errors[`existing_loans.${i}.payment_amount`] = "Enter the regular payment amount.";
      }
      if (!l.payment_frequency) errors[`existing_loans.${i}.payment_frequency`] = "Choose how often you pay.";
      optionalAmount(errors, `existing_loans.${i}.outstanding_balance`, l.outstanding_balance);
    });
  }
  return errors;
}

export function validateLoanRequest(
  l: ApplicantLoanRequest,
  product: PublicLoanProduct | undefined,
): WizardErrors {
  const errors: WizardErrors = {};
  if (!product) {
    errors.loan_product_id = "Choose a loan product.";
    return errors;
  }
  const amount = parseAmount(l.amount);
  if (amount === null || amount <= 0) errors.amount = "Enter the amount you want to borrow.";
  else if (amount < product.min_amount || amount > product.max_amount) {
    errors.amount = `Enter an amount from ${formatCurrency(product.min_amount)} to ${formatCurrency(product.max_amount)}.`;
  }
  const term = Number(l.term);
  if (!l.term || !Number.isInteger(term)) errors.term = "Choose a repayment term.";
  else if (term < product.min_term || term > product.max_term) {
    errors.term = `Choose a term from ${product.min_term} to ${product.max_term} ${product.term_unit}.`;
  }
  if (!l.purpose.trim()) errors.purpose = "Tell us what the loan is for.";
  if (product.payment_frequencies.length > 1 && !l.frequency) errors.frequency = "Choose how often you will pay.";
  return errors;
}

/** Steps whose data the draft holds, for the completion percentage. */
export function completedSteps(
  draft: ApplicationDraft,
  product: PublicLoanProduct | undefined,
  today: string,
  contactVerified: boolean,
  documentsComplete: boolean,
): WizardStepId[] {
  const done: WizardStepId[] = [];
  if (draft.loan.loan_product_id !== null) done.push("product");
  if (contactVerified) done.push("contact");
  if (Object.keys(validatePersonal(draft.personal, today)).length === 0) done.push("personal");
  if (Object.keys(validateEmployment(draft.employment)).length === 0) done.push("employment");
  if (Object.keys(validateExpenses(draft.expenses)).length === 0) done.push("expenses");
  if (Object.keys(validateLoanRequest(draft.loan, product)).length === 0) done.push("loan");
  if (documentsComplete) done.push("documents");
  return done;
}

/** Percent of the steps before Review that are complete. */
export function completionPercent(done: readonly WizardStepId[]): number {
  const total = WIZARD_STEPS.length - 1;
  const counted = done.filter((id) => id !== "review").length;
  return Math.round((Math.min(counted, total) / total) * 100);
}

export function emptyDraft(): ApplicationDraft {
  return {
    personal: {
      first_name: "",
      middle_name: "",
      last_name: "",
      suffix: "",
      date_of_birth: "",
      gender: "",
      civil_status: "",
      nationality: "Filipino",
      region: "",
      province: "",
      city: "",
      barangay: "",
      street_address: "",
      postal_code: "",
      years_at_residence: "",
      residence_ownership: "",
      dependents: "",
      membership_number: "",
      branch_id: null,
    },
    employment: {
      income_source: "",
      employer_name: "",
      employment_type: "",
      job_title: "",
      years_employed: "",
      employer_address: "",
      gross_monthly_income: "",
      net_monthly_income: "",
      other_regular_income: "",
      salary_frequency: "",
      business_name: "",
      business_type: "",
      business_address: "",
      years_operating: "",
      monthly_revenue: "",
      monthly_business_expenses: "",
      monthly_net_business_income: "",
      other_source_description: "",
      other_income_amount: "",
      other_income_frequency: "",
      other_income_details: "",
    },
    expenses: {
      housing: "",
      utilities: "",
      food: "",
      transportation: "",
      education: "",
      family_support: "",
      other_essential: "",
      credit_card_payments: "",
      other_debt_payments: "",
      other_commitments: "",
      has_existing_loans: null,
      existing_loans: [],
    },
    loan: { loan_product_id: null, amount: "", purpose: "", term: "", frequency: "", release_method: "" },
  };
}

/**
 * A saved draft laid over an empty one, so a field the server didn't send
 * (an older draft, a new field) is a blank string rather than undefined.
 */
export function mergeDraft(saved: Partial<ApplicationDraft> | null | undefined): ApplicationDraft {
  const base = emptyDraft();
  if (!saved) return base;
  return {
    personal: { ...base.personal, ...saved.personal },
    employment: { ...base.employment, ...saved.employment },
    expenses: {
      ...base.expenses,
      ...saved.expenses,
      existing_loans: saved.expenses?.existing_loans ?? [],
    },
    loan: { ...base.loan, ...saved.loan },
  };
}

// ── Dashboard ──────────────────────────────────────────────────────────────

/** Percent change from `previous` to `current`, or null when it can't be said. */
export function percentChange(current: number | null | undefined, previous: number | null | undefined): number | null {
  if (typeof current !== "number" || typeof previous !== "number" || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/** "2.5 days" or "6 hours" from a number of hours. */
export function formatDuration(hours: number | null | undefined): string {
  if (typeof hours !== "number" || !Number.isFinite(hours)) return "—";
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < 48) return `${Math.round(hours * 10) / 10} hours`;
  return `${Math.round((hours / 24) * 10) / 10} days`;
}

/** `0917•••4321` style masking for contacts shown to staff without access. */
export function maskMobile(value: string | null | undefined): string {
  if (!value) return "—";
  const digits = value.replace(/\D/g, "");
  if (digits.length < 7) return "•••";
  return `${digits.slice(0, 4)}•••${digits.slice(-4)}`;
}

/** A file size the applicant can read. */
export function formatFileSize(bytes: number | null | undefined): string {
  if (typeof bytes !== "number" || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 102.4) / 10} KB`;
  return `${Math.round(bytes / (1024 * 102.4)) / 10} MB`;
}

/** The member document size limit, which the server applies to every document upload. */
export const MEMBER_DOCUMENT_MAX_MB = 10;

/** The member document file names (`jpg`, `pdf`, …), without the dot. */
const MEMBER_DOCUMENT_TYPES: readonly string[] = DOCUMENT_EXTENSIONS.map((e) => e.slice(1));

const normalizeType = (t: string) => t.trim().toLowerCase().replace(/^\./, "");

/**
 * What the browser lets an applicant pick: the link's file types that the
 * member document rules also take (all of those when the link names none),
 * and the smaller of the link's size and the member document limit. The
 * server checks again by content; this only saves a doomed upload.
 */
export function uploadRules(serverTypes: readonly string[], serverMaxMb: number): { extensions: string[]; maxMb: number } {
  const listed = serverTypes.map(normalizeType).filter(Boolean);
  const extensions =
    listed.length === 0 ? [...MEMBER_DOCUMENT_TYPES] : listed.filter((t, i) => MEMBER_DOCUMENT_TYPES.includes(t) && listed.indexOf(t) === i);
  const maxMb =
    Number.isFinite(serverMaxMb) && serverMaxMb > 0 ? Math.min(serverMaxMb, MEMBER_DOCUMENT_MAX_MB) : MEMBER_DOCUMENT_MAX_MB;
  return { extensions, maxMb };
}

/** For a file input's `accept`. */
export function uploadAccept(serverTypes: readonly string[]): string {
  return uploadRules(serverTypes, 0).extensions.map((t) => `.${t}`).join(",");
}

/** Why a file can't be uploaded, or null when it can, by `uploadRules`. */
export function fileProblem(
  file: { name: string; size: number; type: string },
  acceptedTypes: readonly string[],
  maxMb: number,
): string | null {
  const rules = uploadRules(acceptedTypes, maxMb);
  const dot = file.name.lastIndexOf(".");
  const ext = dot >= 0 ? file.name.slice(dot + 1).toLowerCase() : "";
  if (!rules.extensions.includes(ext)) {
    return rules.extensions.length === 0
      ? "Files can't be uploaded here right now. Please contact the office."
      : `Upload a ${rules.extensions.map((t) => t.toUpperCase()).join(", ")} file.`;
  }
  if (file.size === 0) return "This file is empty. Choose another.";
  if (file.size > rules.maxMb * 1024 * 1024) return `This file is larger than ${rules.maxMb} MB.`;
  return null;
}

/** What Settings would let applicants upload beyond the member document rules. */
export function uploadSettingsProblems(documents: { accepted_file_types: readonly string[]; max_upload_mb: number }): string[] {
  const out: string[] = [];
  const outside = documents.accepted_file_types.map(normalizeType).filter((t) => t && !MEMBER_DOCUMENT_TYPES.includes(t));
  if (outside.length > 0) {
    out.push(
      `Applicants can upload only the member document types (JPG, PNG, PDF, DOC, DOCX). Remove ${outside.map((t) => t.toUpperCase()).join(", ")}.`,
    );
  }
  if (documents.max_upload_mb > MEMBER_DOCUMENT_MAX_MB) {
    out.push(`The largest file can be at most ${MEMBER_DOCUMENT_MAX_MB} MB, as for member documents.`);
  }
  return out;
}

// ── What the applicant and staff are told ──────────────────────────────────

/**
 * The line under the code box. Sending is log-only until the owner signs, so
 * "we sent" is said only when the server reports the message went out.
 */
export function otpSentMessage(result: OtpRequestResult): string {
  if (result.delivered === true) {
    return `We sent a code to ${result.destination}. It expires in ${Math.round(result.expires_in / 60)} minutes.`;
  }
  return `Text and email sending is not switched on yet, so no message went out to ${result.destination}. Please contact the office to continue.`;
}

/** The toast after "Remind applicant", by what the server says it did. */
export function reminderNotice(result: ReminderResult): string {
  return result.delivered === true
    ? "Reminder sent to the applicant"
    : "Reminder logged. Sending is not switched on yet, so nothing went out.";
}

/** True until the server marks every text the applicant accepts as final (the owner's wording). */
export function consentIsDraft(
  portal: Pick<PublicApplicationPortal, "privacy_notice" | "terms" | "declaration" | "credit_authorization">,
): boolean {
  const texts = [portal.privacy_notice, portal.terms, portal.declaration, portal.credit_authorization];
  return texts.some((t) => t !== null && t?.final !== true);
}

/** The "All" chip's count: the server's `meta.stats.total`, never a sum of the per-status counts. */
export function allStatusCount(stats: Record<string, number> | undefined): number | undefined {
  return typeof stats?.total === "number" ? stats.total : undefined;
}

/** Why Settings can't be saved, or null. They apply to every branch, like Savings and Reminders settings. */
export function settingsSaveBlocker(viewAll: boolean): string | null {
  return viewAll ? null : "These settings apply to all branches, so saving them needs access to all branches.";
}
