// The accounting screens' stored keys in words. Dependency-free so it runs under
// `tsx --test`.

const WORDS_THAT_KEEP_THEIR_CASE: Record<string, string> = { gcash: "GCash" };

/** "loan_release" → "Loan Release", "gcash" → "GCash". Any new key reads the same way. */
function inWords(key: string): string {
  return key
    .split("_")
    .filter(Boolean)
    .map((word) => WORDS_THAT_KEEP_THEIR_CASE[word] ?? word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Where `inWords` reads badly: "Closing" says nothing about the year, and the
 * two statement-line sources (reconciliation's suspense postings) would read
 * "Bank Transaction" and "Cash Transaction".
 */
const JOURNAL_SOURCE_LABELS: Record<string, string> = {
  closing: "Year-end closing",
  bank_transaction: "Bank statement entry",
  cash_transaction: "Cash count entry",
};

/** The source is a string, not `JournalSource`: the server has values the union doesn't. */
export const journalSourceLabel = (source: string): string =>
  JOURNAL_SOURCE_LABELS[source] ?? inWords(source);
export const journalStatusLabel = (status: string): string => inWords(status);
export const accountTypeLabel = (type: string): string => inWords(type);
export const cashKindLabel = (kind: string): string => inWords(kind);
/** An account's normal side, "debit" or "credit", as "Debit" or "Credit". */
export const normalBalanceLabel = (side: string): string => inWords(side.toLowerCase());
export const periodStatusLabel = (status: string): string => inWords(status);

/** As the Expenses status filter reads them; any other status reads in words. */
const EXPENSE_STATUS_LABELS: Record<string, string> = {
  unpaid: "Unpaid",
  partially_paid: "Partially paid",
  paid: "Paid",
  overdue: "Overdue",
};

export const expenseStatusLabel = (status: string): string =>
  EXPENSE_STATUS_LABELS[status] ?? inWords(status);

const CHART_TEMPLATE_LABELS: Record<string, string> = {
  lending_company: "Lending company",
  cooperative: "Cooperative",
};

export const chartTemplateLabel = (template: string): string =>
  CHART_TEMPLATE_LABELS[template] ?? inWords(template);

/** The allowance buckets as the aging report reads its ranges. */
const ALLOWANCE_BUCKET_LABELS: Record<string, string> = {
  "1_30": "1–30 days",
  "31_60": "31–60 days",
  "61_90": "61–90 days",
  "91_120": "91–120 days",
  over_120: "Over 120 days",
};

export const allowanceBucketLabel = (bucket: string): string =>
  ALLOWANCE_BUCKET_LABELS[bucket] ?? inWords(bucket);

export const yearCloseStatusLabel = (status: string): string => inWords(status);

/** `finalised` reads "Posted": that is what finalising does. */
const OPENING_BALANCE_STATUS_LABELS: Record<string, string> = {
  none: "Not started",
  draft: "Draft",
  finalised: "Posted",
  posted_elsewhere: "Posted from the command line",
};

export const openingBalanceStatusLabel = (status: string): string =>
  OPENING_BALANCE_STATUS_LABELS[status] ?? inWords(status);
