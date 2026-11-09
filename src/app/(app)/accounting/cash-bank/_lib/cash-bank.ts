/**
 * Cash & Bank: the server's totals and the link to each account's history.
 * The headline and the line per kind are `meta.totals`, over every money
 * account in the caller's scope, never a sum of the cards on screen.
 */
import type { CashAccountKind } from "@/types";
import { cashKindLabel } from "../../_lib/display-labels";

/** The server's largest page. A chart with more money accounts shows a notice. */
export const CASH_ACCOUNTS_PER_PAGE = 100;

const CASH_KINDS: readonly CashAccountKind[] = ["cash", "bank", "gcash", "maya", "wallet"];

/** The general ledger, opened on one account. */
export function accountHistoryHref(accountId: number): string {
  return `/accounting/general-ledger?account_id=${accountId}`;
}

export interface CashKindTotal {
  kind: CashAccountKind;
  label: string;
  /** Centavos, or null when the server didn't send this kind. */
  amount: number | null;
}

/** One line per kind from `meta.totals.by_kind`, in a fixed order. */
export function cashKindTotals(
  byKind: Partial<Record<CashAccountKind, number>> | undefined,
): CashKindTotal[] {
  if (!byKind) return [];
  return CASH_KINDS.map((kind) => ({
    kind,
    label: cashKindLabel(kind),
    amount: typeof byKind[kind] === "number" ? (byKind[kind] as number) : null,
  }));
}

/** True when the server holds more money accounts than the page it sent. */
export function cashListIsIncomplete(
  meta: { total?: number } | undefined,
  shown: number,
): boolean {
  return typeof meta?.total === "number" && meta.total > shown;
}
