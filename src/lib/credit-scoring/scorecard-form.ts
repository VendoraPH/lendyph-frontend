import type { RiskLevel, ScorecardConfig, UpdateScorecardConfigData } from "@/types/credit-scoring";

/** The editable parts of the scorecard, held as the text the user typed. */
export interface ScorecardDraft {
  weights: Record<string, string>;
  bands: Partial<Record<RiskLevel, string>>;
}

export function scorecardDraftFrom(config: ScorecardConfig): ScorecardDraft {
  return {
    weights: Object.fromEntries(config.categories.map((c) => [c.key, String(c.weight_percent)])),
    bands: Object.fromEntries(config.risk_bands.map((b) => [b.key, String(b.min_score)])),
  };
}

const WHOLE_NUMBER = /^\d+$/;

/**
 * The whole config for the PUT. Weights go exactly as typed (the server checks
 * the decimals and the 100.00 total, so no browser gate stands in front of it);
 * a band minimum that is a whole number goes as one, and anything else goes as
 * typed for the server to refuse with its own message. The rules go back as
 * the server sent them.
 */
export function scorecardBody(config: ScorecardConfig, draft: ScorecardDraft): UpdateScorecardConfigData {
  return {
    categories: config.categories.map((c) => ({
      key: c.key,
      weight_percent: (draft.weights[c.key] ?? String(c.weight_percent)).trim(),
    })),
    factor_rules: config.factor_rules,
    policy_rules: config.policy_rules,
    risk_bands: config.risk_bands.map((b) => {
      const typed = (draft.bands[b.key] ?? String(b.min_score)).trim();
      return { key: b.key, min_score: WHOLE_NUMBER.test(typed) ? Number(typed) : typed };
    }),
  };
}
