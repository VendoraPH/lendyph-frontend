/**
 * Credit Scoring API client.
 *
 * NONE of these endpoints exist yet — see the note on
 * `API_ENDPOINTS.CREDIT_SCORING`. Typed and wired now so the day the backend
 * lands, the only thing that changes is the paths file.
 *
 * Deliberately NO fixtures. A score screen that shows an invented number is
 * the one kind of wrong this module cannot afford — someone will act on it.
 */

import { api } from "@/lib/api-client";
import { MAX_PER_PAGE } from "@/lib/paginate";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import type {
  BorrowerScoreFilters,
  BorrowerScoreRow,
  CreateCreditDecisionData,
  CreditDecision,
  CreditScore,
  CreditScoreHistoryEntry,
  CreditScoringDashboardSummary,
  CreditScoringSettings,
  PolicyFlag,
  RiskMonitoringData,
  ScoreHistoryFilters,
  ScorecardConfig,
} from "@/types/credit-scoring";

/**
 * Unwrap `{ data: [...] }` or a bare array — the API does both.
 *
 * Throws rather than returning `[]` on an unrecognised shape. This is a risk
 * module: "this borrower has no policy flags" and "we could not parse the
 * response" must not render as the same empty table. Returning `[]` made a
 * parse failure indistinguishable from a clean bill of health, which is the
 * worse of the two to get wrong.
 */
function unwrapList<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[];
  if (res && typeof res === "object" && Array.isArray((res as { data?: T[] }).data)) {
    return (res as { data: T[] }).data;
  }
  throw new Error("Unexpected list response shape from the credit-scoring API.");
}

export const creditScoringService = {
  getDashboardSummary: (): Promise<CreditScoringDashboardSummary> =>
    api.get<CreditScoringDashboardSummary>(API_ENDPOINTS.CREDIT_SCORING.DASHBOARD),

  // `per_page` is sent explicitly and first, so a caller's own filters can still
  // override it. Without it these take the endpoint's DEFAULT page — 15 rows on
  // every other list in this API — and the screen presents that as the whole
  // portfolio. Six screens in this repo have already shipped truncated data that
  // way. MAX_PER_PAGE is the ceiling the backend clamps to anyway; if these
  // endpoints ever exceed it, they need the fetchAllPages() drain, not a bigger
  // number (see borrowerService.listAll).
  listBorrowerScores: async (filters: BorrowerScoreFilters = {}): Promise<BorrowerScoreRow[]> =>
    unwrapList<BorrowerScoreRow>(
      await api.get(API_ENDPOINTS.CREDIT_SCORING.BORROWERS_LIST, {
        params: { per_page: MAX_PER_PAGE, ...filters },
      }),
    ),

  getBorrowerCreditProfile: (borrowerId: number): Promise<CreditScore> =>
    api.get<CreditScore>(API_ENDPOINTS.CREDIT_SCORING.BORROWER_PROFILE(borrowerId)),

  getBorrowerScoreHistory: async (borrowerId: number): Promise<CreditScoreHistoryEntry[]> =>
    unwrapList<CreditScoreHistoryEntry>(
      await api.get(API_ENDPOINTS.CREDIT_SCORING.BORROWER_HISTORY(borrowerId)),
    ),

  getScoreHistory: async (filters: ScoreHistoryFilters = {}): Promise<CreditScoreHistoryEntry[]> =>
    unwrapList<CreditScoreHistoryEntry>(
      await api.get(API_ENDPOINTS.CREDIT_SCORING.SCORE_HISTORY, {
        params: { per_page: MAX_PER_PAGE, ...filters },
      }),
    ),

  getRiskMonitoring: (): Promise<RiskMonitoringData> =>
    api.get<RiskMonitoringData>(API_ENDPOINTS.CREDIT_SCORING.RISK_MONITORING),

  getScorecardConfig: (): Promise<ScorecardConfig> =>
    api.get<ScorecardConfig>(API_ENDPOINTS.CREDIT_SCORING.SCORECARD_CONFIG),

  updateScorecardConfig: (config: ScorecardConfig): Promise<ScorecardConfig> =>
    api.put<ScorecardConfig>(API_ENDPOINTS.CREDIT_SCORING.SCORECARD_CONFIG, config),

  listPolicyFlags: async (borrowerId: number): Promise<PolicyFlag[]> =>
    unwrapList<PolicyFlag>(
      await api.get(API_ENDPOINTS.CREDIT_SCORING.POLICY_FLAGS(borrowerId)),
    ),

  createCreditDecision: (data: CreateCreditDecisionData): Promise<CreditDecision> =>
    api.post<CreditDecision>(API_ENDPOINTS.CREDIT_SCORING.DECISIONS_CREATE, data),

  getSettings: (): Promise<CreditScoringSettings> =>
    api.get<CreditScoringSettings>(API_ENDPOINTS.CREDIT_SCORING.SETTINGS),

  updateSettings: (data: Partial<CreditScoringSettings>): Promise<CreditScoringSettings> =>
    api.put<CreditScoringSettings>(API_ENDPOINTS.CREDIT_SCORING.SETTINGS, data),
};
