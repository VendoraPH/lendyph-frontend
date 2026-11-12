/**
 * Every word the member portal shows for a stored key.
 *
 * Each key reads through `labelOf`, from an explicit map, and a key the map
 * doesn't know reads "Other": a raw key ("savings_withdrawal") never reaches a
 * member, and nothing guesses words from one (no `humanize()`). A raw-label
 * guard test keeps it that way.
 */

export type Tone = "success" | "warning" | "danger" | "info" | "muted";

/** What a missing value reads. */
export const NONE = "—";
/** What a key with no words reads. */
export const OTHER = "Other";

/** A stored key in words: its label, "Other" when unknown, "—" when absent. */
export function labelOf(map: Readonly<Record<string, string>>, key: string | null | undefined): string {
  if (key === null || key === undefined || key === "") return NONE;
  return Object.hasOwn(map, key) ? map[key] : OTHER;
}

/** A stored key's tone: "muted" when the map doesn't know it. */
export function toneOf(map: Readonly<Record<string, Tone>>, key: string | null | undefined): Tone {
  return key && Object.hasOwn(map, key) ? map[key] : "muted";
}

/** A loan's `display_status`. Released and ongoing loans read "Current" (round m6). */
export const LOAN_STATUS: Readonly<Record<string, string>> = {
  released: "Current",
  ongoing: "Current",
  past_due: "Past Due",
  completed: "Completed",
  defaulted: "Defaulted",
  restructured: "Restructured",
};
export const LOAN_STATUS_TONE: Readonly<Record<string, Tone>> = {
  released: "success",
  ongoing: "success",
  past_due: "danger",
  completed: "info",
  defaulted: "danger",
  restructured: "muted",
};

export const SCHEDULE_STATUS: Readonly<Record<string, string>> = {
  paid: "Paid",
  partial: "Partly paid",
  due: "Due",
  past_due: "Past due",
  upcoming: "Upcoming",
  closed: "Closed",
};
export const SCHEDULE_STATUS_TONE: Readonly<Record<string, Tone>> = {
  paid: "success",
  partial: "warning",
  due: "info",
  past_due: "danger",
  upcoming: "muted",
  closed: "muted",
};

export const FREQUENCY: Readonly<Record<string, string>> = {
  daily: "Daily",
  weekly: "Weekly",
  bi_weekly: "Every two weeks",
  semi_monthly: "Twice a month",
  monthly: "Monthly",
  upon_maturity: "Upon maturity",
};

export const TERM_UNIT: Readonly<Record<string, string>> = {
  months: "months",
  days: "days",
};

/** The period an interest rate is stated for ("3% per month"). */
export const RATE_PERIOD: Readonly<Record<string, string>> = {
  daily: "per day",
  weekly: "per week",
  bi_weekly: "every two weeks",
  semi_monthly: "twice a month",
  monthly: "per month",
  annual: "per year",
};

export const INTEREST_METHOD: Readonly<Record<string, string>> = {
  straight: "Straight (Fixed)",
  diminishing: "Diminishing",
  upon_maturity: "Upon maturity",
};

export const PAYMENT_METHOD: Readonly<Record<string, string>> = {
  cash: "Cash",
  gcash: "GCash",
  maya: "Maya",
  bank_transfer: "Bank transfer",
  online: "Online",
  auto_pay: "Auto-Pay",
};

export const SAVINGS_STATUS: Readonly<Record<string, string>> = {
  active: "Active",
  dormant: "Dormant",
  frozen: "Frozen",
  closed: "Closed",
};
export const SAVINGS_STATUS_TONE: Readonly<Record<string, Tone>> = {
  active: "success",
  dormant: "warning",
  frozen: "danger",
  closed: "muted",
};

export const SAVINGS_TRANSACTION: Readonly<Record<string, string>> = {
  deposit: "Deposit",
  withdrawal: "Withdrawal",
  transfer_in: "Transfer in",
  transfer_out: "Transfer out",
  interest: "Interest",
  withholding_tax: "Withholding tax",
  closing: "Account closing",
  reversal: "Correction",
};

export const TIME_DEPOSIT_STATUS: Readonly<Record<string, string>> = {
  active: "Active",
  matured: "Matured",
  withdrawn: "Paid out",
  rolled_over: "Rolled over",
  preterminated: "Ended early",
};
export const TIME_DEPOSIT_STATUS_TONE: Readonly<Record<string, Tone>> = {
  active: "success",
  matured: "info",
  withdrawn: "muted",
  rolled_over: "muted",
  preterminated: "muted",
};

export const MATURITY_INSTRUCTION: Readonly<Record<string, string>> = {
  payout: "Pay out at maturity",
  rollover_principal: "Roll over the principal",
  rollover_all: "Roll over principal and interest",
};

export const MEMBER_STATUS: Readonly<Record<string, string>> = {
  active: "Active",
  inactive: "Inactive",
  blacklisted: "Blacklisted",
  withdrawn: "Withdrawn",
  deceased: "Deceased",
};
export const MEMBER_STATUS_TONE: Readonly<Record<string, Tone>> = {
  active: "success",
  inactive: "warning",
  blacklisted: "danger",
  withdrawn: "muted",
  deceased: "muted",
};

export const MEMBER_TYPE: Readonly<Record<string, string>> = {
  regular: "Regular member",
  associate: "Associate member",
};

/** A membership standing line's status (factual only; no overall label, design §13.2). */
export const STANDING_STATUS: Readonly<Record<string, string>> = {
  current: "Current",
  past_due: "Past due",
  defaulted: "Defaulted",
  active: "Active",
  dormant: "Dormant",
  paid_up: "Paid up",
  none: "None",
};
export const STANDING_STATUS_TONE: Readonly<Record<string, Tone>> = {
  current: "success",
  past_due: "danger",
  defaulted: "danger",
  active: "success",
  dormant: "warning",
  paid_up: "success",
  none: "muted",
};

export const REQUEST_TYPE: Readonly<Record<string, string>> = {
  profile_update: "Profile change",
  savings_withdrawal: "Savings withdrawal",
  savings_opening: "New savings account",
};

export const REQUEST_STATUS: Readonly<Record<string, string>> = {
  submitted: "Submitted",
  under_review: "Under review",
  need_info: "More information needed",
  approved: "Waiting for a second approval",
  completed: "Completed",
  rejected: "Not approved",
  cancelled: "Cancelled",
  expired: "Expired",
};
export const REQUEST_STATUS_TONE: Readonly<Record<string, Tone>> = {
  submitted: "info",
  under_review: "info",
  need_info: "warning",
  approved: "info",
  completed: "success",
  rejected: "danger",
  cancelled: "muted",
  expired: "muted",
};

export const REQUEST_ACTOR: Readonly<Record<string, string>> = {
  member: "You",
  staff: "Branch staff",
  system: "Automatic",
};

export const PAYOUT_METHOD: Readonly<Record<string, string>> = {
  cash_pickup: "Cash pickup at the branch",
  bank_transfer: "Bank transfer",
  gcash: "GCash",
};

export const CIVIL_STATUS: Readonly<Record<string, string>> = {
  single: "Single",
  married: "Married",
  widowed: "Widowed",
  separated: "Separated",
  divorced: "Divorced",
};

export const NOTIFICATION_CATEGORY: Readonly<Record<string, string>> = {
  security: "Security",
  requests: "Requests",
  loans: "Loans",
  savings: "Savings",
  share_capital: "Share capital",
};

export const LOGIN_OUTCOME: Readonly<Record<string, string>> = {
  success: "Signed in",
  failed: "Wrong password",
  refused_locked: "Refused while locked",
  locked_out: "Locked after too many tries",
  disabled: "Refused: access turned off",
  portal_off: "Refused: portal turned off",
};
export const LOGIN_OUTCOME_TONE: Readonly<Record<string, Tone>> = {
  success: "success",
  failed: "warning",
  refused_locked: "danger",
  locked_out: "danger",
  disabled: "danger",
  portal_off: "muted",
};

export const ACTIVITY_KIND: Readonly<Record<string, string>> = {
  loan_payment: "Loan payment",
  savings: "Savings",
  share_capital: "Share capital",
};

export const GENERATED_DOCUMENT: Readonly<Record<string, string>> = {
  loan_statement: "Statement of Account",
  share_capital_statement: "Share Capital Statement",
  share_capital_certificate: "Share Capital Certificate",
  savings_statement: "Savings Statement",
  time_deposit_certificate: "Time Deposit Certificate",
};

/** A shared file's stored type. */
export const FILE_TYPE: Readonly<Record<string, string>> = {
  pdf: "PDF",
  jpg: "JPG",
  jpeg: "JPG",
  jpe: "JPG",
  jfif: "JPG",
  png: "PNG",
  doc: "Word",
  docx: "Word",
};

/** Tailwind classes for a status pill, by tone. */
export const TONE_CLASS: Readonly<Record<Tone, string>> = {
  success: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  warning: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300",
  danger: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  info: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  muted: "bg-muted text-muted-foreground",
};
