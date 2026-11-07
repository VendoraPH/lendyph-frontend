import type { DeadlineState } from "./deadline";
import type {
  CdaDocumentCategory,
  CdaMediationStatus,
  CdaReportStatus,
  CdaReportType,
  CdaSeverity,
  CdaSocialCategory,
  CdaSubmissionMethod,
  CdaSubmissionStatus,
} from "@/types/cda";

export interface CdaReportMeta {
  title: string;
  href: string;
  description: string;
}

export const REPORT_META: Record<CdaReportType, CdaReportMeta> = {
  capr: {
    title: "CAPR",
    href: "/cda/capr",
    description: "Cooperative Annual Progress Report: membership, operations, governance and finances.",
  },
  financial_statements: {
    title: "Financial Statements",
    href: "/cda/financial-statements",
    description: "Audited statements from a closed accounting period, with the external auditor's details.",
  },
  performance_audit: {
    title: "Performance Audit",
    href: "/cda/performance-audit",
    description: "Governance and management compliance, area by area, with evidence.",
  },
  social_audit: {
    title: "Social Audit",
    href: "/cda/social-audit",
    description: "Community and member programs, beneficiaries and spending for the year.",
  },
  pesos: {
    title: "Enhanced PESOS",
    href: "/cda/pesos",
    description: "Performance rating from portfolio, efficiency, solvency and other components.",
  },
  officers: {
    title: "Officers & Trainings",
    href: "/cda/officers",
    description: "Board, committees and officers, and the mandatory trainings they completed.",
  },
  mediation: {
    title: "Mediation & Conciliation",
    href: "/cda/mediation",
    description: "Disputes handled by the Mediation and Conciliation Committee, per semester.",
  },
  sworn_statement: {
    title: "Sworn Statement",
    href: "/cda/sworn-statement",
    description: "The officers' sworn statement on the truth of the reports, signed and notarized.",
  },
  atir_abr: {
    title: "ATIR & ABR",
    href: "/cda/tax-reports",
    description: "Annual Tax Incentives Report and Annual BIR Report, for cooperatives with a CTE.",
  },
};

export const REPORT_TYPES = Object.keys(REPORT_META) as CdaReportType[];

/** `{ value, label }` options for picking a report. */
export const REPORT_OPTIONS = REPORT_TYPES.map((value) => ({ value, label: REPORT_META[value].title }));

export type Tone = "neutral" | "info" | "warning" | "success" | "danger";

export const TONE_CLASS: Record<Tone, string> = {
  neutral: "bg-slate-500/10 text-slate-700 border-slate-500/30 dark:text-slate-300",
  info: "bg-blue-500/10 text-blue-700 border-blue-500/30 dark:text-blue-300",
  warning: "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-300",
  success: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-300",
  danger: "bg-red-500/10 text-red-700 border-red-500/30 dark:text-red-300",
};

export const STATUS_META: Record<CdaReportStatus, { label: string; tone: Tone }> = {
  not_started: { label: "Not started", tone: "neutral" },
  draft: { label: "Draft", tone: "neutral" },
  validation_failed: { label: "Validation failed", tone: "danger" },
  for_review: { label: "For review", tone: "info" },
  returned: { label: "Returned", tone: "warning" },
  approved: { label: "Approved", tone: "info" },
  finalized: { label: "Finalized", tone: "success" },
  submitted: { label: "Submitted", tone: "success" },
  accepted: { label: "Accepted", tone: "success" },
  correction_required: { label: "Correction required", tone: "danger" },
};

export const SEVERITY_META: Record<CdaSeverity, { label: string; tone: Tone }> = {
  critical: { label: "Critical", tone: "danger" },
  warning: { label: "Warning", tone: "warning" },
  info: { label: "Info", tone: "info" },
};

export const MEDIATION_STATUS: Record<CdaMediationStatus, { label: string; tone: Tone }> = {
  pending: { label: "Pending", tone: "neutral" },
  in_mediation: { label: "In mediation", tone: "info" },
  resolved: { label: "Resolved", tone: "success" },
  escalated: { label: "Escalated", tone: "danger" },
  withdrawn: { label: "Withdrawn", tone: "neutral" },
};

export const SUBMISSION_STATUS: Record<CdaSubmissionStatus, { label: string; tone: Tone }> = {
  prepared: { label: "Prepared", tone: "neutral" },
  submitted: { label: "Submitted", tone: "info" },
  acknowledged: { label: "Acknowledged", tone: "info" },
  accepted: { label: "Accepted", tone: "success" },
  returned: { label: "Returned", tone: "warning" },
  requires_correction: { label: "Requires correction", tone: "danger" },
};

export const SUBMISSION_METHOD: Record<CdaSubmissionMethod, string> = {
  cais: "CAIS",
  ecoophub: "E-CoopHub",
  email: "Email",
  physical: "Physical filing",
  other: "Other",
};

export const SOCIAL_CATEGORY: Record<CdaSocialCategory, string> = {
  education: "Education & training",
  health: "Health & wellness",
  environment: "Environment",
  community: "Community development",
  youth: "Youth",
  livelihood: "Livelihood",
  disaster_response: "Disaster response",
  other: "Other",
};

export const DOCUMENT_CATEGORY: Record<CdaDocumentCategory, string> = {
  capr: "CAPR",
  financial_statements: "Financial statements",
  audit_report: "External audit report",
  performance_audit: "Performance audit",
  social_audit: "Social audit",
  sworn_statement: "Sworn statement",
  tax: "Tax (ATIR / ABR)",
  minutes: "Minutes & resolutions",
  certificates: "Certificates",
  other: "Other",
};

/** `{ value, label }` options for a select, from a label map. */
export function toOptions<K extends string>(
  map: Record<K, string | { label: string }>,
): { value: K; label: string }[] {
  return (Object.keys(map) as K[]).map((value) => {
    const entry = map[value];
    return { value, label: typeof entry === "string" ? entry : entry.label };
  });
}

export const DEADLINE_TONE: Record<DeadlineState, Tone> = {
  done: "success",
  upcoming: "neutral",
  due_soon: "warning",
  due_today: "danger",
  overdue: "danger",
};
