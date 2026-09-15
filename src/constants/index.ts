export const ADJUSTMENT_TYPE_LABELS: Record<string, string> = {
  extension: "Extension",
  restructure: "Restructure",
  penalty_waiver: "Penalty Waiver",
  balance_adjustment: "Balance Adjustment",
  term_extension: "Term Extension",
};

export const ADJUSTMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  applied: "Applied",
};

export const PAST_DUE_TRANSFER_UNIT_OPTIONS = [
  { value: "days", label: "Days" },
  { value: "months", label: "Months" },
  { value: "amortization_periods", label: "Amortization Periods" },
] as const;

export const INTEREST_TYPE = {
  FIXED: "fixed",
  DIMINISHING: "diminishing",
  UPON_MATURITY: "upon_maturity",
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
  semi_monthly: "Semi-Monthly",
  monthly: "Monthly",
  upon_maturity: "Upon Maturity",
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

export const INTEREST_TYPE_OPTIONS = [
  { value: "straight", label: "Straight (Fixed)" },
  { value: "diminishing", label: "Diminishing" },
] as const;

export const PAYMENT_FREQUENCY_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "bi_weekly", label: "Bi-Weekly" },
  { value: "semi_monthly", label: "Semi-Monthly" },
  { value: "monthly", label: "Monthly" },
  // Upon Maturity = bullet / balloon: a single consolidated payment on
  // the maturity date. Valid for loan creation and amortization preview;
  // NOT valid for loan product templates — the loan products settings
  // form filters this value out before rendering the multi-select.
  { value: "upon_maturity", label: "Upon Maturity" },
] as const;
export const CIVIL_STATUS_OPTIONS = [
  { value: "single", label: "Single" },
  { value: "married", label: "Married" },
  { value: "widowed", label: "Widowed" },
  { value: "separated", label: "Separated" },
  { value: "divorced", label: "Divorced" },
] as const;

/**
 * The two values `Gender` (src/types/borrower.ts) allows, with the labels the
 * borrower forms already render.
 *
 * Added because it was the one option list this file was missing: the new,
 * edit and public-registration forms each hard-coded the same pair of radio
 * items, so there was no shared vocabulary for the CSV import to validate the
 * required Gender column against. Promoting it here rather than keeping a
 * private copy in the importer is the point — one list, one place.
 */
export const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
] as const;

export const VALID_ID_OPTIONS = [
  { value: "philippine_id", label: "Philippine National ID (PhilSys)" },
  { value: "drivers_license", label: "Driver's License" },
  { value: "passport", label: "Passport" },
  { value: "sss", label: "SSS ID" },
  { value: "umid", label: "UMID" },
  { value: "voters_id", label: "Voter's ID" },
  { value: "postal_id", label: "Postal ID" },
  { value: "prc_id", label: "PRC ID" },
  { value: "tin_id", label: "TIN ID" },
  // Catch-all — when chosen, the form reveals an extra text field for the
  // custom ID name, which is submitted alongside the id_number.
  { value: "others", label: "Others" },
] as const;

export const RELATIONSHIP_OPTIONS = [
  { value: "spouse", label: "Spouse" },
  { value: "parent", label: "Parent" },
  { value: "sibling", label: "Sibling" },
  { value: "relative", label: "Relative" },
  { value: "friend", label: "Friend" },
  { value: "colleague", label: "Colleague" },
  { value: "other", label: "Other" },
] as const;

/**
 * Dropdown affordance, NOT a contract: `borrowers.suffix` is `varchar(20)`
 * validated `nullable|string|max:20`, so any suffix a member actually uses is
 * legal. Offer these, normalise to them where they match, but never reject a
 * value for being absent from the list.
 *
 * `II` was missing until the CSV import went looking for it — as it is from the
 * client's own Data Dictionary. A good reminder that the enum lists in a spec
 * sheet are the values someone remembered, not the values that exist.
 */
export const SUFFIX_OPTIONS = [
  { value: "", label: "None" },
  { value: "Jr.", label: "Jr." },
  { value: "Sr.", label: "Sr." },
  { value: "II", label: "II" },
  { value: "III", label: "III" },
  { value: "IV", label: "IV" },
  { value: "V", label: "V" },
] as const;

export {
  LOAN_STATUS,
  LOAN_STATUS_LABELS,
  LOAN_STATUS_COLORS,
} from "./loan-status";
export { ROLES, ROLE_OPTIONS } from "./rbac";
export { BRANCHES } from "./branches";
export type { Branch } from "./branches";
export { SIDEBAR_NAV } from "./navigation";
export type { NavItem, NavSubItem } from "./navigation";
