import { factorDraftFrom, type FactorDraft } from "./factor-ranges";
import type {
  RiskLevel,
  ScorecardConfig,
  ScorecardFactorRule,
  ScorecardFactorRuleBody,
  UpdateScorecardConfigData,
} from "@/types/credit-scoring";

/** The editable parts of the scorecard, held as the text the user typed. */
export interface ScorecardDraft {
  weights: Record<string, string>;
  bands: Partial<Record<RiskLevel, string>>;
  /** Each factor's ranges, by factor id. */
  factors: Record<number, FactorDraft>;
}

export function scorecardDraftFrom(config: ScorecardConfig): ScorecardDraft {
  return {
    weights: Object.fromEntries(config.categories.map((c) => [c.key, String(c.weight_percent)])),
    bands: Object.fromEntries(config.risk_bands.map((b) => [b.key, String(b.min_score)])),
    factors: Object.fromEntries(config.factor_rules.map((f) => [f.id, factorDraftFrom(f)])),
  };
}

const WHOLE_NUMBER = /^\d+$/;

/** A whole number goes as one; anything else goes as typed for the server to refuse with its own message. */
function wholeOrTyped(typed: string): number | string {
  const value = typed.trim();
  return WHOLE_NUMBER.test(value) ? Number(value) : value;
}

/**
 * A factor for the PUT: its fixed fields as the server sent them, and its
 * ranges as typed. Thresholds go as text, so the server checks the decimals
 * and the order. `unit` is the server's words and is never sent.
 */
function factorBody(rule: ScorecardFactorRule, draft: FactorDraft): ScorecardFactorRuleBody {
  return {
    id: rule.id,
    category_key: rule.category_key,
    label: rule.label,
    points: rule.points,
    is_active: rule.is_active,
    rule: rule.rule,
    bands: draft.bands.map((b) => ({ threshold: b.threshold.trim(), points: wholeOrTyped(b.points) })),
    otherwise: wholeOrTyped(draft.otherwise),
    ...(rule.default_points === undefined || draft.default_points === undefined
      ? {}
      : { default_points: wholeOrTyped(draft.default_points) }),
  };
}

/**
 * The whole config for the PUT. Weights go exactly as typed (the server checks
 * the decimals and the 100.00 total, so no browser gate stands in front of it);
 * band minimums and range points that are whole numbers go as numbers, and
 * anything else goes as typed for the server to refuse with its own message.
 * Policy rules go back as the server sent them.
 */
export function scorecardBody(config: ScorecardConfig, draft: ScorecardDraft): UpdateScorecardConfigData {
  return {
    categories: config.categories.map((c) => ({
      key: c.key,
      weight_percent: (draft.weights[c.key] ?? String(c.weight_percent)).trim(),
    })),
    factor_rules: config.factor_rules.map((f) => factorBody(f, draft.factors[f.id] ?? factorDraftFrom(f))),
    policy_rules: config.policy_rules,
    risk_bands: config.risk_bands.map((b) => {
      const typed = draft.bands[b.key] ?? String(b.min_score);
      return { key: b.key, min_score: wholeOrTyped(typed) };
    }),
  };
}
