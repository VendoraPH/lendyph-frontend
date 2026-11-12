import { Check, CornerUpLeft } from "lucide-react";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { reviewRound, stepStatusMeta } from "../_lib/review-chain";
import { ToneBadge } from "./tone-badge";
import type { CdaApprovalStep } from "@/types/cda";

const MARKER: Record<string, string> = {
  approved: "bg-emerald-500 text-white border-emerald-500",
  pending: "border-blue-500 text-blue-700 bg-blue-500/10 ring-2 ring-blue-500/20",
  returned: "bg-amber-500 text-white border-amber-500",
};

function Marker({ step }: { step: CdaApprovalStep }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
        MARKER[step.status] ?? "border-muted-foreground/30 text-muted-foreground",
      )}
    >
      {step.status === "approved" ? (
        <Check className="h-3.5 w-3.5" />
      ) : step.status === "returned" ? (
        <CornerUpLeft className="h-3.5 w-3.5" />
      ) : (
        step.step_order
      )}
    </span>
  );
}

/**
 * The report's review round (`approval_steps`), as the server copied it from
 * the CDA review chain at submit for review: each step's name, role, status,
 * who acted and when, and the remarks. Nothing shows on the single review.
 */
export function ReviewSteps({ steps }: { steps: CdaApprovalStep[] }) {
  const round = reviewRound(steps);
  if (!round) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Review steps</CardTitle>
        {round.round > 1 && (
          <CardAction>
            <span className="text-xs text-muted-foreground">Round {round.round}</span>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {round.closed && (
          <p className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
            This review round has ended. Sending the report for review again starts a new one.
          </p>
        )}
        <ol className="space-y-3" aria-label="Review steps">
          {steps.map((step) => {
            const meta = stepStatusMeta(step.status);
            return (
              <li
                key={step.id}
                className="flex gap-3 text-sm"
                aria-current={step.status === "pending" && !step.closed ? "step" : undefined}
              >
                <Marker step={step} />
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-medium">{step.name}</span>
                    <ToneBadge tone={meta.tone} label={meta.label} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {step.role_label}
                    {step.status_label && ` · ${step.status_label}`}
                  </p>
                  {step.acted_at && (
                    <p className="text-xs text-muted-foreground">
                      {step.acted_by_name ?? "System"} · {formatDateTime(step.acted_at)}
                    </p>
                  )}
                  {step.remarks && <p className="text-xs italic text-muted-foreground">“{step.remarks}”</p>}
                </div>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
