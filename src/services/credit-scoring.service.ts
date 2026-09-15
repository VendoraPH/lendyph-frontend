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

/** Unwrap `{ data: [...] }` or a bare array — the API does both. */
function unwrapList<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[];
  if (res && typeof res === "object" && Array.isArray((res as { data?: T[] }).data)) {
    return (res as { data: T[] }).data;
  }
  return [];
}

export const creditScoringService = {
  getDashboardSummary: (): Promise<CreditScoringDashboardSummary> =>
    api.get<CreditScoringDashboardSummary>(API_ENDPOINTS.CREDIT_SCORING.DASHBOARD),

  listBorrowerScores: async (filters: BorrowerScoreFilters = {}): Promise<BorrowerScoreRow[]> =>
    unwrapList<BorrowerScoreRow>(
      await api.get(API_ENDPOINTS.CREDIT_SCORING.BORROWERS_LIST, { params: filters }),
    ),

  getBorrowerCreditProfile: (borrowerId: number): Promise<CreditScore> =>
    api.get<CreditScore>(API_ENDPOINTS.CREDIT_SCORING.BORROWER_PROFILE(borrowerId)),

  getBorrowerScoreHistory: async (borrowerId: number): Promise<CreditScoreHistoryEntry[]> =>
    unwrapList<CreditScoreHistoryEntry>(
      await api.get(API_ENDPOINTS.CREDIT_SCORING.BORROWER_HISTORY(borrowerId)),
    ),

  getScoreHistory: async (filters: ScoreHistoryFilters = {}): Promise<CreditScoreHistoryEntry[]> =>
    unwrapList<CreditScoreHistoryEntry>(
      await api.get(API_ENDPOINTS.CREDIT_SCORING.SCORE_HISTORY, { params: filters }),
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
