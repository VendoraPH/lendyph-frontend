/**
 * Settings → Penalties: a named set of overdue-day brackets, assigned to one
 * or more loan products. The backend picks the ONE bracket the installment's
 * days overdue fall in (brackets are not added together) and applies its rate
 * to the same base the product's old flat `penalty_rate` used.
 *
 * Contract: ClickUp 14zfbg0d0dh (backend handoff comment). Not built yet.
 */
export interface PenaltyCondition {
  /** First overdue day of the bracket, 1 or more. */
  days_from: number;
  /** Last overdue day, inclusive; null means "and above" (last bracket only). */
  days_to: number | null;
  /** Percent, e.g. 20 for 20%. */
  rate: number;
}

export type PenaltyConfigStatus = "active" | "inactive";

export interface PenaltyConfig {
  id: number;
  name: string;
  status: PenaltyConfigStatus;
  applicable_product_ids: number[];
  /** Ordered by `days_from`. */
  conditions: PenaltyCondition[];
  /**
   * True once any loan has been charged under this configuration. The server
   * refuses a delete then (deactivate instead); the screen hides the button.
   */
  in_use?: boolean;
  created_at: string;
  updated_at: string;
}

export interface SavePenaltyConfigData {
  name: string;
  applicable_product_ids: number[];
  conditions: PenaltyCondition[];
}
