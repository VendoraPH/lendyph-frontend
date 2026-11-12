import type { CreateFeeData, FeeConditions, FeeFormulaCheckRequest, FeeType } from "@/types/fee";
import type { FeeFormulaInputs } from "@/types/loan";
import { formatCurrency, formatRate } from "@/lib/format";
import { PERIOD_DAYS, ratePeriodWord, type RateFrequency } from "@/lib/loan-terms";

/** The help line shown under a formula fee's fields on Fees. */
export const FORMULA_FEE_HELP =
  "Percentage of principal, optionally per month of the term, kept between the minimum and maximum.";

/** The help line shown above a formula fee's expression field. */
export const FORMULA_EXPRESSION_HELP =
  "Write the fee as arithmetic on the loan's figures. The server works it out from each loan's own values at release, rounds it to the centavo, then keeps it between the minimum and maximum.";

/** The grammar in one line, under the variable buttons. */
export const FORMULA_GRAMMAR_HELP =
  "Use numbers, the variables, + − × ÷ (or * and /) and brackets. A % after a number divides it by 100: 2.5% means 0.025.";

/** The longest formula the server stores. */
export const FEE_FORMULA_MAX_LENGTH = 255;

/**
 * The variables a written formula may use, with what each one means. The
 * button inserts `label`; the server matches it case-insensitively.
 */
export const FEE_FORMULA_VARIABLES: readonly { label: string; hint: string }[] = [
  { label: "Principal Amount", hint: "The loan's principal, in pesos." },
  { label: "Loan Amount", hint: "The same figure as Principal Amount, in pesos." },
  {
    label: "Interest Rate",
    hint: "The loan's interest rate as a number (3 means 3%), per the loan's own rate period: a rate per month stays per month. Write Interest Rate% to use it as a fraction.",
  },
  { label: "Loan Term", hint: "The loan's term in months. A term in days counts as the days ÷ 30." },
  { label: "Term in Days", hint: "Calendar days from the loan's start date to its maturity date." },
];

/**
 * A formula fee is either the rate recipe (a percentage of the principal) or,
 * where the deployment allows it, a written expression.
 */
export type FormulaMode = "rate" | "expression";

/** A formula fee's own fields as the form holds them: a flag and two peso inputs. */
export interface FormulaFieldsInput {
  perMonth: boolean;
  minAmount: string;
  maxAmount: string;
  mode?: FormulaMode;
  expression?: string;
}

export const EMPTY_FORMULA_FIELDS: FormulaFieldsInput = { perMonth: false, minAmount: "", maxAmount: "" };

export interface FormulaFieldsPayload {
  per_month: boolean;
  min_amount: number | null;
  max_amount: number | null;
  formula_expression?: string | null;
}

interface FeeFormInput {
  name: string;
  type: FeeType;
  value: string;
  productIds: number[];
  conditions: FeeConditions;
  /** Read only when `type` is "formula". */
  formula?: FormulaFieldsInput;
}

const PESO_PLACES = /^\d+(\.\d{1,2})?$/;

function boundValue(raw: string, label: string): { value: number | null } | { error: string } {
  const text = raw.trim();
  if (text === "") return { value: null };
  if (!PESO_PLACES.test(text)) {
    return { error: `${label} must be a peso amount of zero or more, with at most two decimals.` };
  }
  return { value: Number(text) };
}

/**
 * A formula fee's per-month flag and peso bounds, as the API takes them. A
 * blank bound is none (null); a bound is zero or more with at most two
 * decimals, as `fees.min_amount` / `max_amount` store it, and the minimum may
 * not exceed the maximum (the API's own 422).
 */
export function buildFormulaFields(input: FormulaFieldsInput): { fields: FormulaFieldsPayload } | { error: string } {
  const min = boundValue(input.minAmount, "Minimum");
  if ("error" in min) return min;
  const max = boundValue(input.maxAmount, "Maximum");
  if ("error" in max) return max;
  if (min.value !== null && max.value !== null && min.value > max.value) {
    return { error: `The minimum (${formatCurrency(min.value)}) cannot be more than the maximum (${formatCurrency(max.value)}).` };
  }
  return { fields: { per_month: input.perMonth, min_amount: min.value, max_amount: max.value } };
}

/**
 * How a formula fee reads in a list: "1.5% per month · min ₱150.00 · max
 * ₱1,500.00". The rule only; the amount it comes to is the server's.
 */
export function describeFormulaFee(fee: { value: number | string; per_month?: boolean | null; min_amount?: number | string | null; max_amount?: number | string | null; formula_expression?: string | null }): string {
  const parts = [fee.formula_expression || `${formatRate(fee.value)}%${fee.per_month ? " per month" : ""}`];
  if (fee.min_amount != null) parts.push(`min ${formatCurrency(fee.min_amount)}`);
  if (fee.max_amount != null) parts.push(`max ${formatCurrency(fee.max_amount)}`);
  return parts.join(" · ");
}

/** Human labels for the two condition families, so errors can name the field. */
const CONDITION_LABELS = {
  term_days: "Term days",
  loan_amount: "Loan amount",
} as const;

/**
 * Validate the fee dialog's fields and shape them into an API payload.
 *
 * Two of the rules below are deliberately stricter than the API, which
 * validates the six condition keys independently and caps nothing:
 *
 * - **Percentage ceiling.** `value` is `numeric|min:0` server-side, so a
 *   percentage fee of `500` is accepted and then charged as 500% of the
 *   principal at release. Nothing downstream catches it.
 * - **Contradictory conditions.** The backend evaluates every populated key as
 *   a conjunction, so `term_days_gt: 30` with `term_days_eq: 30` is storable
 *   and can never match — the fee is silently dormant. `LoanReleaseFeeService`
 *   documents this as intentional at release time (a release is the wrong
 *   moment to discover a settings mistake) and names this screen as where it
 *   should surface instead.
 *
 * The second rule therefore stays, but reports the offending pair by name and
 * value: the old message said only "the conditions conflict", which left an
 * already-saved contradictory fee looking un-editable because no unrelated
 * edit could get past it without knowing which two numbers to fix.
 */
export function buildFeePayload(
  form: FeeFormInput,
  options: { expressions?: boolean } = {},
): { payload: CreateFeeData } | { error: string } {
  if (!form.name.trim()) return { error: "Enter a fee name." };
  const fields = form.formula ?? EMPTY_FORMULA_FIELDS;
  // A written expression replaces the rate: `value` is stored as 0 and unused.
  const writtenFormula = form.type === "formula" && options.expressions === true && fields.mode === "expression";
  const value = writtenFormula ? 0 : Number(form.value);
  if (!writtenFormula) {
    if (!form.value.trim() || !Number.isFinite(value) || value < 0) {
      return { error: "Enter a fee amount or rate of zero or more." };
    }
    if (form.type !== "fixed" && value > 100) {
      return { error: "A percentage fee cannot exceed 100% of the loan amount." };
    }
  }
  let formula: Partial<FormulaFieldsPayload> | null = null;
  if (form.type === "formula") {
    const result = buildFormulaFields(fields);
    if ("error" in result) return result;
    formula = result.fields;
    if (writtenFormula) {
      // Sent as written: the server checks it and answers any mistake in words.
      const expression = (fields.expression ?? "").trim();
      if (!expression) return { error: "Write the fee formula." };
      if (expression.length > FEE_FORMULA_MAX_LENGTH) {
        return { error: `The formula is too long (at most ${FEE_FORMULA_MAX_LENGTH} characters).` };
      }
      formula = { ...formula, per_month: false, formula_expression: expression };
    } else if (options.expressions) {
      // Switching a written formula back to the rate recipe clears it.
      formula = { ...formula, formula_expression: null };
    }
  } else if (options.expressions) {
    // Any other type carries no formula; the server clears it too.
    formula = { formula_expression: null };
  }
  for (const [key, limit] of Object.entries(form.conditions)) {
    if (limit == null) continue;
    if (!Number.isFinite(limit) || limit < 0 || (key.startsWith("term_days") && !Number.isInteger(limit))) {
      return { error: "Conditions must be zero or more; term days must be whole numbers." };
    }
  }
  for (const prefix of ["term_days", "loan_amount"] as const) {
    const label = CONDITION_LABELS[prefix];
    const gt = form.conditions[`${prefix}_gt`];
    const lt = form.conditions[`${prefix}_lt`];
    const eq = form.conditions[`${prefix}_eq`];
    if (gt != null && lt != null && gt >= lt) {
      return { error: `${label}: "greater than" (${gt}) must be below "less than" (${lt}). No loan can satisfy both, so the fee would never apply.` };
    }
    if (eq != null && gt != null && eq <= gt) {
      return { error: `${label}: "equal to" (${eq}) must be above "greater than" (${gt}). No loan can satisfy both, so the fee would never apply.` };
    }
    if (eq != null && lt != null && eq >= lt) {
      return { error: `${label}: "equal to" (${eq}) must be below "less than" (${lt}). No loan can satisfy both, so the fee would never apply.` };
    }
  }
  const conditions = Object.fromEntries(Object.entries(form.conditions).filter(([, limit]) => limit != null));
  return { payload: {
    name: form.name.trim(), type: form.type, value,
    // Only a formula fee sends these; the API clears them on any other type.
    ...formula,
    applicable_product_ids: form.productIds,
    // Omitting this field on PUT preserves the old rules on the API.
    conditions: Object.keys(conditions).length ? conditions : null,
  } };
}

// ---------------------------------------------------------------------------
// Written formulas: the server's check and the snapshot on a charged fee. The
// browser never evaluates a formula; it sends the text and shows the answer.
// ---------------------------------------------------------------------------

/** The sample loan the formula check works on, as the form holds it. */
export interface FormulaSampleInput {
  principalAmount: string;
  interestRate: string;
  rateFrequency: RateFrequency;
  term: string;
  termUnit: "months" | "days";
}

/** ₱100,000.00 at 3% a month for 12 months, the server's own default. */
export const DEFAULT_FORMULA_SAMPLE: FormulaSampleInput = {
  principalAmount: "100000.00",
  interestRate: "3",
  rateFrequency: "monthly",
  term: "12",
  termUnit: "months",
};

const RATE_TEXT = /^\d+(\.\d+)?$/;
const WHOLE_NUMBER = /^\d+$/;

/**
 * The formula check's request, or the reason the sample loan can't be sent
 * yet. Only the shape is checked here: every figure goes to the server as
 * typed, and the server works the fee out. A bound that isn't a peso amount
 * is left out of the check; saving reports it.
 */
export function buildFeeFormulaCheckRequest(
  expression: string,
  sample: FormulaSampleInput,
  bounds: { minAmount: string; maxAmount: string },
): { body: FeeFormulaCheckRequest } | { error: string } | null {
  const formula = expression.trim();
  if (!formula) return null;
  const principal = sample.principalAmount.trim();
  const rate = sample.interestRate.trim();
  const term = sample.term.trim();
  if (!PESO_PLACES.test(principal)) {
    return { error: "Enter the sample loan's amount in pesos, with at most two decimals." };
  }
  if (!RATE_TEXT.test(rate)) return { error: "Enter the sample loan's interest rate as a number, such as 3." };
  if (!WHOLE_NUMBER.test(term) || /^0+$/.test(term)) {
    return { error: "Enter the sample loan's term as a whole number above zero." };
  }
  const bound = (raw: string) => (PESO_PLACES.test(raw.trim()) ? raw.trim() : null);
  return {
    body: {
      formula_expression: formula,
      principal_amount: principal,
      interest_rate: rate,
      interest_rate_frequency: sample.rateFrequency,
      term: Number.parseInt(term, 10),
      term_unit: sample.termUnit,
      min_amount: bound(bounds.minAmount),
      max_amount: bound(bounds.maxAmount),
    },
  };
}

/**
 * The server's 422 message on the formula itself (`formula_expression`), as
 * sent, or null when the refusal is about something else.
 */
export function formulaExpressionError(err: unknown): string | null {
  if (!err || typeof err !== "object" || !("response" in err)) return null;
  const response = (err as { response?: { status?: number; data?: { errors?: Record<string, unknown> } } }).response;
  if (response?.status !== 422) return null;
  const messages = response.data?.errors?.formula_expression;
  if (!Array.isArray(messages)) return null;
  const first = messages.find((m): m is string => typeof m === "string" && m.trim() !== "");
  return first ?? null;
}

/** "monthly" → "month"; null for a period the screen doesn't know. */
function periodWord(frequency: string | null | undefined): string | null {
  const key = String(frequency ?? "").trim().toLowerCase();
  return key in PERIOD_DAYS ? ratePeriodWord(key as RateFrequency) : null;
}

/** "12 months", "1 month", "1.5 months": the server's figure, unchanged. */
function countWithUnit(figure: string, singular: string, plural: string): string {
  return `${figure} ${figure === "1" ? singular : plural}`;
}

/**
 * The loan figures a formula used, in words, as the server recorded them:
 * "Principal Amount ₱100,000.00", "Interest Rate 3% per month", "Loan Term 12
 * months", "Term in Days 365 days". Never a raw key; a figure the server
 * didn't send is left out.
 */
export function describeFormulaInputs(inputs: Partial<FeeFormulaInputs> | null | undefined): string[] {
  if (!inputs) return [];
  const parts: string[] = [];
  const principal = inputs.principal_amount;
  const loanAmount = inputs.loan_amount;
  if (principal != null && loanAmount != null && principal === loanAmount) {
    parts.push(`Principal Amount and Loan Amount ${formatCurrency(principal)}`);
  } else {
    if (principal != null) parts.push(`Principal Amount ${formatCurrency(principal)}`);
    if (loanAmount != null) parts.push(`Loan Amount ${formatCurrency(loanAmount)}`);
  }
  if (inputs.interest_rate != null) {
    const period = periodWord(inputs.interest_rate_frequency);
    parts.push(`Interest Rate ${formatRate(inputs.interest_rate)}%${period ? ` per ${period}` : ""}`);
  }
  if (inputs.loan_term != null) parts.push(`Loan Term ${countWithUnit(inputs.loan_term, "month", "months")}`);
  if (inputs.term_in_days != null) parts.push(`Term in Days ${countWithUnit(inputs.term_in_days, "day", "days")}`);
  return parts;
}

/** A charged fee's formula snapshot, as the loan screens print it. */
export interface FormulaSnapshotView {
  formula: string;
  figures: string[];
  /** The server's figure before rounding to the centavo, as sent. */
  beforeRounding: string | null;
}

/**
 * The snapshot under a fee line charged from a written formula, or null for
 * any other line. Every figure is the server's; nothing is worked out here.
 */
export function describeFormulaSnapshot(item: {
  formula_expression?: string | null;
  formula_inputs?: Partial<FeeFormulaInputs> | null;
  raw_amount?: string | null;
}): FormulaSnapshotView | null {
  const formula = item.formula_expression?.trim();
  if (!formula) return null;
  const raw = item.raw_amount != null && String(item.raw_amount).trim() !== "" ? `₱${String(item.raw_amount).trim()}` : null;
  return { formula, figures: describeFormulaInputs(item.formula_inputs), beforeRounding: raw };
}
