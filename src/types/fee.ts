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
  applicable_product_ids: number[];
  conditions?: FeeConditions | null;
}

export type UpdateFeeData = Partial<CreateFeeData>;
