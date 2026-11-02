/**
 * The loan page's money figures, read from the server; nothing is worked out
 * here.
 *
 * - `total_outstanding` (summary and LoanResource): everything still owed on
 *   the loan, insurance premium included. Every "Outstanding" figure.
 * - `outstanding_principal` (summary and LoanResource): principal only.
 *   Shown as "Principal Balance".
 * - `advance_presets` (summary): one `{periods, amount}` per open period, in
 *   allocation order; `amount` is what paying that many periods ahead takes
 *   today, premium and penalty owed included. Only the 1-period entry on a
 *   Share Capital Build-Up loan.
 * - `payoff_amount` (summary): what clears the loan today.
 * - `total_payable` (LoanResource): the amount still owed, never including
 *   Share Capital Build-Up; null before release. `contract_total`: the
 *   contract's principal plus interest, shown on its own line.
 * - `total_outstanding_before` / `total_outstanding_after` (payment
 *   preview): `total_outstanding` before and after the previewed payment.
 *
 * `outstanding_balance` is a deprecated alias whose meaning differs between
 * the summary and LoanResource, so it is never read here.
 *
 * A figure the server did not send is null (a dash on screen); 0 stays 0.
 * Pure, so it runs under `tsx --test`.
 */
import { toNumber } from "@/lib/report-format";

export interface AdvancePreset {
  periods: number;
  amount: number;
}

function record(raw: unknown): Record<string, unknown> | null {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
}

function figure(raw: unknown): number | null {
  if (typeof raw !== "number" && typeof raw !== "string") return null;
  return toNumber(raw);
}

/** The summary's `advance_presets`; entries without a readable count or amount are left out. */
export function readAdvancePresets(summary: unknown): AdvancePreset[] {
  const list = record(summary)?.advance_presets;
  if (!Array.isArray(list)) return [];
  return list.flatMap((entry) => {
    const e = record(entry);
    const periods = e?.periods;
    const amount = figure(e?.amount);
    return typeof periods === "number" && Number.isInteger(periods) && periods > 0 && amount !== null
      ? [{ periods, amount }]
      : [];
  });
}

/** The amount for paying `n` periods ahead: `advance_presets[n-1]`, null when not sent. */
export function advancePresetAmount(presets: readonly AdvancePreset[], n: number): number | null {
  const preset = presets[n - 1];
  return preset !== undefined && preset.periods === n ? preset.amount : null;
}

/** The presets among `choices` the server sent, in the order of `choices`. */
export function offeredAdvancePresets(presets: readonly AdvancePreset[], choices: readonly number[]): AdvancePreset[] {
  return choices.flatMap((n) => {
    const amount = advancePresetAmount(presets, n);
    return amount === null ? [] : [{ periods: n, amount }];
  });
}

/** The period counts the Record Payment dialog offers a preset for, when the server sent one. */
export const ADVANCE_PRESET_CHOICES: readonly number[] = [1, 2, 3, 6];

export interface PresetButton {
  label: string;
  /** The period count the payment's remark states. */
  periods: number;
  /** The server's amount. */
  amount: number;
}

/**
 * The Record Payment dialog's "Pay ahead by" buttons: one per preset the
 * server sent among `ADVANCE_PRESET_CHOICES`, then "Pay all remaining" with
 * `payoff_amount`. That button is left out when `payoff_amount` is null or not
 * sent (the server sends null on a Share Capital Build-Up loan and on a loan
 * that can't take payments). `unpaidCount` is the open periods on the
 * schedule, for that button's remark only.
 */
export function presetButtons(summary: unknown, unpaidCount: number): PresetButton[] {
  const presets = offeredAdvancePresets(readAdvancePresets(summary), ADVANCE_PRESET_CHOICES).map(
    ({ periods, amount }) => ({
      label: `${periods} period${periods === 1 ? "" : "s"}`,
      periods,
      amount,
    }),
  );
  const payoff = readPayoffAmount(summary);
  if (payoff === null) return presets;
  return [...presets, { label: "Pay all remaining", periods: unpaidCount, amount: payoff }];
}

/** The summary's `payoff_amount`, null when not sent. */
export function readPayoffAmount(summary: unknown): number | null {
  return figure(record(summary)?.payoff_amount);
}

/** One field, from the summary when it sent it, else from the loan. Both mean the same. */
function fromEither(summary: unknown, loan: unknown, key: string): number | null {
  return figure(record(summary)?.[key]) ?? figure(record(loan)?.[key]);
}

/** Everything still owed, premium included: `total_outstanding`. */
export function totalOutstanding(summary: unknown, loan: unknown): number | null {
  return fromEither(summary, loan, "total_outstanding");
}

/** Principal still owed: `outstanding_principal`. */
export function outstandingPrincipal(summary: unknown, loan: unknown): number | null {
  return fromEither(summary, loan, "outstanding_principal");
}

/** Total Payable (null before release) and the contract total, as LoanResource sends them. */
export function totalPayableFigures(loan: unknown): { totalPayable: number | null; contractTotal: number | null } {
  const l = record(loan);
  return { totalPayable: figure(l?.total_payable), contractTotal: figure(l?.contract_total) };
}

/** The payment preview's `total_outstanding_before`. */
export function previewOutstandingBefore(preview: unknown): number | null {
  return figure(record(preview)?.total_outstanding_before);
}

/** The payment preview's `total_outstanding_after`. */
export function previewOutstandingAfter(preview: unknown): number | null {
  return figure(record(preview)?.total_outstanding_after);
}
