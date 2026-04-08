export interface FeeConditions {
  term_days_gt?: number;
  term_days_lt?: number;
  term_days_eq?: number;
  loan_amount_gt?: number;
  loan_amount_lt?: number;
  loan_amount_eq?: number;
}

export type FeeType = "fixed" | "percentage";

export interface Fee {
  id: number;
  name: string;
  type: FeeType;
  value: number;
  applicable_product_ids: number[];
  conditions: FeeConditions;
  created_at: string;
  updated_at: string;
}

export interface CreateFeeData {
  name: string;
  type: FeeType;
  value: number;
  applicable_product_ids: number[];
  conditions?: FeeConditions;
}

export type UpdateFeeData = Partial<CreateFeeData>;
