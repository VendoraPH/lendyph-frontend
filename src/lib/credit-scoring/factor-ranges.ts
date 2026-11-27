import { validationErrors } from "./field-errors";
import type { FactorRule, ScorecardFactorRule } from "@/types/credit-scoring";

/** The server's limit on a factor's ranges (UpdateScorecardConfigRequest::MAX_BANDS). */
export const MAX_FACTOR_BANDS = 10;

export interface FactorBandDraft {
  threshold: string;
  points: string;
}

/** A factor's ranges as the user typed them. */
export interface FactorDraft {
  bands: FactorBandDraft[];
  otherwise: string;
  /** Only on a factor that has default points. */
  default_points?: string;
}

export function factorDraftFrom(rule: ScorecardFactorRule): FactorDraft {
  return {
    bands: rule.bands.map((b) => ({ threshold: String(b.threshold), points: String(b.points) })),
    otherwise: String(rule.otherwise),
    ...(rule.default_points === undefined ? {} : { default_points: String(rule.default_points) }),
  };
}

/** A blank range at the end, up to the server's limit. */
export function withBandAdded(draft: FactorDraft): FactorDraft {
  if (draft.bands.length >= MAX_FACTOR_BANDS) return draft;
  return { ...draft, bands: [...draft.bands, { threshold: "", points: "" }] };
}

/** The range at `index` taken out; a factor keeps at least one. */
export function withBandRemoved(draft: FactorDraft, index: number): FactorDraft {
  if (draft.bands.length <= 1) return draft;
  return { ...draft, bands: draft.bands.filter((_, i) => i !== index) };
}

export function withBandChanged(
  draft: FactorDraft,
  index: number,
  field: keyof FactorBandDraft,
  value: string,
): FactorDraft {
  return { ...draft, bands: draft.bands.map((b, i) => (i === index ? { ...b, [field]: value } : b)) };
}

/** How the server reads a factor's ranges, in words. */
export function ruleOrderNote(rule: FactorRule): string {
  return rule === "at_least"
    ? "List thresholds from the highest first. The first range the value reaches gives its points."
    : "List thresholds from the lowest first. The first range the value doesn't exceed gives its points.";
}

export interface FactorRangeErrors {
  /** Messages about the factor list as a whole. */
  general: string[];
  /** Messages for each factor, by factor id. */
  byFactor: Record<number, string[]>;
}

/** Laravel's own messages name the field by its key ("The factor rules.0.bands.1.threshold field …"). */
const RAW_FIELD = /factor[ _]rules?\.\d/i;

const UNNAMED_FACTOR = "A factor's ranges couldn't be saved. Check them and save again.";

const FACTOR_KEY = /^factor_rules\.(\d+)(?:\.(bands)(?:\.(\d+)(?:\.(threshold|points))?)?|\.(otherwise|default_points))?/;

function inWords(rule: ScorecardFactorRule, match: RegExpMatchArray): string {
  const [, , bands, band, bandField, field] = match;
  const range = band === undefined ? "" : `, range ${Number(band) + 1}`;
  if (bandField === "threshold") {
    return `${rule.label}${range}: the threshold must be a number from 0 to 1,000,000, with at most two decimals.`;
  }
  if (bandField === "points") {
    return `${rule.label}${range}: the points must be a whole number from 0 to ${rule.points}.`;
  }
  if (field === "otherwise") {
    return `${rule.label}: the points for any other value must be a whole number from 0 to ${rule.points}.`;
  }
  if (field === "default_points") {
    return `${rule.label}: the points for a defaulted or written-off loan must be a whole number from 0 to ${rule.points}.`;
  }
  if (bands && band === undefined) return `${rule.label}: a factor needs 1 to ${MAX_FACTOR_BANDS} ranges.`;
  return `${rule.label}${range}: check this range.`;
}

/**
 * The server's 422 messages about factor ranges, put under the factor they
 * name (the PUT sends the factors in the config's order). The server's own
 * messages already read in words and are kept; Laravel's defaults, which name
 * the raw field, are put in words from the key.
 */
export function factorRangeErrors(err: unknown, rules: ScorecardFactorRule[]): FactorRangeErrors {
  const out: FactorRangeErrors = { general: [], byFactor: {} };
  const errors = validationErrors(err);
  if (!errors) return out;

  for (const [key, messages] of Object.entries(errors)) {
    if (key === "factor_rules") {
      out.general.push(...messages);
      continue;
    }
    const match = key.match(FACTOR_KEY);
    const rule = match ? rules[Number(match[1])] : undefined;
    if (!match || !rule) {
      if (key.startsWith("factor_rules.")) {
        out.general.push(...messages.map((m) => (RAW_FIELD.test(m) ? UNNAMED_FACTOR : m)));
      }
      continue;
    }
    const worded = messages.map((m) => (RAW_FIELD.test(m) ? inWords(rule, match) : m));
    const list = out.byFactor[rule.id] ?? [];
    out.byFactor[rule.id] = [...list, ...worded.filter((m) => !list.includes(m))];
  }
  return out;
}
