import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { httpStatusOf } from "@/lib/api-error";
import { accountingService } from "@/services/accounting.service";
import type {
  ReconcileLineAsExpenseBody,
  ReconcileLineAsTransferBody,
  ReconcileLineToSuspenseBody,
} from "@/types";
import type { StartAccountsAnswer } from "./start-accounts";
import type {
  CreateReconciliationBody,
  LineActionKind,
  MatchReconciliationBody,
  ReconciliationActionAnswer,
  ReconciliationDetail,
  RecordAnyway,
} from "./types";

/**
 * The reconciliation screens' calls. Show, create and match have endpoints in
 * `API_ENDPOINTS` but no service call yet, so they are made here; the three
 * line actions go through the accounting service, read whole so `created`
 * survives beside `data`. Every answer is the worksheet as `present()` sends it.
 */

/**
 * `GET /accounting/reconciliations/accounts` (`accounting:reconcile`): the
 * cash and bank accounts a reconciliation can be started on, so a role with
 * reconcile but no `chart_of_accounts:view` can start one. Not yet in
 * `API_ENDPOINTS`. An older backend answers 404, and the form then falls back
 * to the chart's money accounts.
 */
export const RECONCILABLE_ACCOUNTS_PATH = "/accounting/reconciliations/accounts";

export function reconciliationAccounts(): Promise<StartAccountsAnswer> {
  return api.get<unknown>(RECONCILABLE_ACCOUNTS_PATH).then(
    (rows): StartAccountsAnswer => (Array.isArray(rows) ? { state: "list", accounts: rows } : { state: "failed" }),
    (err: unknown): StartAccountsAnswer => (httpStatusOf(err) === 404 ? { state: "missing" } : { state: "failed" }),
  );
}

export function reconciliationShow(id: number): Promise<ReconciliationDetail> {
  return api.get<ReconciliationDetail>(API_ENDPOINTS.ACCOUNTING.RECONCILIATIONS_SHOW(id));
}

export function reconciliationCreate(body: CreateReconciliationBody): Promise<ReconciliationDetail> {
  return api.post<ReconciliationDetail>(API_ENDPOINTS.ACCOUNTING.RECONCILIATIONS_CREATE, body);
}

export function reconciliationMatch(
  id: number,
  body: MatchReconciliationBody,
): Promise<ReconciliationDetail> {
  return api.post<ReconciliationDetail>(API_ENDPOINTS.ACCOUNTING.RECONCILIATIONS_MATCH(id), body);
}

export interface LineActionBodies {
  expense: ReconcileLineAsExpenseBody & RecordAnyway;
  transfer: ReconcileLineAsTransferBody & RecordAnyway;
  suspense: ReconcileLineToSuspenseBody & RecordAnyway;
}

/** One line action and its body, as the resolve dialog hands it to the page. */
export type LineRecordRequest = {
  [K in LineActionKind]: { kind: K; body: LineActionBodies[K] };
}[LineActionKind];

/** Records an unmatched statement line as an expense, a transfer or a suspense entry. */
export function recordLine<K extends LineActionKind>(
  kind: K,
  reconciliationId: number,
  lineId: number,
  body: LineActionBodies[K],
): Promise<ReconciliationActionAnswer> {
  const calls = {
    expense: () =>
      accountingService.reconcileLineAsExpense(reconciliationId, lineId, body as ReconcileLineAsExpenseBody),
    transfer: () =>
      accountingService.reconcileLineAsTransfer(reconciliationId, lineId, body as ReconcileLineAsTransferBody),
    suspense: () =>
      accountingService.reconcileLineToSuspense(reconciliationId, lineId, body as ReconcileLineToSuspenseBody),
  };
  // The shared result type lacks the worksheet's ids and counts; the server sends them.
  return calls[kind]() as Promise<ReconciliationActionAnswer>;
}
