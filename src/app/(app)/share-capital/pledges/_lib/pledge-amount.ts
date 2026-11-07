/**
 * Amounts typed on the Share Capital Pledges page (pledge amount, manual
 * entry, bulk entries), read exactly as typed.
 *
 * They used to go through `Math.round`, so the page saved whole pesos only.
 * Now the figure typed is the figure sent, to the centavo, and anything finer
 * than a centavo is refused here with a message rather than rounded — the API
 * refuses it too (422 on `amount`).
 */

import {
  isTooPrecise,
  parseMoneyInput,
  tooPreciseMessage,
  type ParsedAmount,
} from "@/lib/money-input";

export type { ParsedAmount };

/**
 * The typed amount, exactly, or why it can't be saved. Blank, zero,
 * negative and anything that isn't plain pesos are refused as "must be
 * greater than 0". The shared rule lives in `@/lib/money-input`.
 */
export function parsePledgeAmount(raw: string, label = "Amount"): ParsedAmount {
  return parseMoneyInput(raw, { label });
}

export interface BulkAmountInput {
  /** The member's name, to say which row is wrong. */
  name: string;
  amount: string;
}

export type BulkAmounts =
  | { ok: true; amounts: Map<number, number> }
  | { ok: false; message: string };

/**
 * The bulk dialog's amounts by pledge id. A row left blank or at zero is
 * skipped, as before; a row with more than two decimals stops the batch and
 * names the member, so no one is posted a rounded figure or silently left out.
 */
export function bulkEntryAmounts(entries: [number, BulkAmountInput][]): BulkAmounts {
  const amounts = new Map<number, number>();
  for (const [id, entry] of entries) {
    if (isTooPrecise(entry.amount)) {
      return { ok: false, message: `${entry.name}: ${tooPreciseMessage("Amount")}` };
    }
    const parsed = parsePledgeAmount(entry.amount);
    if (parsed.ok) amounts.set(id, parsed.amount);
  }
  if (amounts.size === 0) return { ok: false, message: "Enter an amount for at least one member" };
  return { ok: true, amounts };
}
