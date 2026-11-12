import { penaltyTermLines, type PenaltyTermsSource } from "@/lib/penalty-terms";

// The pure helpers live in src/lib/penalty-terms.ts, so the printables can use
// them too; the Settings → Penalties screens still import the range label here.
export { bracketRangeLabel } from "@/lib/penalty-terms";

/** The loan's penalty terms, with the configuration's name when it has one. */
export function PenaltyTerms({ loan, className }: { loan: PenaltyTermsSource; className?: string }) {
  const lines = penaltyTermLines(loan);
  const name = (loan.penalty_brackets?.length ?? 0) > 0 ? loan.penalty_config_name : null;
  return (
    <div className={className}>
      {name && <p className="text-xs text-muted-foreground">{name}</p>}
      {lines.length === 1 ? (
        <p className="text-sm">{lines[0]}</p>
      ) : (
        <ul className="space-y-0.5 text-sm">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
