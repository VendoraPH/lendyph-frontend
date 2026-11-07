"use client";

import { useCallback } from "react";
import { DataState } from "@/components/common/data-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiResource } from "@/hooks/use-api-resource";
import { formatDate } from "@/lib/format";
import { creditCategoryTone, creditScoreView, FACTOR_TONE, type CreditScoreView } from "@/lib/portal/engagement";
import { TONE_CLASS } from "@/lib/portal/labels";
import { portalService } from "@/services/portal.service";
import { usePortalConfig } from "./portal-config";
import { StatusPill } from "./portal-shell";

/**
 * The member's credit standing, as much of it as the cooperative chose to
 * show (portal settings → credit score). Renders nothing when that is "hidden".
 */
export function CreditScoreCard() {
  const { config } = usePortalConfig();
  const visibility = config.features.credit_score;
  const fetcher = useCallback(() => portalService.creditScore(), []);
  const resource = useApiResource(fetcher, visibility !== "hidden");
  if (visibility === "hidden") return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Credit standing</CardTitle>
      </CardHeader>
      <CardContent>
        <DataState
          resource={resource}
          endpoints={["GET /portal/credit-score"]}
          summary="Your credit standing with the cooperative."
        >
          {(data) => {
            const view = creditScoreView(data, visibility);
            return view ? (
              <ScoreBody view={view} />
            ) : (
              <p className="text-sm text-muted-foreground">No credit standing has been recorded for you yet.</p>
            );
          }}
        </DataState>
      </CardContent>
    </Card>
  );
}

function ScoreBody({ view }: { view: CreditScoreView }) {
  const percent = view.score !== null ? Math.max(0, Math.min(100, (view.score / view.maxScore) * 100)) : null;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        {view.score !== null && (
          <p className="text-3xl font-semibold">
            {view.score}
            <span className="text-base font-normal text-muted-foreground">/{view.maxScore}</span>
          </p>
        )}
        {view.category && (
          <StatusPill className={TONE_CLASS[creditCategoryTone(view.category)]}>{view.category}</StatusPill>
        )}
      </div>
      {percent !== null && (
        <div
          className="h-2 overflow-hidden rounded-full bg-muted"
          role="meter"
          aria-label="Credit score"
          aria-valuemin={0}
          aria-valuemax={view.maxScore}
          aria-valuenow={view.score ?? 0}
        >
          <div className="h-full rounded-full bg-brand-orange" style={{ width: `${percent}%` }} />
        </div>
      )}
      {view.factors.length > 0 && (
        <ul className="space-y-2 text-sm">
          {view.factors.map((f) => (
            <li key={f.label} className="flex items-start gap-2">
              <StatusPill className={TONE_CLASS[FACTOR_TONE[f.impact]]}>
                {f.impact === "positive" ? "Helps" : f.impact === "negative" ? "Hurts" : "Neutral"}
              </StatusPill>
              <span>
                <span className="font-medium">{f.label}</span>
                {f.description && <span className="block text-muted-foreground">{f.description}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">
        {view.asOf ? `As of ${formatDate(view.asOf)}. ` : ""}A guide only: every loan is still reviewed by the cooperative.
      </p>
    </div>
  );
}
