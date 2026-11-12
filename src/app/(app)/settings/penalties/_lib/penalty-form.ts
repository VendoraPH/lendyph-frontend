import type { PenaltyCondition, PenaltyConfig, SavePenaltyConfigData } from "@/types/penalty";
import { formatRate } from "@/lib/format";
import { bracketRangeLabel } from "@/components/loans/penalty-terms";

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

/** The form's note on what a save changes: only loans created afterwards. */
export const PENALTY_FORM_NOTE =
  "Changes apply to loans created after you save. Loans already created keep the penalty terms they were created with.";

/**
 * When charges fall (the owner's monthly rule): when grace ends, then once a
 * month while unpaid, each at the bracket for that day's days late. So a short
 * bracket between two charge days may never apply. Words only.
 */
export const CHARGE_DAYS_NOTE =
  "Penalties are charged when grace ends and then once a month while unpaid; each charge uses the rate for how many days late it is that day.";

/** What deactivating changes: new loans only. */
export const DEACTIVATE_NOTE = "New loans on these products will use no configuration.";

/** What activating changes: new loans only. */
export const ACTIVATE_NOTE = "New loans on these products will use these conditions.";

/** Said with both: loans already created never change. */
export const EXISTING_LOANS_NOTE = "Loans already created keep the penalty terms they were created with.";

const WHOLE = /^\d+$/;
const NUMBER = /^\d+(\.\d+)?$/;

/** A bracket as the settings screens list it: "1–5 days: 20%". */
export function describeCondition(c: PenaltyCondition): string {
  return `${bracketRangeLabel(c)}: ${formatRate(c.rate)}%`;
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
 * The row "Add Condition" appends, prefilled to start the day after the last
 * row ends. A last row marked "No maximum" can no longer be last, so its box
 * is cleared.
 */
export function appendRow(rows: ConditionRow[], key: number): ConditionRow[] {
  const last = rows[rows.length - 1];
  const lastTo = last && !last.noMax && WHOLE.test(last.to.trim()) ? Number(last.to) : null;
  const next: ConditionRow = { key, from: lastTo !== null ? String(lastTo + 1) : "", to: "", noMax: false, rate: "" };
  const kept = rows.map((r, i) => (i === rows.length - 1 && r.noMax ? { ...r, noMax: false } : r));
  return [...kept, next];
}

/**
 * The rows as API brackets, or the first incomplete row in words.
 *
 * The browser checks only that the form is complete: every row has its days
 * and a rate, and "to" is not below "from". Everything else (brackets that
 * start at day 1 and run without gaps or overlaps, the open-ended last row,
 * the rate's range and decimals, the number of rows) is the server's rule,
 * and its 422 is shown as sent. Rows are sent sorted by their first day, so
 * typing order doesn't matter.
 */
export function parseConditions(rows: ConditionRow[]): { conditions: PenaltyCondition[] } | { error: string } {
  if (rows.length === 0) return { error: "Add at least one penalty condition." };

  const parsed: PenaltyCondition[] = [];
  for (const [i, row] of rows.entries()) {
    const label = `Condition ${i + 1}`;
    const from = row.from.trim();
    const to = row.to.trim();
    const rate = row.rate.trim();

    if (!WHOLE.test(from)) return { error: `${label}: enter "Days delayed from".` };
    if (!row.noMax) {
      if (!WHOLE.test(to)) return { error: `${label}: enter "Days delayed to", or tick No maximum on the last condition.` };
      if (Number(to) < Number(from)) return { error: `${label}: "Days delayed to" can't be lower than "Days delayed from".` };
    }
    if (!NUMBER.test(rate)) return { error: `${label}: enter the penalty rate.` };

    parsed.push({ days_from: Number(from), days_to: row.noMax ? null : Number(to), rate: Number(rate) });
  }
  return { conditions: [...parsed].sort((a, b) => a.days_from - b.days_from) };
}

/**
 * Product id → name of the ACTIVE configuration (other than `editingId`) that
 * already covers it. Shown as a hint in the product picker only; whether a
 * product can join is the server's call (409 or 422 in words).
 */
export function activeProductOwners(configs: PenaltyConfig[], editingId: number | null): Map<number, string> {
  const owner = new Map<number, string>();
  for (const c of configs) {
    if (c.id === editingId || c.status !== "active") continue;
    for (const id of c.applicable_product_ids) owner.set(id, c.name);
  }
  return owner;
}

/**
 * The names of a configuration's products, from the server's `products`.
 * Never a raw id: a product the server didn't name reads from the loaded
 * product list, "Loading…" until that list arrives, and "—" if it isn't there.
 */
export function configProductNames(
  config: Pick<PenaltyConfig, "applicable_product_ids" | "products">,
  loadedNames: ReadonlyMap<number, string> | null,
): string[] {
  const served = new Map((config.products ?? []).map((p) => [p.id, p.name]));
  return config.applicable_product_ids.map((id) => served.get(id) ?? loadedNames?.get(id) ?? (loadedNames ? "—" : "Loading…"));
}

/** The whole form as the API body, or the first incomplete field in words. */
export function buildPenaltyPayload(input: PenaltyFormInput): { payload: SavePenaltyConfigData } | { error: string } {
  const name = input.name.trim();
  if (!name) return { error: "Penalty name is required." };
  const result = parseConditions(input.rows);
  if ("error" in result) return result;
  return { payload: { name, applicable_product_ids: input.productIds, conditions: result.conditions } };
}
