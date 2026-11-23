import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FieldMessages } from "./field-messages";
import type { RiskBand, RiskLevel } from "@/types/credit-scoring";

const ERRORS_ID = "scorecard-bands-errors";

/**
 * The six risk bands with the server's labels, each with a whole-number
 * minimum score. The server checks the order and the 0 floor.
 */
export function RiskBandsEditor({
  bands,
  minimums,
  errors,
  onChange,
}: {
  bands: RiskBand[];
  minimums: Partial<Record<RiskLevel, string>>;
  errors: string[];
  onChange: (key: RiskLevel, value: string) => void;
}) {
  return (
    <div className="space-y-4">
      <FieldMessages id={ERRORS_ID} messages={errors} />
      <p className="text-sm text-muted-foreground">
        A score at or above a band&apos;s minimum falls in that band. Minimums fall from very low to very high
        risk, and the very high risk band starts at 0.
      </p>
      <Card>
        <CardContent className="divide-y pt-2">
          {bands.map((band) => {
            const inputId = `band-${band.key}`;
            return (
              <div key={band.key} className="flex items-center justify-between gap-4 py-3">
                <label htmlFor={inputId} className="text-sm font-medium">
                  {band.label}
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground" aria-hidden="true">
                    from
                  </span>
                  <Input
                    id={inputId}
                    type="text"
                    inputMode="numeric"
                    className="w-20 text-right tabular-nums"
                    value={minimums[band.key] ?? ""}
                    aria-invalid={errors.length > 0 || undefined}
                    aria-describedby={errors.length > 0 ? ERRORS_ID : undefined}
                    onChange={(e) => onChange(band.key, e.target.value)}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
