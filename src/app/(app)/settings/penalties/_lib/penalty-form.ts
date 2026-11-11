import type { PenaltyCondition, PenaltyConfig, SavePenaltyConfigData } from "@/types/penalty";
import { formatRate } from "@/lib/format";
import { RATE_DECIMALS } from "@/lib/percent";

/** One bracket row as the form holds it: text inputs plus the "No maximum" box. */
export interface ConditionRow {
  key: number;
  from: string;
  to: string;
  noMax: boolean;
  rate: string;
}

export interface PenaltyFormInput {
  name: string;
  productIds: number[];
  rows: ConditionRow[];
}

const WHOLE = /^\d+$/;
const RATE = new RegExp(`^\\d+(\\.\\d{1,${RATE_DECIMALS}})?$`);

/** "1–5 days", "11 days and above", "Day 1". */
export function describeRange(c: Pick<PenaltyCondition, "days_from" | "days_to">): string {
  if (c.days_to === null) return `${c.days_from} ${c.days_from === 1 ? "day" : "days"} and above`;
  if (c.days_to === c.days_from) return `Day ${c.days_from}`;
  return `${c.days_from}–${c.days_to} days`;
}

/** A saved bracket as the form's row. */
export function toRow(c: PenaltyCondition, key: number): ConditionRow {
  return {
    key,
    from: String(c.days_from),
    to: c.days_to === null ? "" : String(c.days_to),
    noMax: c.days_to === null,
    rate: formatRate(c.rate),
  };
}

/**
 * The row "Add Condition" appends: it starts the day after the last bracket
 * ends. A last row marked "No maximum" can no longer be last, so the caller
 * clears that box (see `appendRow`).
 */
export function appendRow(rows: ConditionRow[], key: number): ConditionRow[] {
  const last = rows[rows.length - 1];
  const lastTo = last && !last.noMax && WHOLE.test(last.to.trim()) ? Number(last.to) : null;
  const next: ConditionRow = { key, from: lastTo !== null ? String(lastTo + 1) : "", to: "", noMax: false, rate: "" };
  const kept = rows.map((r, i) => (i === rows.length - 1 && r.noMax ? { ...r, noMax: false } : r));
  return [...kept, next];
}

/**
 * The rows as API brackets, or the first problem in words. Rules (ClickUp
 * 14zfbg0d0dh §7): days are whole numbers from 1, "to" is not below "from",
 * the rate is 0–100 with at most four decimals (`decimal(8,4)` like every
 * other rate), only the last row may be open-ended, and ranges may not
 * overlap. Rows are sorted by their first day, so typing order doesn't matter.
 */
export function parseConditions(rows: ConditionRow[]): { conditions: PenaltyCondition[] } | { error: string } {
  if (rows.length === 0) return { error: "Add at least one penalty condition." };

  const parsed: PenaltyCondition[] = [];
  for (const [i, row] of rows.entries()) {
    const label = `Condition ${i + 1}`;
    const from = row.from.trim();
    const to = row.to.trim();
    const rate = row.rate.trim();

    if (!WHOLE.test(from) || Number(from) < 1) {
      return { error: `${label}: "Days delayed from" must be a whole number of 1 or more.` };
    }
    if (row.noMax && i !== rows.length - 1) {
      return { error: `${label}: only the last condition can have no maximum.` };
    }
    if (!row.noMax) {
      if (!WHOLE.test(to)) return { error: `${label}: enter "Days delayed to", or tick No maximum on the last condition.` };
      if (Number(to) < Number(from)) return { error: `${label}: "Days delayed to" can't be lower than "Days delayed from".` };
    }
    if (!RATE.test(rate)) {
      return { error: `${label}: the penalty rate must be a number of 0 or more, with at most ${RATE_DECIMALS} decimals.` };
    }
    if (Number(rate) > 100) return { error: `${label}: the penalty rate can't be more than 100%.` };

    parsed.push({ days_from: Number(from), days_to: row.noMax ? null : Number(to), rate: Number(rate) });
  }

  const sorted = [...parsed].sort((a, b) => a.days_from - b.days_from);
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    if (prev.days_to === null || cur.days_from <= prev.days_to) {
      return { error: `${describeRange(prev)} and ${describeRange(cur)} overlap. Each overdue day can fall in one condition only.` };
    }
  }
  // An open-ended bracket that doesn't sort last is caught above: whatever
  // follows it overlaps "and above".
  return { conditions: sorted };
}

/**
 * Overdue days no bracket covers, e.g. ["1–2 days", "8–9 days"]. Allowed —
 * an uncovered day carries no penalty, which is how a grace period is
 * written — but the form says so, so a gap is never an accident.
 */
export function uncoveredDays(conditions: PenaltyCondition[]): string[] {
  const gaps: string[] = [];
  let expected = 1;
  for (const c of conditions) {
    if (c.days_from > expected) gaps.push(describeRange({ days_from: expected, days_to: c.days_from - 1 }));
    if (c.days_to === null) return gaps;
    expected = c.days_to + 1;
  }
  return gaps;
}

/** The ONE bracket rate for `daysOverdue`, or null when no penalty applies. */
export function resolvePenaltyRate(conditions: PenaltyCondition[], daysOverdue: number): number | null {
  if (!Number.isFinite(daysOverdue) || daysOverdue < 1) return null;
  const hit = conditions.find((c) => daysOverdue >= c.days_from && (c.days_to === null || daysOverdue <= c.days_to));
  return hit ? hit.rate : null;
}

/**
 * Product id → name of the ACTIVE configuration (other than `editingId`) it
 * follows. A product may follow one active penalty policy only.
 */
export function activeProductOwners(configs: PenaltyConfig[], editingId: number | null): Map<number, string> {
  const owner = new Map<number, string>();
  for (const c of configs) {
    if (c.id === editingId || c.status !== "active") continue;
    for (const id of c.applicable_product_ids) owner.set(id, c.name);
  }
  return owner;
}

/** The picked products another active configuration already holds. */
export function productConflicts(
  productIds: number[],
  owner: Map<number, string>,
): { productId: number; configName: string }[] {
  return productIds.flatMap((productId) => {
    const configName = owner.get(productId);
    return configName ? [{ productId, configName }] : [];
  });
}

/**
 * The whole form as the API body, or the first problem in words. `requireProducts`
 * is false only when editing an inactive configuration: one must have a
 * product before it can be active (ClickUp §7.2).
 */
export function buildPenaltyPayload(
  input: PenaltyFormInput,
  opts: { requireProducts: boolean },
): { payload: SavePenaltyConfigData } | { error: string } {
  const name = input.name.trim();
  if (!name) return { error: "Penalty name is required." };
  if (opts.requireProducts && input.productIds.length === 0) {
    return { error: "Select at least one loan product." };
  }
  const result = parseConditions(input.rows);
  if ("error" in result) return result;
  return { payload: { name, applicable_product_ids: input.productIds, conditions: result.conditions } };
}
