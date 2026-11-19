import type { Permission } from "@/types";
import type { AmlaCaseDetail, AmlaFilingStepStatus, AmlaReportDetail } from "@/types/amla-cases";

/**
 * Who sees and does what with AMLA cases and filings, decided as
 * lendyph-backend's case and filing routes decide it (Phase 6, AMLA-B6). Every
 * /amla page also needs `amla:view` (amla/layout.tsx). The screens only hide
 * what the server would refuse; a 403 or 409 from it still wins, in its words.
 */

type Can = (permission: Permission) => boolean;

const VIEW_ALL: Permission = "branches:view_all";

/** `Filings::CTR_READ`: the keys that read CTRs, in the caller's branches. */
export const AMLA_CTR_READ: readonly Permission[] = ["amla:ctr", "amla:approve", "amla:submit", "amla:export"];
/** `Filings::STR_READ`: the keys that read STRs, with every branch. */
export const AMLA_STR_READ: readonly Permission[] = ["amla:str", "amla:approve", "amla:submit", "amla:export"];
/** `AmlaFilingController::READ`: any reporting key opens the reports list and the deadlines. */
export const AMLA_REPORT_READ: readonly Permission[] = ["amla:ctr", "amla:str", "amla:approve", "amla:submit", "amla:export"];

export interface AmlaCaseAccess {
  /** Compliance Cases: `amla:cases` with every branch. */
  cases: boolean;
  /** Suspicious Transactions (STR): an STR reading key with every branch. */
  strFilings: boolean;
  /** Covered Transactions (CTR): a CTR reading key. */
  ctrFilings: boolean;
  /** Regulatory Submissions: any reporting key. */
  submissions: boolean;
  /** Audit & Compliance History: `amla:audit` with every branch. */
  history: boolean;
  /** Opening a case from an alert: `amla:alerts` and `amla:cases`, with every branch. */
  escalate: boolean;
  /** Preparing a CTR from a candidate: `amla:ctr`. */
  prepareCtr: boolean;
}

export function amlaCaseAccess(can: Can): AmlaCaseAccess {
  const view = can("amla:view");
  const headOffice = view && can(VIEW_ALL);
  const cases = headOffice && can("amla:cases");
  return {
    cases,
    strFilings: headOffice && AMLA_STR_READ.some(can),
    ctrFilings: view && AMLA_CTR_READ.some(can),
    submissions: view && AMLA_REPORT_READ.some(can),
    history: headOffice && can("amla:audit"),
    escalate: cases && can("amla:alerts"),
    prepareCtr: view && can("amla:ctr"),
  };
}

/** `AmlaReport::STATUS_WORDS['returned']`: a case's reports carry only their words. */
const RETURNED_WORDS = "Returned to the preparer";

const ACTIVE_CASE = ["open", "investigating"];

export interface AmlaCaseActions {
  assignToMe: boolean;
  note: boolean;
  evidence: boolean;
  /** Recording the authorized decision (`amla:approve`). */
  decide: boolean;
  /** "No STR" closes the case: never by its opener or assignee. */
  decideNoStr: boolean;
  /** Preparing the STR (`amla:str`) once suspicion is established and no STR stands. */
  prepareStr: boolean;
}

export function amlaCaseActions(record: AmlaCaseDetail, userId: number | null, can: Can): AmlaCaseActions {
  const cases = amlaCaseAccess(can).cases;
  const active = cases && ACTIVE_CASE.includes(record.status);
  const decide = active && can("amla:approve");
  const own = userId !== null && [record.opened_by?.id, record.assigned_to?.id].includes(userId);
  return {
    assignToMe: active && userId !== null && record.assigned_to?.id !== userId,
    note: active,
    evidence: active,
    decide,
    decideNoStr: decide && userId !== null && !own,
    prepareStr:
      cases && can("amla:str") && record.status === "str_required" && record.reports.every((r) => r.status_words === RETURNED_WORDS),
  };
}

/** `AmlaReport::NEXT`, without approve and return (those are the approver's own steps). */
const FILING_STEPS: Readonly<Record<string, readonly AmlaFilingStepStatus[]>> = {
  approved: ["submitted"],
  submitted: ["accepted", "rejected", "correction_required"],
  rejected: ["submitted"],
  correction_required: ["submitted"],
};

export interface AmlaReportActions {
  approve: boolean;
  return: boolean;
  /** The filing steps that can be recorded next, in the server's order. */
  record: AmlaFilingStepStatus[];
  export: boolean;
  narrative: boolean;
}

/**
 * The preparer never approves or returns their own report, super_admin
 * included, as the server refuses it. An STR's steps need every branch; a CTR
 * the caller can see is in their branches already.
 */
export function amlaReportActions(report: AmlaReportDetail, userId: number | null, can: Can): AmlaReportActions {
  const scope = report.type === "ctr" || can(VIEW_ALL);
  const notPreparer = userId !== null && report.prepared_by?.id !== userId;
  const approve = scope && can("amla:approve") && report.status === "pending_approval" && notPreparer;
  return {
    approve,
    return: approve,
    record: scope && can("amla:submit") ? [...(FILING_STEPS[report.status] ?? [])] : [],
    export: scope && can("amla:export"),
    narrative: report.type === "str" && can(VIEW_ALL) && AMLA_STR_READ.some(can),
  };
}
