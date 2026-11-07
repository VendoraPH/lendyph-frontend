import type { InterestPosting, SavingsProduct, SavingsProductInput, SavingsProductKind } from "@/types";
import { productProblems, toAmount } from "../../_lib/savings-rules";
import { parseTermOptions } from "../../_lib/time-deposit-rules";

/** The product form as typed. Numbers are read on save. */
export interface ProductDraft {
  kind: SavingsProductKind;
  code: string;
  name: string;
  rate: string;
  posting: InterestPosting;
  minOpening: string;
  maintaining: string;
  minForInterest: string;
  dormantDays: string;
  withholding: string;
  terms: string;
  preRate: string;
  active: boolean;
}

const text = (v: number | string | null | undefined) => (v == null ? "" : String(toAmount(v)));

export function toDraft(p: SavingsProduct | null, kind: SavingsProductKind = "regular"): ProductDraft {
  return {
    kind: p?.kind ?? kind,
    code: p?.code ?? "",
    name: p?.name ?? "",
    rate: text(p?.annual_interest_rate),
    posting: p?.interest_posting ?? "quarterly",
    minOpening: text(p?.minimum_opening_balance),
    maintaining: text(p?.maintaining_balance),
    minForInterest: text(p?.minimum_balance_for_interest),
    dormantDays: p?.dormant_after_days != null ? String(p.dormant_after_days) : "",
    withholding: text(p?.withholding_tax_rate),
    terms: p?.term_options_days?.join(", ") ?? "",
    preRate: text(p?.pretermination_rate),
    active: p?.is_active ?? true,
  };
}

/**
 * The input to save, or the labels of the fields to fix. A blank number is 0;
 * a typed value that is not a number is named rather than saved as NaN.
 */
export function readDraft(d: ProductDraft): { input: SavingsProductInput; problems: string[] } {
  const bad: string[] = [];
  const num = (s: string, label: string) => {
    if (s.trim() === "") return 0;
    const n = Number(s.replace(/,/g, ""));
    if (Number.isNaN(n)) bad.push(label);
    return n;
  };
  const td = d.kind === "time_deposit";
  const terms = td ? parseTermOptions(d.terms) : null;
  const input: SavingsProductInput = {
    kind: d.kind,
    code: d.code.trim(),
    name: d.name.trim(),
    annual_interest_rate: num(d.rate, "Interest rate"),
    // A time deposit pays its interest at maturity; the schedule is unused.
    interest_posting: td ? "annual" : d.posting,
    minimum_opening_balance: num(d.minOpening, td ? "Minimum placement" : "Minimum opening balance"),
    maintaining_balance: td ? 0 : num(d.maintaining, "Maintaining balance"),
    minimum_balance_for_interest: td ? 0 : num(d.minForInterest, "Minimum balance to earn interest"),
    dormant_after_days: td || d.dormantDays.trim() === "" ? null : Number(d.dormantDays),
    withholding_tax_rate: num(d.withholding, "Withholding tax"),
    term_options_days: td ? (terms ?? []) : null,
    pretermination_rate: td ? num(d.preRate, "Pre-termination rate") : null,
    is_active: d.active,
  };
  const problems = productProblems(input);
  for (const label of bad) if (!problems.some((p) => p.startsWith(label))) problems.push(label);
  return { input, problems };
}
