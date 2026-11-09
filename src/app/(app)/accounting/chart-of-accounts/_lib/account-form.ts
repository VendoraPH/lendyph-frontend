/**
 * The chart of accounts' add and edit form, its options in words, and the
 * table's Balance and Status columns.
 *
 * The server decides everything that is a rule (the code agrees with the type,
 * a parent is a heading of the same type, a heading carries no cash kind, a
 * mapped account can't change type); its 422 message is shown as it is. The
 * checks here only stop a form that can't be sent at all.
 */
import { formatCentavos } from "@/lib/accounting/money";
import type { Account, AccountType, CashAccountKind } from "@/types";
import { accountTypeLabel, cashKindLabel } from "../../_lib/display-labels";
import type { SelectItemOption } from "../../_lib/select-items";

/** The server's cash flow sections (`CashFlowCategories::ALL`). */
export type CashFlowCategory = "operating" | "investing" | "financing" | "cash";

/** The account as the server sends it, with its cash flow category. */
export type AccountWithCategory = Account & { cash_flow_category?: CashFlowCategory | null };

/** Select values that stand for "none": a Select can't hold an empty string. */
export const NO_PARENT = "none";
export const NO_CASH_KIND = "none";
/** Let the server set the category from the type and cash kind (new accounts only). */
export const AUTO_CATEGORY = "auto";

/** The server's field limits. */
const CODE_MAX = 16;
const NAME_MAX = 160;
export const DESCRIPTION_MAX = 500;

const ACCOUNT_TYPES: readonly AccountType[] = ["asset", "liability", "equity", "income", "expense"];
const CASH_KINDS: readonly CashAccountKind[] = ["cash", "bank", "gcash", "maya", "wallet"];

const CASH_FLOW_CATEGORY_LABELS: Record<CashFlowCategory, string> = {
  operating: "Operating activities",
  investing: "Investing activities",
  financing: "Financing activities",
  cash: "Cash and cash equivalents",
};

export interface AccountFormValues {
  code: string;
  name: string;
  type: AccountType | "";
  /** An account id, or NO_PARENT. */
  parentId: string;
  isContra: boolean;
  /** A cash kind, or NO_CASH_KIND. */
  cashKind: string;
  /** A category, or AUTO_CATEGORY. */
  cashFlowCategory: string;
  description: string;
}

export function emptyAccountForm(): AccountFormValues {
  return {
    code: "",
    name: "",
    type: "",
    parentId: NO_PARENT,
    isContra: false,
    cashKind: NO_CASH_KIND,
    cashFlowCategory: AUTO_CATEGORY,
    description: "",
  };
}

export function accountFormFromAccount(account: AccountWithCategory): AccountFormValues {
  return {
    code: account.code,
    name: account.name,
    type: account.type,
    parentId: account.parent_id == null ? NO_PARENT : String(account.parent_id),
    isContra: account.is_contra,
    cashKind: account.cash_kind ?? NO_CASH_KIND,
    cashFlowCategory: account.cash_flow_category ?? AUTO_CATEGORY,
    description: account.description ?? "",
  };
}

/** What `createAccount()` and `updateAccount()` send. */
export interface AccountPayload {
  code: string;
  name: string;
  type: AccountType;
  parent_id: number | null;
  is_contra: boolean;
  cash_kind: CashAccountKind | null;
  /** Left out to let the server set it (new) or keep the stored one (edit). */
  cash_flow_category?: CashFlowCategory;
  description: string | null;
}

/** The form's body, or null while it can't be sent. */
export function buildAccountPayload(values: AccountFormValues): AccountPayload | null {
  const code = values.code.trim();
  const name = values.name.trim();
  const description = values.description.trim();
  if (!code || code.length > CODE_MAX) return null;
  if (!name || name.length > NAME_MAX) return null;
  if (!values.type) return null;
  if (description.length > DESCRIPTION_MAX) return null;

  const payload: AccountPayload = {
    code,
    name,
    type: values.type,
    parent_id: values.parentId === NO_PARENT ? null : Number(values.parentId),
    is_contra: values.isContra,
    cash_kind: (CASH_KINDS as readonly string[]).includes(values.cashKind)
      ? (values.cashKind as CashAccountKind)
      : null,
    description: description || null,
  };
  if (values.cashFlowCategory in CASH_FLOW_CATEGORY_LABELS) {
    payload.cash_flow_category = values.cashFlowCategory as CashFlowCategory;
  }
  return payload;
}

export const accountTypeItems: readonly SelectItemOption[] = ACCOUNT_TYPES.map((type) => ({
  value: type,
  label: accountTypeLabel(type),
}));

export const cashKindItems: readonly SelectItemOption[] = [
  { value: NO_CASH_KIND, label: "Not a money account" },
  ...CASH_KINDS.map((kind) => ({ value: kind, label: cashKindLabel(kind) })),
];

/** A stored category reads in words; one the screen doesn't know reads its key in words. */
export function cashFlowCategoryLabel(category: string): string {
  return (
    CASH_FLOW_CATEGORY_LABELS[category as CashFlowCategory] ??
    category
      .split("_")
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ")
  );
}

/** "Automatic" is offered only where leaving the field out means the server sets it. */
export function cashFlowCategoryItems(withAutomatic: boolean): SelectItemOption[] {
  const categories = (Object.keys(CASH_FLOW_CATEGORY_LABELS) as CashFlowCategory[]).map(
    (category) => ({ value: category, label: CASH_FLOW_CATEGORY_LABELS[category] }),
  );
  return withAutomatic
    ? [{ value: AUTO_CATEGORY, label: "Automatic, from the type" }, ...categories]
    : categories;
}

/** The headings an account of `type` can sit under, never the account itself. */
export function parentHeadingItems(
  accounts: readonly Account[],
  type: AccountType | "",
  selfId: number | null,
): SelectItemOption[] {
  return [
    { value: NO_PARENT, label: "No parent (top level)" },
    ...accounts
      .filter((a) => a.is_group && a.type === type && a.id !== selfId)
      .map((a) => ({ value: String(a.id), label: `${a.code} ${a.name}` })),
  ];
}

/** The server's balance; a heading has none of its own, and a missing one reads as a dash. */
export function accountBalanceText(account: Pick<Account, "is_group" | "balance">): string {
  if (account.is_group || account.balance == null) return "—";
  return formatCentavos(account.balance);
}

export function accountStatusLabel(account: Pick<Account, "is_active">): string {
  return account.is_active ? "Active" : "Inactive";
}
