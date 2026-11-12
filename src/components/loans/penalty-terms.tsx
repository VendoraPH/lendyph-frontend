import { formatRate } from "@/lib/format";
import type { Loan, PenaltyBracket } from "@/types/loan";

/**
 * A loan's late penalty terms, in words, as the loan was created with them.
 *
 * A loan created while its product had an active penalty configuration
 * (Settings → Penalties) carries that configuration's brackets; any other
 * loan carries one monthly rate. Both come from the server. This only reads
 * them out: which bracket a charge falls in is decided by the server.
 */
export type PenaltyTermsSource = Pick<Loan, "penalty_rate" | "penalty_brackets" | "penalty_config_name">;

const days = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;

/** A bracket's days late in words: "1–5 days", "3 days", "11 days or more". */
export function bracketRangeLabel(bracket: Pick<PenaltyBracket, "days_from" | "days_to">): string {
  if (bracket.days_to === null) return `${days(bracket.days_from)} or more`;
  if (bracket.days_to === bracket.days_from) return days(bracket.days_from);
  return `${bracket.days_from}–${bracket.days_to} days`;
}

/** One bracket as a line: "1–5 days late: 20%", "11 days or more: 50%". */
export function bracketLine(bracket: PenaltyBracket): string {
  const range = bracketRangeLabel(bracket);
  const late = bracket.days_to === null ? range : `${range} late`;
  return `${late}: ${formatRate(bracket.rate)}%`;
}

/**
 * The loan's penalty terms as lines: one per bracket, else "3% a month", else
 * "No penalty".
 */
export function penaltyTermLines(loan: PenaltyTermsSource): string[] {
  const brackets = loan.penalty_brackets ?? [];
  if (brackets.length > 0) return brackets.map(bracketLine);
  if (Number(loan.penalty_rate ?? 0) > 0) return [`${formatRate(loan.penalty_rate)}% a month`];
  return ["No penalty"];
}

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
