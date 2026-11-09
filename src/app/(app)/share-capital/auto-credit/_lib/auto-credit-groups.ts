// The Auto-Credit page's member groups, exactly as `GET /share-capital/auto-credit`
// sorts the pledges: active (auto-credit on, an amount above 0), disabled
// (auto-credit off) and no pledge amount (an amount of 0). A pledge can be in
// both of the last two, so neither count is built from the other.
// Dependency-free, so it runs under `tsx --test`.

import type { AutoCreditMember } from "@/types";

export interface AutoCreditListMember {
  id: number;
  borrower: string;
  pledgeAmount: number;
  autoCredit: boolean;
}

export interface AutoCreditGroups {
  active: AutoCreditListMember[];
  disabled: AutoCreditListMember[];
  noPledge: AutoCreditListMember[];
  activeCount: number;
  /** "N members will not be credited": pledges whose auto-credit is off, only. */
  disabledCount: number;
  noPledgeCount: number;
}

type Row = Partial<AutoCreditMember> & { id: number; amount?: number };

function member(row: Row, autoCredit: boolean): AutoCreditListMember {
  return {
    id: row.id,
    borrower: row.borrower?.full_name ?? row.borrower?.name ?? row.borrower_name ?? `Member #${row.borrower_id ?? row.id}`,
    pledgeAmount: row.pledge_amount ?? row.amount ?? 0,
    autoCredit,
  };
}

function rows(value: unknown): Row[] {
  return Array.isArray(value) ? (value as Row[]) : [];
}

function count(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function autoCreditGroups(status: Record<string, unknown>): AutoCreditGroups {
  const disabledRows = rows(status.disabled_members);
  const disabledIds = new Set(disabledRows.map((r) => r.id));
  const active = rows(status.active_members).map((r) => member(r, true));
  const disabled = disabledRows.map((r) => member(r, false));
  // The no-pledge list carries no auto-credit flag: it is off exactly when the
  // same pledge is in the disabled list.
  const noPledge = rows(status.no_pledge_members).map((r) => member(r, !disabledIds.has(r.id)));
  return {
    active,
    disabled,
    noPledge,
    activeCount: count(status.active_count, active.length),
    disabledCount: count(status.disabled_count, disabled.length),
    noPledgeCount: count(status.no_pledge_count, noPledge.length),
  };
}

/**
 * The server's `total_to_credit`, as sent: 0 is a real ₱0.00, and a missing or
 * unreadable figure is null (a dash). Never a sum of the pledges on screen.
 */
export function serverTotalToCredit(status: Record<string, unknown>): number | null {
  const raw = status.total_to_credit;
  if (typeof raw !== "number" && typeof raw !== "string") return null;
  if (typeof raw === "string" && raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}
