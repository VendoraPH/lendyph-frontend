"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { chargePreviewFigures, type ChargePreviewView } from "../_lib/charge-preview";
import { GCashTierNotice } from "./gcash-tier-notice";

interface Props {
  view: ChargePreviewView;
  action: "Cash In" | "Cash Out";
  amount: number;
  onRetry(): void;
}

/**
 * The Charge and Total of a Cash In / Cash Out dialog, as the server previewed
 * them for the amount in the box, and the reason when there are none: no fee
 * tier, an amount the server refuses (its 422 message, e.g. a Cash Out the
 * charge would take all of), no permission, or a failed request to retry.
 */
export function ChargePreviewPanel({ view, action, amount, onRetry }: Props) {
  const figures = chargePreviewFigures(view);

  return (
    <>
      <GCashTierNotice
        issue={view.status === "no_tier" ? "out_of_range" : null}
        action={action}
        amount={amount}
        onRetry={onRetry}
      />

      {(view.status === "error" || view.status === "invalid" || view.status === "forbidden") && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div className="flex-1 space-y-2">
            <p>
              {view.status === "error"
                ? `Couldn’t work out the charge. ${view.message}`
                : view.message}
            </p>
            {view.status === "error" && (
              <Button type="button" variant="outline" size="sm" onClick={onRetry}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3" aria-live="polite" aria-busy={view.status === "loading"}>
        <div>
          <Label className="text-muted-foreground">Charge</Label>
          <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">{figures.charge}</div>
        </div>
        <div>
          <Label className="text-muted-foreground">Total</Label>
          <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm font-medium">
            {figures.total}
          </div>
        </div>
      </div>
    </>
  );
}
