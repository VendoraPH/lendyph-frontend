import { parseMoneyInput } from "@/lib/money-input";
import type {
  InterestCrediting,
  SavingsProduct,
  SavingsProductCreateInput,
  SavingsMemberType,
  SavingsProductKind,
  SavingsProductRulesInput,
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
  // Rules (regular products; a time deposit keeps only eligibility). Blank is no limit.
  maxBalance: string;
  minDeposit: string;
  maxDeposit: string;
  minWithdrawal: string;
  maxWithdrawal: string;
  /** Blank is unlimited. */
  freeWithdrawals: string;
  /** Beyond the free count: charge `excessFee`, or refuse the withdrawal. */
  excessMode: "fee" | "refuse";
  excessFee: string;
  allowDeposits: boolean;
  allowWithdrawals: boolean;
  allowTransfers: boolean;
  /** None picked is every member type. */
  memberTypes: SavingsMemberType[];
  /** None picked is every branch. */
  branchIds: number[];
}

/** The member types in the order the server stores them. */
export const MEMBER_TYPES: readonly SavingsMemberType[] = ["regular", "associate"];

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
    maxBalance: p?.max_balance ?? "",
    minDeposit: p?.min_deposit ?? "",
    maxDeposit: p?.max_deposit ?? "",
    minWithdrawal: p?.min_withdrawal ?? "",
    maxWithdrawal: p?.max_withdrawal ?? "",
    freeWithdrawals: p?.free_withdrawals_per_month == null ? "" : String(p.free_withdrawals_per_month),
    // A stored product with a free count and no fee refuses beyond it.
    excessMode: p && p.free_withdrawals_per_month != null && p.excess_withdrawal_fee == null ? "refuse" : "fee",
    excessFee: p?.excess_withdrawal_fee ?? "",
    allowDeposits: p?.allow_deposits ?? true,
    allowWithdrawals: p?.allow_withdrawals ?? true,
    allowTransfers: p?.allow_transfers ?? true,
    memberTypes: p?.eligible_member_types ?? [],
    branchIds: p?.eligible_branch_ids ?? [],
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

/** A limit as typed: blank is no limit (null), else two-decimal text. */
function limitField(raw: string, label: string, bad: string[]): string | null {
  if (raw.trim() === "") return null;
  const parsed = parseMoneyInput(raw, { label, allowZero: true });
  if (!parsed.ok) {
    bad.push(label);
    return null;
  }
  return parsed.value;
}

/**
 * The rule fields to send. A time deposit product takes only eligibility (the
 * server refuses the rest there). Nothing is compared here: the server checks
 * each minimum against its maximum and answers in words.
 */
function readRules(d: ProductDraft, problems: string[]): SavingsProductRulesInput {
  const eligibility: SavingsProductRulesInput = {
    eligible_member_types: d.memberTypes.length ? MEMBER_TYPES.filter((t) => d.memberTypes.includes(t)) : null,
    eligible_branch_ids: d.branchIds.length ? [...new Set(d.branchIds)].sort((a, b) => a - b) : null,
  };
  if (d.kind === "time_deposit") return eligibility;

  const free = d.freeWithdrawals.trim();
  let freeCount: number | null = null;
  if (free !== "") {
    if (/^\d{1,4}$/.test(free) && Number(free) <= 1000) freeCount = Number(free);
    else problems.push("Free withdrawals a month (a whole number, or blank for no limit)");
  }
  let fee: string | null = null;
  if (free !== "" && d.excessMode === "fee") {
    const parsed = parseMoneyInput(d.excessFee, { label: "Excess-withdrawal fee", allowZero: true });
    if (parsed.ok) fee = parsed.value;
    else problems.push("Excess-withdrawal fee");
  }

  return {
    max_balance: limitField(d.maxBalance, "Maximum balance", problems),
    min_deposit: limitField(d.minDeposit, "Minimum deposit", problems),
    max_deposit: limitField(d.maxDeposit, "Maximum deposit", problems),
    min_withdrawal: limitField(d.minWithdrawal, "Minimum withdrawal", problems),
    max_withdrawal: limitField(d.maxWithdrawal, "Maximum withdrawal", problems),
    free_withdrawals_per_month: freeCount,
    excess_withdrawal_fee: fee,
    allow_deposits: d.allowDeposits,
    allow_withdrawals: d.allowWithdrawals,
    allow_transfers: d.allowTransfers,
    ...eligibility,
  };
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
    is_active: d.active,
    // The time-deposit fields go only on a time deposit; the server refuses them on a regular product.
    ...(td
      ? {
          term_options_days: terms ?? [],
          pretermination_product_id: d.preProductId ? Number(d.preProductId) : null,
        }
      : {}),
    ...readRules(d, problems),
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
