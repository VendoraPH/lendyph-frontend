import type { RateFrequency } from "@/lib/loan-terms";
import type { FeeFormulaInputs } from "./loan";

export interface FeeConditions {
  term_days_gt?: number;
  term_days_lt?: number;
  term_days_eq?: number;
  loan_amount_gt?: number;
  loan_amount_lt?: number;
  loan_amount_eq?: number;
}

/**
 * `formula`: `value` is a percentage of the principal, multiplied by the term
 * in months when `per_month` is set, and kept between `min_amount` and
 * `max_amount` (each optional, in pesos). The server works out every amount.
 *
 * A formula fee with a `formula_expression` (e.g. "(Principal Amount * 2.5%) /
 * 365") is worked out by the server from that expression instead, rounded to
 * the centavo and kept between the bounds; its `value` and `per_month` are
 * unused. The browser never evaluates it (`POST /fees/formula-check` previews).
 */
export type FeeType = "fixed" | "percentage" | "formula";

export interface Fee {
  id: number;
  name: string;
  type: FeeType;
  value: number;
  per_month: boolean;
  min_amount: number | null;
  max_amount: number | null;
  /** Set only on a formula fee written as an expression. */
  formula_expression?: string | null;
  applicable_product_ids: number[];
  conditions: FeeConditions | null;
  created_at: string;
  updated_at: string;
}

export interface CreateFeeData {
  name: string;
  type: FeeType;
  value: number;
  per_month?: boolean;
  min_amount?: number | null;
  max_amount?: number | null;
  formula_expression?: string | null;
  applicable_product_ids: number[];
  conditions?: FeeConditions | null;
}

export type UpdateFeeData = Partial<CreateFeeData>;

/**
 * The body of `POST /fees/formula-check`: the formula and a sample loan, its
 * figures as typed (strings; the term is a whole number). The rate is per
 * `interest_rate_frequency`, as on a loan.
 */
export interface FeeFormulaCheckRequest {
  formula_expression: string;
  principal_amount: string;
  interest_rate: string;
  interest_rate_frequency: RateFrequency;
  term: number;
  term_unit: "months" | "days";
  min_amount: string | null;
  max_amount: string | null;
}

/**
 * The server's answer to `POST /fees/formula-check`: the formula as it reads
 * it, and the fee it gives on the sample loan. Money is 2-decimal strings;
 * `raw_amount` is the exact result cut to 6 decimals, before rounding.
 * `clamped` says when the minimum or maximum changed the rounded amount.
 */
export interface FeeFormulaCheck {
  valid: boolean;
  expression: string;
  variables: string[];
  inputs: FeeFormulaInputs;
  raw_amount: string;
  rounded_amount: string;
  amount: string;
  clamped: "min" | "max" | null;
}
