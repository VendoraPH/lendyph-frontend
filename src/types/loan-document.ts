/**
 * Payload shapes for the two loan document endpoints.
 *
 * These are transcriptions of what the backend actually returns —
 * `DisclosureService::generateDisclosure()` and
 * `PromissoryNoteService::generatePromissoryNote()` — both of which are
 * **nested** (`borrower.full_name`, `loan_terms.term`).
 *
 * They used to be declared flat (`borrower_name`, `term_months`,
 * `payment_frequency`), which was not a cosmetic mismatch: the loan detail page
 * guarded its API branch on `apiData.borrower_name`, a key the API has never
 * sent, so that branch was unreachable and every disclosure and promissory note
 * ever printed came from an inline reconstruction of the loan object instead.
 *
 * Fields are typed as nullable where the underlying column is nullable, so a
 * consumer has to decide what to print for a member with no e-mail address
 * rather than interpolating `null` onto a signed document.
 */

import type { LoanDeduction } from "./loan";

/** Borrower block, common to both documents. */
export interface LoanDocumentBorrower {
  borrower_code: string | null;
  full_name: string;
  address: string | null;
  contact_number: string | null;
  email: string | null;
  employer_or_business: string | null;
  monthly_income: number;
}

/** One period of the amortization table carried by the disclosure. */
export interface LoanDocumentScheduleRow {
  period_number: number;
  due_date: string;
  principal_due: number;
  interest_due: number;
  total_due: number;
  remaining_balance: number;
}

// ---------------------------------------------------------------------------
// Disclosure Statement — GET /loans/{id}/disclosure
// ---------------------------------------------------------------------------

export interface LoanDisclosureTerms {
  application_number: string;
  loan_account_number: string | null;
  loan_product_name: string;
  principal_amount: number;
  interest_rate: number;
  interest_method: string;
  term: number;
  frequency: string;
  penalty_rate: number;
  grace_period_days: number;
  start_date: string;
  maturity_date: string;
}

export interface LoanDisclosureDeductions {
  /** Verbatim `loans.deductions`; `[]` when nothing was withheld. */
  items: LoanDeduction[];
  total_deductions: number;
  net_proceeds: number;
}

export interface LoanDisclosureTotals {
  total_principal: number;
  total_interest: number;
  total_obligation: number;
  total_deductions: number;
  net_proceeds: number;
}

/** Co-maker as the disclosure carries it — name and contact only. */
export interface LoanDisclosureCoMaker {
  full_name: string;
  address: string | null;
  contact_number: string | null;
}

export interface LoanDisclosure {
  document_title: string;
  /** The loan's application number — the disclosure's own quotable reference. */
  reference_number: string;
  generated_at: string;
  borrower: LoanDocumentBorrower;
  loan_terms: LoanDisclosureTerms;
  deductions: LoanDisclosureDeductions;
  totals: LoanDisclosureTotals;
  /**
   * Persisted rows once the loan is released; before that, the server-built
   * preview. Never absent, but may be empty for a loan with no schedule.
   */
  amortization_schedule: LoanDocumentScheduleRow[];
  co_makers: LoanDisclosureCoMaker[];
}

// ---------------------------------------------------------------------------
// Promissory Note — GET /loans/{id}/promissory-note
// ---------------------------------------------------------------------------

/** The note repeats the disclosure's borrower block and adds civil details. */
export interface LoanPromissoryNoteBorrower extends LoanDocumentBorrower {
  birthdate: string | null;
  civil_status: string | null;
  gender: string | null;
}

/**
 * Co-maker as the note carries it — fuller than the disclosure's, because the
 * note is the instrument the co-maker is jointly bound by.
 */
export interface LoanPromissoryNoteCoMaker {
  co_maker_code: string | null;
  full_name: string;
  address: string | null;
  contact_number: string | null;
  occupation: string | null;
  employer: string | null;
  monthly_income: number;
  relationship_to_borrower: string | null;
}

export interface LoanPromissoryNoteTerms {
  application_number: string;
  loan_account_number: string | null;
  principal_amount: number;
  interest_rate: number;
  interest_method: string;
  term: number;
  frequency: string;
  start_date: string;
  maturity_date: string;
  /** Summed from the schedule by the server — do not recompute client-side. */
  total_interest: number;
  total_obligation: number;
  penalty_rate: number;
  grace_period_days: number;
}

/**
 * The note states the repayment plan rather than tabulating it: how many
 * installments, of how much, from when to when.
 */
export interface LoanPromissoryNoteScheduleSummary {
  number_of_installments: number;
  installment_amount: number;
  first_due_date: string;
  last_due_date: string;
}

export interface LoanPromissoryNoteBranch {
  name: string;
  address: string | null;
  contact_number: string | null;
}

export interface LoanPromissoryNoteSignatures {
  borrower_name: string;
  co_maker_names: string[];
  /** Null until the loan clears its approval chain. */
  approved_by: string | null;
}

export interface LoanPromissoryNote {
  document_title: string;
  /** `PN-` + the application number's serial part. */
  reference_number: string;
  generated_at: string;
  borrower: LoanPromissoryNoteBorrower;
  co_makers: LoanPromissoryNoteCoMaker[];
  loan_terms: LoanPromissoryNoteTerms;
  payment_schedule_summary: LoanPromissoryNoteScheduleSummary;
  branch: LoanPromissoryNoteBranch;
  signatures: LoanPromissoryNoteSignatures;
}
