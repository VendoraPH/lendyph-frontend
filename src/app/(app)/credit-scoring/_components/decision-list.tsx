import { formatDateTime } from "@/lib/format";
import { DECISION_LABELS } from "@/lib/credit-scoring/labels";
import { decisionLoanLabel } from "@/lib/credit-scoring/decision-loan";
import type { CreditDecision } from "@/types/credit-scoring";

/**
 * Decisions as the server sent them, in its order. Reason and remarks show only
 * when sent. `showLoan` names each decision's loan, for a member's list, where
 * decisions span several loans.
 */
export function DecisionItems({ decisions, showLoan = false }: { decisions: CreditDecision[]; showLoan?: boolean }) {
  return (
    <ul className="space-y-2">
      {decisions.map((d) => (
        <li key={d.id} className="rounded-md border p-3 text-sm">
          <p className="font-medium">{DECISION_LABELS[d.decision]}</p>
          {showLoan && decisionLoanLabel(d) && <p className="text-xs text-muted-foreground">{decisionLoanLabel(d)}</p>}
          {d.reason && <p>{d.reason}</p>}
          {d.remarks && <p className="text-muted-foreground">{d.remarks}</p>}
          <p className="text-xs text-muted-foreground">
            {d.decided_by} · {formatDateTime(d.decided_at)}
            {d.revision_version ? ` · Scorecard v${d.revision_version}` : ""}
          </p>
        </li>
      ))}
    </ul>
  );
}

/** A loan's recorded decisions, newest first, as the server sent them. */
export function DecisionList({ decisions, total }: { decisions: CreditDecision[]; total: number }) {
  if (decisions.length === 0) {
    return <p className="text-sm text-muted-foreground">No decisions recorded for this application.</p>;
  }

  return (
    <div className="space-y-2">
      <DecisionItems decisions={decisions} />
      {total > decisions.length && (
        <p className="text-xs text-muted-foreground">
          Showing the latest {decisions.length} of {total}.
        </p>
      )}
    </div>
  );
}
