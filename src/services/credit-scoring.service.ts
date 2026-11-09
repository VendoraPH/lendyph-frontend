/**
 * Credit Scoring API client (backend PR #240; contract in
 * docs/CREDIT_SCORING_BACKEND_HANDOFF.md).
 *
 * Deliberately NO fixtures. A score screen that shows an invented number is
 * the one kind of wrong this module cannot afford: someone will act on it.
 */

import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import type {
  BorrowerScoreFilters,
  BorrowerScoreRow,
  CreateCreditDecisionData,
  CreditDecision,
  CreditDecisionPage,
  CreditScore,
  CreditScoreHistoryEntry,
  CreditScoringDashboardSummary,
  CreditScoringPage,
  CreditScoringSettings,
  LoanCreditAssessment,
  PageParams,
  PolicyFlag,
  PolicyFlagList,
  RiskMonitoringData,
  SaveLoanAssessmentData,
  ScoreHistoryFilters,
  ScorecardConfig,
  UpdateCreditScoringSettingsData,
  UpdateScorecardConfigData,
} from "@/types/credit-scoring";

/** The server's own default page size, sent explicitly so the screens agree with it. */
export const CREDIT_SCORING_PER_PAGE = 25;

const SHAPE_ERROR = "Unexpected list response shape from the credit-scoring API.";

/**
 * Unwrap `{ data: [...] }` or a bare array.
 *
 * Throws rather than returning `[]` on an unrecognised shape. This is a risk
 * module: "this member has no policy flags" and "we could not parse the
 * response" must not render as the same empty table.
 */
function unwrapList<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[];
  if (res && typeof res === "object" && Array.isArray((res as { data?: T[] }).data)) {
    return (res as { data: T[] }).data;
  }
  throw new Error(SHAPE_ERROR);
}

/**
 * One page of a flat Laravel paginator. A shape without the rows or the
 * paging figures throws, so a parse failure never reads as an empty list.
 */
function unwrapPage<T>(res: unknown): CreditScoringPage<T> {
  const page = res as Partial<CreditScoringPage<T>> | null;
  const isCount = (v: unknown) => typeof v === "number" && Number.isInteger(v) && v >= 0;
  if (
    !page ||
    typeof page !== "object" ||
    !Array.isArray(page.data) ||
    !isCount(page.total) ||
    !isCount(page.current_page) ||
    !isCount(page.last_page) ||
    !isCount(page.per_page)
  ) {
    throw new Error(SHAPE_ERROR);
  }
  return {
    data: page.data,
    current_page: page.current_page!,
    last_page: page.last_page!,
    per_page: page.per_page!,
    total: page.total!,
  };
}

function pageParams({ page = 1, per_page = CREDIT_SCORING_PER_PAGE }: PageParams) {
  return { page, per_page };
}

export const creditScoringService = {
  getDashboardSummary: (): Promise<CreditScoringDashboardSummary> =>
    api.get<CreditScoringDashboardSummary>(API_ENDPOINTS.CREDIT_SCORING.DASHBOARD),

  listBorrowerScores: async (
    filters: BorrowerScoreFilters = {},
    paging: PageParams = {},
  ): Promise<CreditScoringPage<BorrowerScoreRow>> =>
    unwrapPage<BorrowerScoreRow>(
      await api.get(API_ENDPOINTS.CREDIT_SCORING.BORROWERS_LIST, {
        params: { ...filters, ...pageParams(paging) },
      }),
    ),

  getBorrowerCreditProfile: (borrowerId: number): Promise<CreditScore> =>
    api.get<CreditScore>(API_ENDPOINTS.CREDIT_SCORING.BORROWER_PROFILE(borrowerId)),

  getBorrowerScoreHistory: async (
    borrowerId: number,
    paging: PageParams = {},
  ): Promise<CreditScoringPage<CreditScoreHistoryEntry>> =>
    unwrapPage<CreditScoreHistoryEntry>(
      await api.get(API_ENDPOINTS.CREDIT_SCORING.BORROWER_HISTORY(borrowerId), {
        params: pageParams(paging),
      }),
    ),

  getScoreHistory: async (
    filters: ScoreHistoryFilters = {},
    paging: PageParams = {},
  ): Promise<CreditScoringPage<CreditScoreHistoryEntry>> =>
    unwrapPage<CreditScoreHistoryEntry>(
      await api.get(API_ENDPOINTS.CREDIT_SCORING.SCORE_HISTORY, {
        params: { ...filters, ...pageParams(paging) },
      }),
    ),

  getRiskMonitoring: (): Promise<RiskMonitoringData> =>
    api.get<RiskMonitoringData>(API_ENDPOINTS.CREDIT_SCORING.RISK_MONITORING),

  getScorecardConfig: (): Promise<ScorecardConfig> =>
    api.get<ScorecardConfig>(API_ENDPOINTS.CREDIT_SCORING.SCORECARD_CONFIG),

  updateScorecardConfig: (data: UpdateScorecardConfigData): Promise<ScorecardConfig> =>
    api.put<ScorecardConfig>(API_ENDPOINTS.CREDIT_SCORING.SCORECARD_CONFIG, data),

  /**
   * `{ data, details_hidden }`; a bare list (an older API) reads as not
   * hidden. An unrecognised shape throws, as every list does.
   */
  listBorrowerDecisions: async (borrowerId: number, paging: PageParams = {}): Promise<CreditDecisionPage> => {
    const res = await api.get(API_ENDPOINTS.CREDIT_SCORING.BORROWER_DECISIONS(borrowerId), {
      params: pageParams(paging),
    });
    const hidden = (res as { details_hidden?: unknown } | null)?.details_hidden === true;
    return { ...unwrapPage<CreditDecision>(res), details_hidden: hidden };
  },

  listPolicyFlags: async (borrowerId: number): Promise<PolicyFlagList> => {
    const res = await api.get(API_ENDPOINTS.CREDIT_SCORING.POLICY_FLAGS(borrowerId));
    const hidden = !Array.isArray(res) && (res as { details_hidden?: unknown } | null)?.details_hidden === true;
    return { data: unwrapList<PolicyFlag>(res), details_hidden: hidden };
  },

  createCreditDecision: (data: CreateCreditDecisionData): Promise<CreditDecision> =>
    api.post<CreditDecision>(API_ENDPOINTS.CREDIT_SCORING.DECISIONS_CREATE, data),

  getSettings: (): Promise<CreditScoringSettings> =>
    api.get<CreditScoringSettings>(API_ENDPOINTS.CREDIT_SCORING.SETTINGS),

  /**
   * Only the notice and the six figures go on the wire. `score_model_version`
   * is read only (the server answers 422 to a body carrying it) and the
   * definition lists are the server's, so neither is ever sent, whatever the
   * caller passes.
   */
  updateSettings: (data: UpdateCreditScoringSettingsData): Promise<CreditScoringSettings> => {
    const body: UpdateCreditScoringSettingsData = {};
    for (const key of SETTINGS_FIELDS) {
      if (data[key] !== undefined) body[key] = data[key];
    }
    return api.put<CreditScoringSettings>(API_ENDPOINTS.CREDIT_SCORING.SETTINGS, body);
  },

  getLoanAssessment: (loanId: number): Promise<LoanCreditAssessment> =>
    api.get<LoanCreditAssessment>(API_ENDPOINTS.CREDIT_SCORING.LOAN_ASSESSMENT(loanId)),

  saveLoanAssessment: (loanId: number, data: SaveLoanAssessmentData): Promise<LoanCreditAssessment> =>
    api.put<LoanCreditAssessment>(API_ENDPOINTS.CREDIT_SCORING.LOAN_ASSESSMENT(loanId), data),
};

const SETTINGS_FIELDS = [
  "privacy_notice",
  "dsr_manageable_max",
  "dsr_caution_max",
  "capacity_share",
  "max_active_loans",
  "hard_past_due_days",
  "decline_alert_points",
] as const satisfies readonly (keyof UpdateCreditScoringSettingsData)[];
