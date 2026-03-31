export const LOAN_STATUS = {
  DRAFT: "draft",
  FOR_REVIEW: "for_review",
  APPROVED: "approved",
  REJECTED: "rejected",
  RELEASED: "released",
  ONGOING: "ongoing",
  COMPLETED: "completed",
  DEFAULTED: "defaulted",
  RESTRUCTURED: "restructured",
  CLOSED: "closed",
} as const;

export const LOAN_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  for_review: "For Review",
  approved: "Approved",
  rejected: "Rejected",
  released: "Released",
  ongoing: "Ongoing",
  completed: "Completed",
  defaulted: "Defaulted",
  restructured: "Restructured",
  closed: "Closed",
};

export const INTEREST_TYPE = {
  FIXED: "fixed",
  DIMINISHING: "diminishing",
} as const;

export const PAYMENT_FREQUENCY = {
  DAILY: "daily",
  WEEKLY: "weekly",
  BI_WEEKLY: "bi_weekly",
  MONTHLY: "monthly",
} as const;

export const PAYMENT_FREQUENCY_LABELS: Record<string, string> = {
  daily: "Daily",
  weekly: "Weekly",
  bi_weekly: "Bi-Weekly",
  monthly: "Monthly",
};

export const PAYMENT_METHOD = {
  CASH: "cash",
  BANK_TRANSFER: "bank_transfer",
  GCASH: "gcash",
  MAYA: "maya",
  ONLINE: "online",
} as const;

export const BORROWER_STATUS = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  BLACKLISTED: "blacklisted",
} as const;

export const COLLECTION_STATUS = {
  DUE_TODAY: "due_today",
  UPCOMING: "upcoming",
  OVERDUE: "overdue",
  COLLECTED: "collected",
} as const;

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_PER_PAGE: 10,
} as const;

export { ROLES, ROLE_OPTIONS } from "./rbac";
export { BRANCHES } from "./branches";
export type { Branch } from "./branches";
export { SIDEBAR_NAV } from "./navigation";
export type { NavItem, NavSubItem } from "./navigation";
export const INTEREST_TYPE_OPTIONS = [
  { value: "fixed", label: "Fixed" },
  { value: "diminishing", label: "Diminishing" },
] as const;

export const PAYMENT_FREQUENCY_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "bi_weekly", label: "Bi-Weekly" },
  { value: "monthly", label: "Monthly" },
] as const;
