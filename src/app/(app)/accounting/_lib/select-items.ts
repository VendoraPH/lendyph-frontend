import type { Account } from "@/types";

/** One option of a Base UI `<Select items>` list. */
export interface SelectItemOption {
  value: string;
  label: string;
}

/** "Any status" as a Select value — a Select cannot hold an empty string. */
export const ANY_STATUS = "any";

export const journalStatusItems: readonly SelectItemOption[] = [
  { value: ANY_STATUS, label: "Any status" },
  { value: "draft", label: "Draft" },
  { value: "posted", label: "Posted" },
  { value: "reversed", label: "Reversed" },
];

export const expenseStatusItems: readonly SelectItemOption[] = [
  { value: ANY_STATUS, label: "Any status" },
  { value: "unpaid", label: "Unpaid" },
  { value: "partially_paid", label: "Partially paid" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
];

/**
 * The `items` for an account `<Select>`. Base UI resolves the closed trigger's
 * label from `items`, so without them it shows the account id.
 */
export function accountSelectItems(accounts: readonly Account[]): SelectItemOption[] {
  return accounts.map((a) => ({ value: String(a.id), label: `${a.code} ${a.name}` }));
}
