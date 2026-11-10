/**
 * Time deposits (savings design §2). The server works out every figure:
 * the placement form shows `POST /savings/time-deposits/quote`, never a
 * browser estimate.
 */

import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { idempotencyHeaders } from "@/lib/idempotency-key";
import { postMoney } from "./savings.service";
import type {
  PlaceTimeDepositInput,
  PreterminateTimeDepositInput,
  PreterminationQuote,
  SettleTimeDepositInput,
  TimeDeposit,
  TimeDepositQuote,
  TimeDepositQuoteInput,
  TimeDepositsResponse,
} from "@/types";

const E = API_ENDPOINTS.SAVINGS;

export const timeDepositService = {
  /**
   * One page of placements, `getRaw` so `meta` survives. Params: `page`,
   * `per_page` (≤ 100), `search`, `status`, `product_id`, `branch_id`, `borrower_id`.
   */
  list: (params?: Record<string, unknown>) => api.getRaw<TimeDepositsResponse>(E.TIME_DEPOSITS, { params }),
  get: (id: number) => api.get<TimeDeposit>(E.TIME_DEPOSIT(id)),
  /** The server's figures for a placement. Writes nothing. */
  quote: (data: TimeDepositQuoteInput) => api.post<TimeDepositQuote>(E.TIME_DEPOSIT_QUOTE, data),
  place: (data: PlaceTimeDepositInput, key: string | null) =>
    api.post<TimeDeposit>(E.TIME_DEPOSITS, data, idempotencyHeaders(key)),
  /** 201 (a rollover returns the new placement), or 202 with `{approval}` above the first tier. */
  settle: (id: number, data: SettleTimeDepositInput, key: string | null) =>
    postMoney<TimeDeposit>(E.TIME_DEPOSIT_SETTLE(id), data, key),
  preterminationQuote: (id: number, date: string) =>
    api.get<PreterminationQuote>(E.TIME_DEPOSIT_PRETERMINATION_QUOTE(id), { params: { date } }),
  /** 201, or 202 with `{approval}` above the first tier. */
  preterminate: (id: number, data: PreterminateTimeDepositInput, key: string | null) =>
    postMoney<TimeDeposit>(E.TIME_DEPOSIT_PRETERMINATE(id), data, key),
};
