import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FieldMessages } from "./field-messages";
import type { ScorecardCategoryConfig } from "@/types/credit-scoring";

const ERRORS_ID = "scorecard-categories-errors";

/**
 * Category weights as typed, two decimals, never rounded. The server checks
 * the 100.00 total and answers with its own message, shown above the list.
 */
export function CategoriesEditor({
  categories,
  weights,
  errors,
  onChange,
}: {
  categories: ScorecardCategoryConfig[];
  weights: Record<string, string>;
  errors: string[];
  onChange: (key: string, value: string) => void;
}) {
  return (
    <div className="space-y-4">
      <FieldMessages id={ERRORS_ID} messages={errors} />
      <p className="text-sm text-muted-foreground">
        Weights must total exactly 100.00%, with at most two decimals each. The server checks the total when you save.
      </p>
      {categories.map((cat) => {
        const inputId = `weight-${cat.key}`;
        return (
          <Card key={cat.key}>
            <CardContent className="flex items-center justify-between gap-4 pt-6">
              <div>
                <label htmlFor={inputId} className="text-sm font-medium">
                  {cat.label}
                </label>
                <p className="text-xs text-muted-foreground">{cat.description}</p>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  id={inputId}
                  type="text"
                  inputMode="decimal"
                  className="w-24 text-right tabular-nums"
                  value={weights[cat.key] ?? ""}
                  aria-invalid={errors.length > 0 || undefined}
                  aria-describedby={errors.length > 0 ? ERRORS_ID : undefined}
                  onChange={(e) => onChange(cat.key, e.target.value)}
                />
                <span className="text-sm text-muted-foreground" aria-hidden="true">
                  %
                </span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
