import { Plus, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FACTOR_RULE_LABELS } from "@/lib/credit-scoring/labels";
import {
  MAX_FACTOR_BANDS,
  ruleOrderNote,
  withBandAdded,
  withBandChanged,
  withBandRemoved,
  type FactorDraft,
  type FactorRangeErrors,
} from "@/lib/credit-scoring/factor-ranges";
import { FieldMessages } from "./field-messages";
import type { ScorecardCategoryConfig, ScorecardFactorRule } from "@/types/credit-scoring";

const GENERAL_ERRORS_ID = "scorecard-factors-errors";

function PointsInput({
  id,
  label,
  value,
  invalid,
  describedBy,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  invalid: boolean;
  describedBy: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center justify-end gap-2">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        className="w-20 text-right tabular-nums"
        value={value}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.value)}
      />
      <span className="text-xs text-muted-foreground" aria-hidden="true">
        points
      </span>
    </div>
  );
}

function FactorCard({
  rule,
  category,
  draft,
  errors,
  onChange,
}: {
  rule: ScorecardFactorRule;
  category: string;
  draft: FactorDraft;
  errors: string[];
  onChange: (draft: FactorDraft) => void;
}) {
  const base = `factor-${rule.id}`;
  const errorsId = `${base}-errors`;
  const pointsHintId = `${base}-points-hint`;
  const invalid = errors.length > 0;
  const describedBy = invalid ? `${pointsHintId} ${errorsId}` : pointsHintId;
  const words = FACTOR_RULE_LABELS[rule.rule];

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-medium">{rule.label}</h3>
            <p className="text-xs text-muted-foreground">
              {category} · <span id={pointsHintId}>each range gives 0 to {rule.points} points</span>
              {rule.unit && <> · measured in {rule.unit}</>}
            </p>
          </div>
          {!rule.is_active && <Badge variant="outline">Off</Badge>}
        </div>

        <p className="text-xs text-muted-foreground">{ruleOrderNote(rule.rule)}</p>
        <FieldMessages id={errorsId} messages={errors} />

        <table className="w-full text-sm">
          <caption className="sr-only">{`${rule.label} ranges`}</caption>
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th scope="col" className="py-1 font-medium">
                When the value is
              </th>
              <th scope="col" className="py-1 text-right font-medium">
                Points
              </th>
              <th scope="col" className="w-10 py-1">
                <span className="sr-only">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {draft.default_points !== undefined && (
              <tr>
                <td className="py-2">A defaulted or written-off loan</td>
                <td className="py-2">
                  <PointsInput
                    id={`${base}-default`}
                    label={`${rule.label}: points for a defaulted or written-off loan`}
                    value={draft.default_points}
                    invalid={invalid}
                    describedBy={describedBy}
                    onChange={(v) => onChange({ ...draft, default_points: v })}
                  />
                </td>
                <td />
              </tr>
            )}
            {draft.bands.map((band, index) => {
              const rangeName = `${rule.label}, range ${index + 1}`;
              const thresholdId = `${base}-band-${index}-threshold`;
              return (
                <tr key={index}>
                  <td className="py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span>{words}</span>
                      <label htmlFor={thresholdId} className="sr-only">
                        {`${rangeName}: threshold, ${words}${rule.unit ? `, in ${rule.unit}` : ""}`}
                      </label>
                      <Input
                        id={thresholdId}
                        type="text"
                        inputMode="decimal"
                        className="w-28 text-right tabular-nums"
                        value={band.threshold}
                        aria-invalid={invalid || undefined}
                        aria-describedby={invalid ? errorsId : undefined}
                        onChange={(e) => onChange(withBandChanged(draft, index, "threshold", e.target.value))}
                      />
                      {rule.unit && (
                        <span className="text-xs text-muted-foreground" aria-hidden="true">
                          {rule.unit}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2">
                    <PointsInput
                      id={`${base}-band-${index}-points`}
                      label={`${rangeName}: points`}
                      value={band.points}
                      invalid={invalid}
                      describedBy={describedBy}
                      onChange={(v) => onChange(withBandChanged(draft, index, "points", v))}
                    />
                  </td>
                  <td className="py-2 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${rangeName}`}
                      disabled={draft.bands.length <= 1}
                      onClick={() => onChange(withBandRemoved(draft, index))}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </td>
                </tr>
              );
            })}
            <tr>
              <td className="py-2">Any other value</td>
              <td className="py-2">
                <PointsInput
                  id={`${base}-otherwise`}
                  label={`${rule.label}: points for any other value`}
                  value={draft.otherwise}
                  invalid={invalid}
                  describedBy={describedBy}
                  onChange={(v) => onChange({ ...draft, otherwise: v })}
                />
              </td>
              <td />
            </tr>
          </tbody>
        </table>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={draft.bands.length >= MAX_FACTOR_BANDS}
          onClick={() => onChange(withBandAdded(draft))}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add range
        </Button>
      </CardContent>
    </Card>
  );
}

/**
 * Each factor's ranges: thresholds in the factor's own unit, read by its rule
 * ("at least" or "at most"), with points from 0 to the factor's own points.
 * The factor itself (rule, points, category, switch) stays as the revision
 * has it. The server checks the order and the limits and answers in words.
 */
export function FactorRangesEditor({
  rules,
  categories,
  drafts,
  errors,
  onChange,
}: {
  rules: ScorecardFactorRule[];
  categories: ScorecardCategoryConfig[];
  drafts: Record<number, FactorDraft>;
  errors: FactorRangeErrors;
  onChange: (id: number, draft: FactorDraft) => void;
}) {
  const labels: Record<string, string> = Object.fromEntries(categories.map((c) => [c.key, c.label]));
  return (
    <div className="space-y-4">
      <FieldMessages id={GENERAL_ERRORS_ID} messages={errors.general} />
      <p className="text-sm text-muted-foreground">
        Change the ranges each factor scores by. A factor&apos;s rule, its points and its category stay as they
        are, so each category keeps its weight. Up to {MAX_FACTOR_BANDS} ranges per factor.
      </p>
      {rules.map((rule) => (
        <FactorCard
          key={rule.id}
          rule={rule}
          category={labels[rule.category_key] ?? "Other"}
          draft={drafts[rule.id]}
          errors={errors.byFactor[rule.id] ?? []}
          onChange={(next) => onChange(rule.id, next)}
        />
      ))}
    </div>
  );
}
