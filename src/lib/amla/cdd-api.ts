/**
 * The AMLA customer due diligence API client (Phase 6, AMLA-B4). Every read
 * and write is logged by the server to the AMLA log. Answers stay in the
 * calling component's state: nothing here caches them or hands them to Linda,
 * notifications or the command palette.
 */

import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { only, paged } from "@/lib/amla/api";
import type { AmlaPage } from "@/types/amla";
import type { AmlaMaskedId } from "@/types/amla-screening";
import type {
  AmlaCddRow,
  AmlaCddView,
  AmlaIdVerification,
  AmlaIdVerificationBody,
  AmlaProfileBody,
  AmlaReview,
  AmlaReviewBody,
  AmlaRiskAssessment,
  AmlaRiskAssessmentBody,
  AmlaSubjectSegment,
} from "@/types/amla-cdd";

const A = API_ENDPOINTS.AMLA;

export interface AmlaCddFilters {
  /** `member`, `walk_in`, or "" for both. */
  type: string;
  status: string;
  search: string;
  branchId: number | undefined;
  page: number;
}

/** The route segment and id the server addresses a subject by. */
export interface AmlaSubjectAddress {
  segment: AmlaSubjectSegment;
  id: number;
}

export const amlaCddApi = {
  worklist: (filters: AmlaCddFilters) =>
    paged(
      api.getRaw<AmlaPage<AmlaCddRow>>(A.CDD_SUBJECTS, {
        params: only({
          type: filters.type,
          status: filters.status,
          search: filters.search.trim(),
          branch_id: filters.branchId,
          page: filters.page,
        }),
      }),
    ),
  show: (s: AmlaSubjectAddress) => api.get<AmlaCddView>(A.CDD_SUBJECT(s.segment, s.id)),
  /** Answers the whole view again, as the server does after a save. */
  update: (s: AmlaSubjectAddress, body: AmlaProfileBody) => api.put<AmlaCddView>(A.CDD_SUBJECT(s.segment, s.id), body),
  verifyId: (s: AmlaSubjectAddress, body: AmlaIdVerificationBody) =>
    api.post<AmlaIdVerification>(A.CDD_ID_VERIFICATIONS(s.segment, s.id), body),
  assess: (s: AmlaSubjectAddress, body: AmlaRiskAssessmentBody) =>
    api.post<AmlaRiskAssessment>(A.CDD_RISK_ASSESSMENTS(s.segment, s.id), body),
  review: (s: AmlaSubjectAddress, body: AmlaReviewBody) => api.post<AmlaReview>(A.CDD_REVIEWS(s.segment, s.id), body),
  /**
   * The subject's IDs on record, each once, by type and last four only (AMLA-B5,
   * `amla:cdd`, logged). The full number never reaches the browser.
   */
  validIds: (s: AmlaSubjectAddress) => api.get<AmlaMaskedId[]>(A.CDD_VALID_IDS(s.segment, s.id)),
};
