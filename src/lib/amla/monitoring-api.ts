/**
 * The AMLA monitoring API client (Phase 6, AMLA-B3; risk rules from B4). The
 * server logs every read to the AMLA log, so screens call these through
 * `once`. Nothing here feeds Linda, notifications or the command palette.
 */

import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { only, paged } from "@/lib/amla/api";
import type { AmlaPage } from "@/types/amla";
import type {
  AmlaAlertDetail,
  AmlaAlertHistoryStep,
  AmlaAlertRow,
  AmlaCtrDetail,
  AmlaCtrRow,
  AmlaDetectionRulesVersion,
  AmlaRiskRules,
} from "@/types/amla-monitoring";

const A = API_ENDPOINTS.AMLA;

/** Dates are YYYY-MM-DD in Manila; "" means not set. `branch_id` follows the working branch (useBranchScopedFilters). */
interface ListFilters {
  from: string;
  to: string;
  search: string;
  branch_id?: number;
  page: number;
  /** Short pages for the dashboard; lists use the server's 25. */
  per_page?: number;
}

export interface AmlaAlertFilters extends ListFilters {
  status: string;
  rule: string;
  priority: string;
}

export type AmlaCtrFilters = ListFilters;

export const amlaMonitoringApi = {
  alerts: (f: AmlaAlertFilters) =>
    paged(
      api.getRaw<AmlaPage<AmlaAlertRow>>(A.ALERTS, {
        params: only({
          status: f.status,
          rule: f.rule,
          priority: f.priority,
          branch_id: f.branch_id,
          from: f.from,
          to: f.to,
          search: f.search.trim(),
          page: f.page,
          per_page: f.per_page,
        }),
      }),
    ),
  alert: (id: number) => api.get<AmlaAlertDetail>(A.ALERT(id)),
  /** The alert workflow (AMLA-B6): each step answers the alert's row. A note is sent only when there is one. */
  assignAlert: (id: number, assigneeId: number, note: string) =>
    api.post<AmlaAlertRow>(A.ALERT_ASSIGN(id), { assignee_id: assigneeId, ...(note === "" ? {} : { note }) }),
  reviewAlert: (id: number, note: string) => api.post<AmlaAlertRow>(A.ALERT_REVIEW(id), note === "" ? {} : { note }),
  closeAlert: (id: number, reason: string) => api.post<AmlaAlertRow>(A.ALERT_CLOSE(id), { reason }),
  /** Logged by the server, so it is read once per "Show history". */
  alertHistory: (id: number) => api.get<AmlaAlertHistoryStep[]>(A.ALERT_HISTORY(id)),
  ctrCandidates: (f: AmlaCtrFilters) =>
    paged(
      api.getRaw<AmlaPage<AmlaCtrRow>>(A.CTR_CANDIDATES, {
        params: only({ branch_id: f.branch_id, from: f.from, to: f.to, search: f.search.trim(), page: f.page, per_page: f.per_page }),
      }),
    ),
  ctrCandidate: (id: number) => api.get<AmlaCtrDetail>(A.CTR_CANDIDATE(id)),
  detectionRules: () => api.get<AmlaDetectionRulesVersion>(A.DETECTION_RULES),
  detectionRuleVersions: () => api.get<AmlaDetectionRulesVersion[]>(A.DETECTION_RULE_VERSIONS),
  riskRules: () => api.get<AmlaRiskRules>(A.RISK_RULES),
};
