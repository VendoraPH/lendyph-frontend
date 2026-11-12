import type { Permission } from "@/types";
import type {
  CdaAgingBucket,
  CdaAssetClass,
  CdaCooperativeCategory,
  CdaCteStatus,
  CdaDisplayStatus,
  CdaFundingSource,
  CdaMediationStatus,
  CdaOfficerPosition,
  CdaOfficerStatus,
  CdaPesosStatus,
  CdaReportPart,
  CdaReportType,
  CdaSeverity,
  CdaSex,
  CdaSocialCategory,
  CdaSocialStatus,
  CdaSubmissionMethod,
  CdaSubmissionStatus,
  CdaTemplateStatus,
  CdaTrainingStatus,
  CdaWorkflowAction,
} from "@/types/cda";

/**
 * CDA Compliance in words. Every key the server sends has its words here, and
 * a key the screen doesn't know reads "Other", never the key itself.
 */

/** A key the screen has no words for reads as this, never as the raw key. */
export const UNKNOWN_LABEL = "Other";

/** The words for `key`, a dash when there is none, or `UNKNOWN_LABEL`; never the key itself. */
export function labelOf<K extends string>(map: Record<K, string>, key: string | null | undefined): string {
  if (key === null || key === undefined || key === "") return "—";
  return Object.prototype.hasOwnProperty.call(map, key) ? map[key as K] : UNKNOWN_LABEL;
}

export interface CdaReportPage {
  /** The page's title, as the menu names it. */
  title: string;
  href: string;
  description: string;
  /** The view permission a restricted report needs on top of `cda:view`. */
  restriction: Permission | null;
}

/** Each report type's page. ATIR and ABR share one page, as do mediation's two halves. */
export const REPORT_PAGES: Record<CdaReportType, CdaReportPage> = {
  capr: {
    title: "CAPR",
    href: "/cda/capr",
    description: "Cooperative Annual Progress Report: membership, operations, governance and finances.",
    restriction: null,
  },
  financial_statements: {
    title: "Financial Statements",
    href: "/cda/financial-statements",
    description: "Audited financial statements from a closed accounting year, with the external auditor's details.",
    restriction: "cda:view_audit",
  },
  performance_audit: {
    title: "Performance Audit",
    href: "/cda/performance-audit",
    description: "Governance and management compliance, area by area, with evidence.",
    restriction: "cda:view_audit",
  },
  social_audit: {
    title: "Social Audit",
    href: "/cda/social-audit",
    description: "Community and member programs, beneficiaries and spending for the year.",
    restriction: null,
  },
  pesos: {
    title: "Enhanced PESOS",
    href: "/cda/pesos",
    description: "Performance rating by component and indicator, from the books.",
    restriction: null,
  },
  officers_trainings: {
    title: "Officers & Trainings",
    href: "/cda/officers",
    description: "Board, committees and officers, and the trainings they completed.",
    restriction: null,
  },
  mediation: {
    title: "Mediation & Conciliation",
    href: "/cda/mediation",
    description: "Disputes handled by the Mediation and Conciliation Committee, reported for each half of the year.",
    restriction: "cda:view_mediation",
  },
  sworn_statement: {
    title: "Sworn Statement",
    href: "/cda/sworn-statement",
    description: "The officers' sworn statement of compliance, signed and notarized.",
    restriction: null,
  },
  atir: {
    title: "ATIR & ABR",
    href: "/cda/tax-reports",
    description: "Annual Tax Incentives Report, for a cooperative holding a valid Certificate of Tax Exemption.",
    restriction: "cda:view_tax",
  },
  abr: {
    title: "ATIR & ABR",
    href: "/cda/tax-reports",
    description: "Annual Benefits Report, for a cooperative holding a valid Certificate of Tax Exemption.",
    restriction: "cda:view_tax",
  },
};

/** Each report type's own name, as filed with CDA. */
export const REPORT_TYPE_LABELS: Record<CdaReportType, string> = {
  capr: "Cooperative Annual Progress Report (CAPR)",
  financial_statements: "Audited Financial Statements",
  performance_audit: "Performance Audit Report",
  social_audit: "Social Audit Report",
  pesos: "Enhanced PESOS",
  officers_trainings: "List of Officers and Trainings",
  mediation: "Mediation and Conciliation Report",
  sworn_statement: "Sworn Statement of Compliance",
  atir: "Annual Tax Incentives Report (ATIR)",
  abr: "Annual Benefits Report (ABR)",
};

export const PART_LABELS: Record<CdaReportPart, string> = {
  annual: "Annual",
  h1: "First half (January–June)",
  h2: "Second half (July–December)",
};

/** "Mediation and Conciliation Report, First half (January–June)"; an annual report reads its name alone. */
export function reportName(type: CdaReportType, part: CdaReportPart | null | undefined): string {
  const name = labelOf(REPORT_TYPE_LABELS, type);
  return part && part !== "annual" ? `${name}, ${labelOf(PART_LABELS, part)}` : name;
}

export type Tone = "neutral" | "info" | "warning" | "success" | "danger";

export const TONE_CLASS: Record<Tone, string> = {
  neutral: "bg-slate-500/10 text-slate-700 border-slate-500/30 dark:text-slate-300",
  info: "bg-blue-500/10 text-blue-700 border-blue-500/30 dark:text-blue-300",
  warning: "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-300",
  success: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-300",
  danger: "bg-red-500/10 text-red-700 border-red-500/30 dark:text-red-300",
};

/** The server's statuses and display statuses, in words. */
export const STATUS_META: Record<CdaDisplayStatus, { label: string; tone: Tone }> = {
  not_applicable: { label: "Not applicable", tone: "neutral" },
  not_started: { label: "Not started", tone: "neutral" },
  draft: { label: "Draft", tone: "neutral" },
  validation_failed: { label: "Has critical issues", tone: "danger" },
  returned: { label: "Returned for changes", tone: "warning" },
  for_review: { label: "For review", tone: "info" },
  approved: { label: "Approved", tone: "info" },
  finalized: { label: "Finalized", tone: "success" },
  submitted: { label: "Filed with CDA", tone: "success" },
  accepted: { label: "Accepted by CDA", tone: "success" },
  for_correction: { label: "For correction", tone: "danger" },
};

export function statusMeta(status: string | null | undefined): { label: string; tone: Tone } {
  return status && Object.prototype.hasOwnProperty.call(STATUS_META, status)
    ? STATUS_META[status as CdaDisplayStatus]
    : { label: UNKNOWN_LABEL, tone: "neutral" };
}

export const ACTION_LABELS: Record<CdaWorkflowAction, string> = {
  refresh: "Refresh figures",
  submit_for_review: "Submit for review",
  return: "Return for changes",
  approve: "Approve",
  finalize: "Finalize",
  mark_submitted: "Record filing with CDA",
  mark_accepted: "Mark accepted by CDA",
  mark_for_correction: "Mark for correction",
  reopen: "Reopen",
  set_stage: "Change stage",
};

/** History rows carry the workflow actions plus `save` and `refresh`. */
export const HISTORY_ACTION_LABELS: Record<string, string> = {
  ...ACTION_LABELS,
  save: "Saved",
  refresh: "Refreshed figures",
  validate: "Refreshed figures",
  update: "Updated",
};

/** The actions the server asks a reason for (`ReportWorkflow::NEED_REASON`). */
export const NEEDS_REASON: ReadonlySet<CdaWorkflowAction> = new Set(["return", "mark_for_correction", "reopen"]);

export const SEVERITY_META: Record<CdaSeverity, { label: string; tone: Tone }> = {
  critical: { label: "Critical", tone: "danger" },
  warning: { label: "Warning", tone: "warning" },
  info: { label: "Info", tone: "info" },
};

export const ISSUE_CATEGORY_LABELS: Record<string, string> = {
  missing_required_data: "Missing data",
  invalid_data: "Invalid data",
  accounting_mismatch: "Accounting mismatch",
  member_data: "Member data",
  loan_data: "Loan data",
  officer_data: "Officer data",
  training: "Training",
  compliance_document: "Compliance document",
  financial_data: "Financial data",
  template_unverified: "Template not yet verified",
};

export const COMPONENT_LABELS: Record<string, string> = {
  fields: "Fields",
  sources: "Figures from the system",
  documents: "Documents",
  accounting: "Accounting",
  approvals: "Approvals",
};

/** Financial statements' and the sworn statement's stages (`ReportStages`). */
export const STAGE_LABELS: Record<string, string> = {
  draft_fs: "Draft financial statements",
  for_external_audit: "For external audit",
  audited: "Audited",
  generated: "Generated",
  for_signature: "For signature",
  signed: "Signed",
  uploaded: "Uploaded",
};

export const STAGES_BY_TYPE: Partial<Record<CdaReportType, string[]>> = {
  financial_statements: ["draft_fs", "for_external_audit", "audited"],
  sworn_statement: ["generated", "for_signature", "signed", "uploaded"],
};

export const COMPLIANCE_OPTIONS = [
  { value: "compliant", label: "Compliant" },
  { value: "partial", label: "Partly compliant" },
  { value: "non_compliant", label: "Not compliant" },
  { value: "not_applicable", label: "Not applicable" },
];

export const SUBMISSION_METHOD_LABELS: Record<CdaSubmissionMethod, string> = {
  cais: "CAIS",
  ecoophub: "e-CoopHub",
  email: "Email",
  physical: "Filed in person",
  other: "Other",
};

export const SUBMISSION_STATUS_META: Record<CdaSubmissionStatus, { label: string; tone: Tone }> = {
  submitted: { label: "Filed", tone: "info" },
  acknowledged: { label: "Acknowledged", tone: "info" },
  accepted: { label: "Accepted", tone: "success" },
  returned: { label: "Returned", tone: "warning" },
  requires_correction: { label: "Needs correction", tone: "danger" },
};

export const POSITION_LABELS: Record<CdaOfficerPosition, string> = {
  chairperson: "Chairperson",
  vice_chairperson: "Vice Chairperson",
  board_member: "Board Member",
  secretary: "Secretary",
  treasurer: "Treasurer",
  general_manager: "General Manager",
  committee_chairperson: "Committee Chairperson",
  committee_member: "Committee Member",
  manager: "Manager",
  bookkeeper: "Bookkeeper",
  other: "Other",
};

export const OFFICER_STATUS_LABELS: Record<CdaOfficerStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  resigned: "Resigned",
  removed: "Removed",
};

export const SEX_LABELS: Record<CdaSex, string> = { male: "Male", female: "Female" };

/** An officer's mandatory trainings (`TrainingCompliance`). */
export const TRAINING_COMPLIANCE_META: Record<string, { label: string; tone: Tone }> = {
  complete: { label: "Complete", tone: "success" },
  incomplete: { label: "Incomplete", tone: "warning" },
  not_required: { label: "Not required", tone: "neutral" },
};

export const TRAINING_STATUS_LABELS: Record<CdaTrainingStatus, string> = {
  completed: "Completed",
  incomplete: "Incomplete",
  scheduled: "Scheduled",
  expired: "Expired",
  not_required: "Not required",
};

export const SOCIAL_CATEGORY_LABELS: Record<CdaSocialCategory, string> = {
  member_education: "Member education",
  financial_literacy: "Financial literacy",
  education: "Education",
  health: "Health",
  environment: "Environment",
  community: "Community",
  youth: "Youth",
  livelihood: "Livelihood",
  disaster_response: "Disaster response",
  other: "Other",
};

export const FUNDING_SOURCE_LABELS: Record<CdaFundingSource, string> = {
  cdf: "Community Development Fund",
  general_fund: "General fund",
  cetf: "Cooperative Education and Training Fund",
  external: "External",
  other: "Other",
};

export const SOCIAL_STATUS_LABELS: Record<CdaSocialStatus, string> = {
  planned: "Planned",
  ongoing: "Ongoing",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const MEDIATION_STATUS_META: Record<CdaMediationStatus, { label: string; tone: Tone }> = {
  pending: { label: "Pending", tone: "neutral" },
  in_mediation: { label: "In mediation", tone: "info" },
  resolved: { label: "Resolved", tone: "success" },
  escalated: { label: "Escalated", tone: "danger" },
  withdrawn: { label: "Withdrawn", tone: "neutral" },
};

export const HALF_LABELS: Record<"h1" | "h2", string> = {
  h1: "First half",
  h2: "Second half",
};

/** The categories staff pick on an upload (proofs and exports come from the server). */
export const UPLOAD_CATEGORY_LABELS: Record<string, string> = {
  capr: "Cooperative Annual Progress Report (CAPR)",
  financial_statements: "Audited financial statements",
  audit_report: "Auditor's report",
  management_representation: "Management representation letter",
  management_responsibility: "Statement of management responsibility",
  fs_notes: "Notes to the financial statements",
  performance_audit: "Performance audit",
  social_audit: "Social audit",
  pesos: "Enhanced PESOS",
  officers_trainings: "Officers and trainings",
  mediation: "Mediation and conciliation",
  sworn_statement: "Sworn statement of compliance",
  atir: "Annual Tax Incentives Report (ATIR)",
  abr: "Annual Benefits Report (ABR)",
  tax: "Tax documents",
  minutes: "Minutes of meetings",
  cda_correspondence: "CDA Correspondence",
  certificates: "Training certificates",
  other: "Other",
};

/** Every category a document can carry, the server's two included. */
export const DOCUMENT_CATEGORY_LABELS: Record<string, string> = {
  ...UPLOAD_CATEGORY_LABELS,
  submission_proof: "Proof of submission",
  report_export: "Report export",
};

/** Restricted upload categories and the view each needs (`DocumentCategories::RESTRICTED`). */
export const CATEGORY_RESTRICTION: Record<string, Permission> = {
  financial_statements: "cda:view_audit",
  audit_report: "cda:view_audit",
  management_representation: "cda:view_audit",
  management_responsibility: "cda:view_audit",
  fs_notes: "cda:view_audit",
  performance_audit: "cda:view_audit",
  atir: "cda:view_tax",
  abr: "cda:view_tax",
  tax: "cda:view_tax",
  mediation: "cda:view_mediation",
};

export const CTE_STATUS_LABELS: Record<CdaCteStatus, string> = {
  none: "None",
  valid: "Valid",
  pending: "Application pending",
  expired: "Expired",
};

export const COOPERATIVE_CATEGORY_LABELS: Record<CdaCooperativeCategory, string> = {
  primary: "Primary",
  secondary: "Secondary",
  tertiary: "Tertiary",
  federation: "Federation",
  union: "Union",
};

export const ASSET_CLASS_LABELS: Record<CdaAssetClass, string> = {
  micro: "Micro",
  small: "Small",
  medium: "Medium",
  large: "Large",
};

export const TEMPLATE_STATUS_META: Record<CdaTemplateStatus, { label: string; tone: Tone }> = {
  draft: { label: "Draft", tone: "neutral" },
  active: { label: "Active", tone: "success" },
  retired: { label: "Retired", tone: "warning" },
};

export const AGING_BUCKET_LABELS: Record<CdaAgingBucket, string> = {
  current: "Current",
  "1_30": "1–30 days",
  "31_60": "31–60 days",
  "61_90": "61–90 days",
  "91_120": "91–120 days",
  over_120: "Over 120 days",
};

export const PESOS_STATUS_META: Record<CdaPesosStatus, { label: string; tone: Tone }> = {
  scored: { label: "Scored", tone: "success" },
  missing_data: { label: "Missing data", tone: "warning" },
  not_computable: { label: "Can't be worked out", tone: "warning" },
};

export const PESOS_DIRECTION_LABELS: Record<string, string> = {
  higher_better: "Higher is better",
  lower_better: "Lower is better",
};

/** `{ value, label }` options for a select, from a label map. */
export function toOptions<K extends string>(map: Record<K, string | { label: string }>): { value: K; label: string }[] {
  return (Object.keys(map) as K[]).map((value) => {
    const entry = map[value];
    return { value, label: typeof entry === "string" ? entry : entry.label };
  });
}

/**
 * A configured training key ("basic_coop_course") in words ("Basic coop
 * course"). The keys are set in CDA settings, so they have no fixed words.
 */
export function trainingKeyLabel(key: string): string {
  const words = key.split("_").filter(Boolean).join(" ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}
