import type {
  Account,
  AgingBucket,
  AllowanceBucket,
  ChartTemplate,
  JournalSource,
} from "@/types";
import { AGING_BUCKETS, agingBucketLabel } from "@/lib/accounting/aging";
import { allowanceBucketLabel, chartTemplateLabel, journalSourceLabel } from "./display-labels";

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

/** "Any source" as a Select value. */
export const ANY_SOURCE = "any";

/**
 * Every `JournalSource`, in the union's order. A `Record` so that a source
 * added to the union and not here fails the typecheck.
 */
const JOURNAL_SOURCES: Record<JournalSource, true> = {
  loan_release: true,
  loan_collection: true,
  penalty: true,
  loan_fee: true,
  gcash: true,
  cash_transaction: true,
  bank_transaction: true,
  cash_in: true,
  cash_out: true,
  expense: true,
  payable: true,
  transfer: true,
  manual: true,
  adjustment: true,
  reversal: true,
  opening_balance: true,
  credit_loss: true,
  share_capital: true,
  closing: true,
};

export const journalSourceItems: readonly SelectItemOption[] = [
  { value: ANY_SOURCE, label: "Any source" },
  ...Object.keys(JOURNAL_SOURCES).map((source) => ({
    value: source,
    label: journalSourceLabel(source),
  })),
];

/** The aging buckets, youngest first, labelled as the aging report labels them. */
export const agingBucketItems: readonly SelectItemOption[] = AGING_BUCKETS.map(
  (bucket: AgingBucket) => ({ value: bucket, label: agingBucketLabel(bucket) }),
);

/** How the Loan Accounting list groups its rows (`group`). */
export const agingGroupItems: readonly SelectItemOption[] = [
  { value: "loan", label: "By loan" },
  { value: "member", label: "By member" },
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

/** The chart templates, the default (today's chart) first. */
const CHART_TEMPLATES: readonly ChartTemplate[] = ["lending_company", "cooperative"];

export const chartTemplateItems: readonly SelectItemOption[] = CHART_TEMPLATES.map(
  (template) => ({ value: template, label: chartTemplateLabel(template) }),
);

/** The allowance buckets, youngest first. */
const ALLOWANCE_BUCKETS: readonly AllowanceBucket[] = [
  "1_30",
  "31_60",
  "61_90",
  "91_120",
  "over_120",
];

export const allowanceBucketItems: readonly SelectItemOption[] = ALLOWANCE_BUCKETS.map(
  (bucket) => ({ value: bucket, label: allowanceBucketLabel(bucket) }),
);
