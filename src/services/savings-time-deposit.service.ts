/**
 * Time deposits (savings design §2). The server works out every figure:
 * the placement form shows `POST /savings/time-deposits/quote`, never a
 * browser estimate.
 */

import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { cashReferenceParams } from "@/lib/cash-reference";
import { idempotencyHeaders } from "@/lib/idempotency-key";
import { postMoney } from "./savings.service";
import type {
  CashReferencePreview,
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
  /**
   * The TD-[admin id]-[year]-[0001] number the next cash placement dated
   * `date` (today when left out) would get. A preview only: it reserves
   * nothing, and the server numbers the placement when it saves.
   */
  nextCashReference: (date?: string) =>
    api.get<CashReferencePreview>(E.TIME_DEPOSIT_NEXT_CASH_REFERENCE, { params: cashReferenceParams(date) }),
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
  /** The payout's reference, recorded after the transfer (finish run round 6). Once only; moves no money. */
  recordPayoutReference: (id: number, reference: string) =>
    api.post<TimeDeposit>(E.TIME_DEPOSIT_PAYOUT_REFERENCE(id), { reference }),
};
