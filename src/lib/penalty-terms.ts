import { formatRate } from "@/lib/format";
import type { Loan, PenaltyBracket } from "@/types/loan";

/**
 * A loan's late penalty terms, in words, as the loan was created with them.
 *
 * A loan created while its product had an active penalty configuration
 * (Settings → Penalties) carries that configuration's brackets; any other
 * loan carries one monthly rate. Both come from the server. This only reads
 * them out: which bracket a charge falls in, and every charge, is decided by
 * the server.
 */
export type PenaltyTermsSource = Pick<Loan, "penalty_rate" | "penalty_brackets" | "penalty_config_name">;

const days = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;

/** A bracket's days late in words: "1–5 days", "3 days", "11 days or more". */
export function bracketRangeLabel(bracket: Pick<PenaltyBracket, "days_from" | "days_to">): string {
  if (bracket.days_to === null) return `${days(bracket.days_from)} or more`;
  if (bracket.days_to === bracket.days_from) return days(bracket.days_from);
  return `${bracket.days_from}–${bracket.days_to} days`;
}

/** One bracket as a line: "1–5 days late: 20%", "11 days or more: 50%". */
export function bracketLine(bracket: PenaltyBracket): string {
  const range = bracketRangeLabel(bracket);
  const late = bracket.days_to === null ? range : `${range} late`;
  return `${late}: ${formatRate(bracket.rate)}%`;
}

/**
 * The loan's penalty terms as lines: one per bracket, else "3% a month", else
 * "No penalty".
 */
export function penaltyTermLines(loan: PenaltyTermsSource): string[] {
  const brackets = loan.penalty_brackets ?? [];
  if (brackets.length > 0) return brackets.map(bracketLine);
  if (Number(loan.penalty_rate ?? 0) > 0) return [`${formatRate(loan.penalty_rate)}% a month`];
  return ["No penalty"];
}

// ---------------------------------------------------------------------------
// The promissory note's and disclosure's penalty wording.
//
// Standard wording for the owner to review (option A): every sentence the two
// documents print about the late penalty is written here and nowhere else.
// It states how the server charges it: on the late instalment's unpaid
// principal, first on the day after the grace period ends, then again on each
// monthly anniversary of the due date while it stays unpaid.
// ---------------------------------------------------------------------------

/** The late penalty terms a loan document prints, read off its payload. */
export interface DocumentPenaltyTerms {
  /** The fixed rate per charge, used when there are no brackets. */
  penaltyRate: number;
  /** The configuration's day ranges, from the server; null on a fixed rate. */
  brackets: PenaltyBracket[] | null;
  /** Days after the due date before the first charge; 0 when none. */
  graceDays: number;
}

function finite(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * The penalty terms in a document's `loan_terms` (`penalty_rate`,
 * `penalty_brackets`, `grace_period_days`), or null when the payload sent
 * neither a rate nor brackets, so the document prints a rule to complete
 * rather than a guess.
 */
export function readDocumentPenaltyTerms(source: Record<string, unknown> | null): DocumentPenaltyTerms | null {
  if (!source) return null;
  const rate = finite(source.penalty_rate);
  const raw = Array.isArray(source.penalty_brackets) ? (source.penalty_brackets as PenaltyBracket[]) : null;
  if (rate === null && raw === null) return null;
  return {
    penaltyRate: rate ?? 0,
    brackets: raw && raw.length > 0 ? raw : null,
    graceDays: Math.max(0, finite(source.grace_period_days) ?? 0),
  };
}

/** Whether any charge can fall: a rate above 0, or a bracket above 0. */
function chargesPenalty(terms: DocumentPenaltyTerms): boolean {
  if (terms.brackets) return terms.brackets.some((b) => Number(b.rate) > 0);
  return terms.penaltyRate > 0;
}

const NO_PENALTY_CLAUSE = "No penalty is charged on late installments.";
const MONTHLY_AGAIN = "and again on each monthly anniversary of its due date while it remains unpaid";
const AT_DAYS_LATE = "each charge at the rate for the number of days the installment is late";

/**
 * The promissory note's DEFAULT / PENALTY sentence, e.g. "If any installment
 * is not paid in full within 3 days after its due date, a penalty of 3% of the
 * unpaid principal of that installment shall be charged when the grace period
 * ends, and again on each monthly anniversary of its due date while it remains
 * unpaid."
 */
export function penaltyClauseText(terms: DocumentPenaltyTerms): string {
  if (!chargesPenalty(terms)) return NO_PENALTY_CLAUSE;
  const late =
    terms.graceDays > 0
      ? `If any installment is not paid in full within ${days(terms.graceDays)} after its due date`
      : "If any installment is not paid in full on its due date";
  const when = terms.graceDays > 0 ? "when the grace period ends" : "on the day after its due date";
  if (terms.brackets) {
    return (
      `${late}, a penalty on the unpaid principal of that installment shall be charged ${when}, ` +
      `${MONTHLY_AGAIN}, ${AT_DAYS_LATE}: ${terms.brackets.map(bracketLine).join("; ")}.`
    );
  }
  return (
    `${late}, a penalty of ${formatRate(terms.penaltyRate)}% of the unpaid principal of that ` +
    `installment shall be charged ${when}, ${MONTHLY_AGAIN}.`
  );
}

/**
 * The disclosure's "Late Payment Penalty" line, the same terms in short form:
 * "3% of a late installment's unpaid principal, charged after a 3-day grace
 * period and again each month it stays unpaid", or "None".
 */
export function penaltyShortText(terms: DocumentPenaltyTerms): string {
  if (!chargesPenalty(terms)) return "None";
  const rate = terms.brackets
    ? `${terms.brackets.map(bracketLine).join("; ")}, of`
    : `${formatRate(terms.penaltyRate)}% of`;
  const when =
    terms.graceDays > 0 ? `after a ${terms.graceDays}-day grace period` : "the day after its due date";
  return `${rate} a late installment's unpaid principal, charged ${when} and again each month it stays unpaid`;
}
