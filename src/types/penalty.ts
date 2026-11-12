import type { PenaltyBracket } from "./loan";

/**
 * Settings → Penalties: a named set of brackets by days late, covering one or
 * more loan products. A new loan on a covered product copies the brackets when
 * it's created; the server decides which bracket each charge falls in.
 *
 * Contract: notes/phase4-run/contracts.md, B2.
 */
export type PenaltyCondition = PenaltyBracket;

export type PenaltyConfigStatus = "active" | "inactive";

export interface PenaltyConfig {
  id: number;
  name: string;
  status: PenaltyConfigStatus;
  applicable_product_ids: number[];
  /** The covered products by name, from the server. */
  products?: { id: number; name: string }[];
  /** Ordered by `days_from`. */
  conditions: PenaltyCondition[];
  /** True once a loan carries this configuration; the server then refuses a delete (409). */
  in_use?: boolean;
  loans_count?: number;
  created_at: string;
  updated_at: string;
}

export interface SavePenaltyConfigData {
  name: string;
  applicable_product_ids: number[];
  conditions: PenaltyCondition[];
  /** A new configuration defaults to active. */
  status?: PenaltyConfigStatus;
}
