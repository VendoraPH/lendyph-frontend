import type {
  CreditDataUsed,
  CreditScore,
  FactorWithoutData,
  RiskLevel,
  ScoreCategoryBreakdown,
  ScoreFactor,
} from "@/types/credit-scoring";

export const NOT_SCORED_MESSAGE = "Not scored yet";
export const INSUFFICIENT_DATA_MESSAGE = "Insufficient data: no repayment or capacity data";
export const INSUFFICIENT_DATA_SHORT = "Insufficient data";

export type ScoreView =
  | { kind: "scored"; score: number; riskLevel: RiskLevel }
  | { kind: "insufficient_data"; message: string }
  | { kind: "not_scored"; message: string };

type ScoreFields = Pick<CreditScore, "status" | "score" | "risk_level">;

/**
 * What a score screen may show. Only a scored row with both a score and a band
 * shows figures; the other states show words, never a 0.
 */
function viewOf(s: ScoreFields, insufficientMessage: string): ScoreView {
  if (s.status === "scored" && s.score !== null && s.risk_level !== null) {
    return { kind: "scored", score: s.score, riskLevel: s.risk_level };
  }
  if (s.status === "insufficient_data") {
    return { kind: "insufficient_data", message: insufficientMessage };
  }
  return { kind: "not_scored", message: NOT_SCORED_MESSAGE };
}

export function scoreView(s: ScoreFields): ScoreView {
  return viewOf(s, INSUFFICIENT_DATA_MESSAGE);
}

/** A list row: the short "Insufficient data" where the score and band go. */
export function rowScoreView(s: ScoreFields): ScoreView {
  return viewOf(s, INSUFFICIENT_DATA_SHORT);
}

/** The line every score carries; null before the first score. */
export function advisoryLine(s: Pick<CreditScore, "model_version" | "validated">): string | null {
  if (!s.model_version) return null;
  const unvalidated = s.validated === false ? ", not yet validated" : "";
  return `Advisory only, never changes a loan. Scorecard v${s.model_version}${unvalidated}.`;
}

export function showsLimitedHistory(s: Pick<CreditScore, "status" | "limited_history">): boolean {
  return s.status === "scored" && s.limited_history;
}

export function categoryDataNote(c: Pick<ScoreCategoryBreakdown, "has_data">): string | null {
  return c.has_data ? null : "No data";
}

/**
 * The server's count of the loans it left out for this caller. The screen
 * says so and never fills in what's hidden.
 */
export function otherBranchLoansNote(dataUsed: CreditDataUsed | null | undefined): string | null {
  const n = dataUsed?.other_branch_loans ?? 0;
  if (n <= 0) return null;
  return n === 1
    ? "1 loan at a branch you can't see is left out."
    : `${n} loans at branches you can't see are left out.`;
}

/** The server's average (already one decimal), or a dash when no one is scored. */
export function averageScoreText(average: number | null): string {
  return average === null ? "—" : String(average);
}

/** A server count, or a dash when it's null or missing. */
export function countOrDash(count: number | null | undefined): string {
  return count === null || count === undefined ? "—" : String(count);
}

export const DETAILS_HIDDEN_NOTE = "Details need access to this member's details";

/**
 * Whether any of these answers is the summary-only view (`details_hidden`:
 * the caller can't read the member's details). An answer without the key
 * isn't.
 */
export function isDetailsHidden(...answers: ({ details_hidden?: boolean } | null | undefined)[]): boolean {
  return answers.some((a) => a?.details_hidden === true);
}

export type ScoreSections =
  | { kind: "hidden"; note: string }
  | { kind: "none" }
  | {
      kind: "shown";
      breakdown: ScoreCategoryBreakdown[];
      withoutData: FactorWithoutData[];
      factors: ScoreFactor[];
    };

/**
 * What goes under a score's summary and recommendation. A summary-only answer
 * gets one notice instead of empty sections, so nothing reads as "no data".
 */
export function scoreSections(
  score: Pick<CreditScore, "status" | "details_hidden" | "category_breakdown" | "factors_without_data" | "factors">,
  hidden: boolean = isDetailsHidden(score),
): ScoreSections {
  if (hidden) return { kind: "hidden", note: DETAILS_HIDDEN_NOTE };
  if (score.status === "not_scored") return { kind: "none" };
  return {
    kind: "shown",
    breakdown: score.category_breakdown ?? [],
    withoutData: score.factors_without_data ?? [],
    factors: score.factors ?? [],
  };
}
