/**
 * The capacity assessment as the server stored it (AssessmentPresenter,
 * LO-B4). Every figure, ratio, limit and check is the server's: the DTI comes
 * rounded up and the coverage rounded down, so a failing figure never reads as
 * passing, and the screen shows them exactly as sent. Nothing is compared or
 * rounded here.
 */

import { formatCurrency } from "@/lib/format";
import type { Tone } from "@/lib/loan-origination";
import type {
  ApplicationStatus,
  Assessment,
  AssessmentFigures,
  AssessmentThresholds,
  RerunAssessmentInput,
} from "@/types/loan-origination";
import { padDecimals } from "./server-number";

/** The statuses an application can be assessed in (AssessmentService::ASSESSABLE_STATUSES). */
export const ASSESSABLE_STATUSES: readonly ApplicationStatus[] = [
  "submitted",
  "document_verification",
  "additional_info_required",
  "under_assessment",
];

/** Running the assessment or saving notes: assessable, and not handed off yet. */
export function canRunAssessment(a: { status: ApplicationStatus; loan_id: number | null }): boolean {
  return a.loan_id === null && ASSESSABLE_STATUSES.includes(a.status);
}

/** The figures that count a linked member's loans (MemberLoanFigures::FIGURES). */
export const WITHHELD_FIGURES: readonly (keyof AssessmentFigures)[] = [
  "lendy_debt_payments",
  "monthly_debt_payments",
  "disposable_income",
  "dti_ratio",
  "coverage_ratio",
  "remaining_income",
];

export const WITHHELD_SENTENCE =
  "Figures that count the linked member's loans are withheld: seeing them needs the permissions to view loans and members, and access to the member's branch.";

type Shown = Pick<Assessment, "figures" | "member_figures_hidden">;

/** The monthly figures, labelled as the server's PDF labels them. */
export const FIGURE_ROWS: readonly { key: keyof AssessmentFigures; label: string }[] = [
  { key: "declared_monthly_income", label: "Declared income" },
  { key: "verified_monthly_income", label: "Verified income" },
  { key: "eligible_monthly_income", label: "Eligible income" },
  { key: "monthly_expenses", label: "Expenses" },
  { key: "outside_debt_payments", label: "Debt payments elsewhere" },
  { key: "lendy_debt_payments", label: "Debt payments on Lendy loans" },
  { key: "disposable_income", label: "Disposable income" },
  { key: "proposed_monthly_installment", label: "Proposed instalment" },
];

function withheld(a: Shown, key: keyof AssessmentFigures): boolean {
  return a.member_figures_hidden && a.figures[key] === null && WITHHELD_FIGURES.includes(key);
}

/**
 * A ratio with the two decimals the server worked it out to, padded but
 * never rounded: 40.1 reads "40.10", as the server's explanation writes it.
 */
export function ratioText(value: number | null | undefined): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return padDecimals(value, 2);
}

export function dtiText(a: Shown): string {
  if (withheld(a, "dti_ratio")) return "Withheld";
  const text = ratioText(a.figures.dti_ratio);
  return text === null ? "—" : `${text}%`;
}

export function coverageText(a: Shown): string {
  if (withheld(a, "coverage_ratio")) return "Withheld";
  return ratioText(a.figures.coverage_ratio) ?? "—";
}

/** A peso figure: "Withheld" for a member loan figure this viewer can't see, a dash when not worked out. */
export function figureText(a: Shown, key: keyof AssessmentFigures): string {
  if (withheld(a, key)) return "Withheld";
  const value = a.figures[key];
  return value === null || value === undefined ? "—" : formatCurrency(value);
}

/** A limit's colour, from the server's own check. */
export function checkTone(passed: boolean | null | undefined): Tone {
  if (passed === true) return "success";
  if (passed === false) return "danger";
  return "neutral";
}

/** A limit's check in words, as the PDF writes it. */
export function checkWords(passed: boolean | null | undefined): string {
  if (passed === true) return "Passes";
  if (passed === false) return "Fails";
  return "Not worked out";
}

/** A limit as the server stores it (decimals kept): "at most 40%", "at least 1.25", "at least ₱0.00". */
export function limitWords(check: "dti" | "coverage" | "remaining_income", limits: AssessmentThresholds): string {
  if (check === "dti") return `at most ${limits.max_dti}%`;
  if (check === "coverage") return `at least ${limits.min_coverage}`;
  return `at least ${formatCurrency(limits.min_remaining_income)}`;
}

export interface RerunForm {
  /** Blank keeps the last run's figure. */
  verifiedIncome: string;
  /** Clear the last run's verified income: the declared income counts again. */
  clearIncome: boolean;
  verifiedDebt: string;
  clearDebt: boolean;
  /** `YYYY-MM-DD`; blank is today. */
  startDate: string;
}

/** The largest amount the server takes (`decimal(15,2)`). */
const MAX_WHOLE_DIGITS = 13;

/**
 * A peso amount as typed, cleaned (commas, spaces and ₱ dropped) and kept as
 * an exact string, or the server's words for why it isn't one.
 */
function pesos(raw: string, label: string): { value: string } | { problem: string } {
  const cleaned = raw.replace(/[,\s₱]/g, "");
  if (cleaned.startsWith("-")) return { problem: `The ${label} can't be below ₱0.00.` };
  const match = /^(\d+)(?:\.(\d+))?$/.exec(cleaned);
  if (!match) return { problem: `Enter the ${label} as an amount in pesos, like 25000.` };
  if ((match[2] ?? "").length > 2) return { problem: `Enter the ${label} with at most two decimals.` };
  if (match[1].replace(/^0+(?=\d)/, "").length > MAX_WHOLE_DIGITS) return { problem: `The ${label} is too large.` };
  return { value: cleaned };
}

/**
 * `POST …/assessment/rerun`: a figure entered is sent as an exact string; a
 * cleared one as null, which the server reads as not verified (the declared
 * figure counts again); a blank one is left out, so the server keeps the last
 * run's. The start date goes when chosen. Problems are the server's own words
 * (RunAssessmentRequest).
 */
export function rerunPayload(form: RerunForm): { payload: RerunAssessmentInput; problems: string[] } {
  const payload: RerunAssessmentInput = {};
  const problems: string[] = [];
  const amounts = [
    ["verified_monthly_income", form.verifiedIncome, form.clearIncome, "verified monthly income"],
    ["verified_debt_payments", form.verifiedDebt, form.clearDebt, "verified monthly debt payments"],
  ] as const;
  for (const [field, raw, clear, label] of amounts) {
    if (clear) {
      payload[field] = null;
      continue;
    }
    if (raw.trim() === "") continue;
    const read = pesos(raw, label);
    if ("problem" in read) problems.push(read.problem);
    else payload[field] = read.value;
  }
  const start = form.startDate.trim();
  if (start !== "") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(start)) payload.start_date = start;
    else problems.push("Enter the start date as a date, like 2026-11-19.");
  }
  return { payload, problems };
}
