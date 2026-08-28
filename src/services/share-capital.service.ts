import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { fetchAllPages, type DrainResult } from "@/lib/paginate";
import type {
  ShareCapitalLedgerEntry,
  Pledge,
  AutoCreditStatus,
  AutoCreditProcessResult,
  CreateLedgerEntryData,
  UpdatePledgeData,
  CreatePledgeEntryData,
  BulkPledgeEntryData,
  PaginatedResponse,
} from "@/types";

export const shareCapitalService = {
  // ── Ledger ──

  /**
   * `/share-capital/ledger` answers with a raw Laravel paginator
   * (`{ data, links, meta }`) — `ShareCapitalLedgerController::index()` returns
   * an `AnonymousResourceCollection` and no middleware wraps it — so it has to
   * use `getRaw`. `api.get` unwraps one level and hands back the rows alone,
   * discarding `meta.total`, `meta.last_page` and `meta.per_page`.
   *
   * That discarded `meta` is why this could not be drained and why nothing here
   * could tell a complete ledger from a clamped first page. The same migration
   * `loanService.list` and `borrowerService.list` already made, for the same
   * reason.
   *
   * The static type does not change — `api.get` and `api.getRaw` share a
   * signature, and this was already declared `PaginatedResponse<T>` while
   * returning a bare array at runtime, so TypeScript flagged nothing either
   * way. Every call site was checked by hand instead: all of them already
   * normalised both shapes (`Array.isArray(res) ? res : res.data`), so they
   * took the array branch before and take the `.data` branch now. Two live
   * outside this module — `dashboard/page.tsx`, which drains through
   * `fetchAllPages` (tolerates both, and now gets a real `last_page` to
   * follow), and `printables/catalog.ts`, whose `toShareCapitalLedgerFallback`
   * reads `meta.total` to decide whether it is printing a certificate or an
   * extract. That check was dead against a bare array and is live now, which is
   * what its own test fixture has always assumed.
   *
   * Accepted params (`ShareCapitalLedgerController::index()`): `page`,
   * `per_page` (silently clamped to 100 — asking for more does not fail, it
   * just returns less), `borrower_id`, `date_from`, `date_to`, `search`.
   */
  ledgerList: (params?: Record<string, unknown>) =>
    api.getRaw<PaginatedResponse<ShareCapitalLedgerEntry>>(
      API_ENDPOINTS.SHARE_CAPITAL.LEDGER_LIST,
      { params }
    ),

  /**
   * Every ledger entry matching `params`, across as many pages as it takes.
   *
   * For the screens that need a WHOLE ledger rather than a page of it, which
   * here is most of them: every share-capital figure in this app is an
   * aggregate — a balance, a running balance, a member summary, a grand total —
   * and an aggregate over a page is not a smaller version of the right answer,
   * it is a different number.
   *
   * They asked for `per_page: 9999`, which the controller clamps to
   * `min(per_page, 100)` without complaining. Reproduced against a stub with a
   * 240-entry ledger: the balance came back ₱40,000 against a true ₱180,000.
   * A second member with the same 100-row cap read ₱100,000 against a true
   * ₱25,000 — TOO HIGH, because a clamped ledger drops debits as readily as
   * credits. That is what makes this worse than the usual truncated list: the
   * error has no direction, so "it will be low, so it will fail safe" is not
   * available as a consolation.
   *
   * Returns a `DrainResult`, NOT a row array, on purpose — the same call
   * `borrowerService.listAll` makes and for the same reason. `truncated` is
   * part of the answer and the caller has to decide what to show for it;
   * handing back a bare array would let a screen go back to summing an
   * incomplete ledger as if it were the whole thing, which is the bug itself.
   *
   * `page` and `per_page` are set by the drain — passing them in `params` has
   * no effect.
   */
  ledgerListAll: (
    params?: Record<string, unknown>
  ): Promise<DrainResult<ShareCapitalLedgerEntry>> =>
    fetchAllPages<ShareCapitalLedgerEntry>(({ page, per_page }) =>
      shareCapitalService.ledgerList({ ...params, page, per_page })
    ),

  ledgerCreate: (data: CreateLedgerEntryData) =>
    api.post<ShareCapitalLedgerEntry>(
      API_ENDPOINTS.SHARE_CAPITAL.LEDGER_CREATE,
      data
    ),

  // ── Pledges ──

  /**
   * `/pledges` is the same shape as the ledger above — an
   * `AnonymousResourceCollection` over a paginator — so it reads through
   * `getRaw` for the same reason: `meta` is what the drain follows.
   *
   * Note `ShareCapitalPledgeController::index()` is member-scoped server-side:
   * a pledge row exists for every borrower, including `pending` and `rejected`
   * applicants, and those are filtered out here. `ShareCapitalPledgeResource`
   * exposes no borrower status, so a client cannot reproduce that filter and
   * must not try.
   */
  pledgeList: (params?: Record<string, unknown>) =>
    api.getRaw<PaginatedResponse<Pledge>>(API_ENDPOINTS.PLEDGES.LIST, {
      params,
    }),

  /**
   * Every pledge, across as many pages as it takes.
   *
   * The pledge screen is a worksheet, not a report: an operator filters it,
   * ticks rows and posts a bulk entry against the selection. A row that is not
   * on the list cannot be ticked, so a clamped page does not under-report a
   * total — it silently excludes members from a posting run, and the run looks
   * like it completed.
   *
   * `DrainResult` rather than a row array, for the reason spelled out on
   * `ledgerListAll` above.
   */
  pledgeListAll: (
    params?: Record<string, unknown>
  ): Promise<DrainResult<Pledge>> =>
    fetchAllPages<Pledge>(({ page, per_page }) =>
      shareCapitalService.pledgeList({ ...params, page, per_page })
    ),

  pledgeUpdate: (id: number, data: UpdatePledgeData) =>
    api.put<Pledge>(API_ENDPOINTS.PLEDGES.UPDATE(id), data),

  pledgeToggleAutoCredit: (id: number) =>
    api.patch<Pledge>(API_ENDPOINTS.PLEDGES.TOGGLE_AUTO_CREDIT(id)),

  pledgeCreateEntry: (id: number, data: CreatePledgeEntryData) =>
    api.post<ShareCapitalLedgerEntry>(
      API_ENDPOINTS.PLEDGES.CREATE_ENTRY(id),
      data
    ),

  pledgeBulkEntries: (data: BulkPledgeEntryData) =>
    api.post<{ processed_count: number }>(
      API_ENDPOINTS.PLEDGES.BULK_ENTRIES,
      data
    ),

  // ── Auto-Credit ──

  autoCreditStatus: () =>
    api.get<AutoCreditStatus>(API_ENDPOINTS.AUTO_CREDIT.STATUS),

  autoCreditProcess: () =>
    api.post<AutoCreditProcessResult>(API_ENDPOINTS.AUTO_CREDIT.PROCESS),
};
