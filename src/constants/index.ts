export const LOAN_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  RELEASED: "released",
  ONGOING: "ongoing",
  COMPLETED: "completed",
  DEFAULTED: "defaulted",
  RESTRUCTURED: "restructured",
  REJECTED: "rejected",
} as const;

export const LOAN_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  released: "Released",
  ongoing: "Ongoing",
  completed: "Completed",
  defaulted: "Defaulted",
  restructured: "Restructured",
  rejected: "Rejected",
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

export const CIVIL_STATUS_OPTIONS = [
  { value: "single", label: "Single" },
  { value: "married", label: "Married" },
  { value: "widowed", label: "Widowed" },
  { value: "separated", label: "Separated" },
  { value: "divorced", label: "Divorced" },
] as const;

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

export const EMPLOYMENT_TYPE_OPTIONS = [
  { value: "employed", label: "Employed" },
  { value: "self_employed", label: "Self-Employed / Business Owner" },
  { value: "ofw", label: "OFW" },
  { value: "unemployed", label: "Unemployed" },
  { value: "retired", label: "Retired" },
] as const;

export const SUFFIX_OPTIONS = [
  { value: "", label: "None" },
  { value: "Jr.", label: "Jr." },
  { value: "Sr.", label: "Sr." },
  { value: "III", label: "III" },
  { value: "IV", label: "IV" },
  { value: "V", label: "V" },
] as const;

export const PHILIPPINE_PROVINCES = [
  "Metro Manila",
  "Cebu",
  "Davao del Sur",
  "Bulacan",
  "Pampanga",
  "Laguna",
  "Cavite",
  "Rizal",
  "Batangas",
  "Pangasinan",
  "Iloilo",
  "Negros Occidental",
  "Zamboanga del Sur",
  "Leyte",
  "Bukidnon",
] as const;

export { ROLES, ROLE_OPTIONS } from "./rbac";
export { BRANCHES } from "./branches";
export type { Branch } from "./branches";
export { SIDEBAR_NAV } from "./navigation";
export type { NavItem } from "./navigation";
