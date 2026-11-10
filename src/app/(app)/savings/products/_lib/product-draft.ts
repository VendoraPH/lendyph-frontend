import { parseMoneyInput } from "@/lib/money-input";
import type {
  InterestCrediting,
  SavingsProduct,
  SavingsProductCreateInput,
  SavingsProductKind,
  SavingsProductUpdateInput,
} from "@/types";
import { parseTermOptions } from "../../_lib/time-deposit-rules";

/** The product form as typed. Figures are sent as typed, never worked out. */
export interface ProductDraft {
  kind: SavingsProductKind;
  code: string;
  name: string;
  /** The first rate, on create only; later rates go through the rates table. */
  rate: string;
  crediting: InterestCrediting;
  minOpening: string;
  maintaining: string;
  minAdb: string;
  terms: string;
  /** Time deposits: the regular product whose rate pays an early termination. */
  preProductId: string;
  active: boolean;
}

export function toDraft(p: SavingsProduct | null, kind: SavingsProductKind = "regular"): ProductDraft {
  return {
    kind: p?.kind ?? kind,
    code: p?.code ?? "",
    name: p?.name ?? "",
    rate: "",
    crediting: p?.interest_crediting ?? "quarterly",
    minOpening: p?.minimum_opening_balance ?? "",
    maintaining: p?.maintaining_balance ?? "",
    minAdb: p?.minimum_adb_for_interest ?? "",
    terms: p?.term_options_days?.join(", ") ?? "",
    preProductId: p?.pretermination_product_id ? String(p.pretermination_product_id) : "",
    // A new product starts off: the server turns it on only once the books are ready.
    active: p?.is_active ?? false,
  };
}

/** A percent per year as typed: digits with up to four decimals, 0 to 100. Sent as typed, never rounded. */
const RATE = /^\d{1,3}(\.\d{1,4})?$/;

export function rateProblem(raw: string, label = "Interest rate"): string | null {
  const s = raw.trim();
  if (!RATE.test(s) || Number(s) > 100) return `${label} (0 to 100%, up to four decimals)`;
  return null;
}

/** A peso field as typed, blank read as ₱0.00. */
function moneyField(raw: string, label: string, bad: string[]): string {
  if (raw.trim() === "") return "0.00";
  const parsed = parseMoneyInput(raw, { label, allowZero: true });
  if (!parsed.ok) {
    bad.push(label);
    return "0.00";
  }
  return parsed.value;
}

/** The fields shared by create and update, or the labels to fix. */
function readTerms(d: ProductDraft): { input: SavingsProductUpdateInput; problems: string[] } {
  const problems: string[] = [];
  const td = d.kind === "time_deposit";
  if (!d.code.trim()) problems.push("Code");
  if (!d.name.trim()) problems.push("Name");
  const terms = td ? parseTermOptions(d.terms) : null;
  if (td && terms === null) problems.push("Terms offered (days)");
  const input: SavingsProductUpdateInput = {
    code: d.code.trim(),
    name: d.name.trim(),
    // A time deposit pays its interest at maturity; the schedule is unused.
    interest_crediting: td ? "annual" : d.crediting,
    minimum_opening_balance: moneyField(d.minOpening, td ? "Minimum placement" : "Minimum opening balance", problems),
    maintaining_balance: td ? "0.00" : moneyField(d.maintaining, "Maintaining balance", problems),
    minimum_adb_for_interest: td ? "0.00" : moneyField(d.minAdb, "Minimum average daily balance to earn interest", problems),
    term_options_days: td ? (terms ?? []) : null,
    pretermination_product_id: td && d.preProductId ? Number(d.preProductId) : null,
    is_active: d.active,
  };
  return { input, problems };
}

/** `POST /savings/products`: the terms plus the first rate. */
export function readCreateDraft(d: ProductDraft): { input: SavingsProductCreateInput; problems: string[] } {
  const { input, problems } = readTerms(d);
  const rateError = rateProblem(d.rate);
  if (rateError) problems.push(rateError);
  return { input: { ...input, kind: d.kind, annual_interest_rate: d.rate.trim() }, problems };
}

/** `PUT /savings/products/{id}`: the terms only; rates are added through the rates table. */
export function readUpdateDraft(d: ProductDraft): { input: SavingsProductUpdateInput; problems: string[] } {
  return readTerms(d);
}
