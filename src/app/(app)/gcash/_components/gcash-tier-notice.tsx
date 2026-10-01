"use client";

import Link from "next/link";
import { AlertCircle, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePermission } from "@/hooks";
import { formatCurrencyExact } from "@/lib/format";
import type { GCashTierIssue } from "../_lib/tier-issue";

interface Props {
  issue: GCashTierIssue | null;
  action: "Cash In" | "Cash Out";
  amount: number;
  onRetry(): void;
}

/**
 * Says why a Cash In / Cash Out can't be recorded when the fee tiers are the
 * reason, instead of leaving a "—" charge and a silently disabled button.
 */
export function GCashTierNotice({ issue, action, amount, onRetry }: Props) {
  const canEditTiers = usePermission().can("gcash:settings");
  if (!issue) return null;

  if (issue === "load_error") {
    return (
      <div
        role="alert"
        className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm"
      >
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        <div className="flex-1 space-y-2">
          <p>
            Couldn&rsquo;t load the GCash fee tiers, so the charge can&rsquo;t
            be worked out.
          </p>
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const reason =
    issue === "no_tiers" ? (
      <>
        No GCash fee tiers are set up, so the charge can&rsquo;t be worked out
        and a {action} can&rsquo;t be recorded yet.
      </>
    ) : (
      <>
        No fee tier covers {formatCurrencyExact(amount)}, so the charge
        can&rsquo;t be worked out and this {action} can&rsquo;t be recorded.
      </>
    );

  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50/50 p-3 text-sm dark:border-amber-700 dark:bg-amber-900/10"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
      <p>
        {reason}{" "}
        {canEditTiers ? (
          <Link
            href="/settings/gcash"
            className="font-medium underline underline-offset-2"
          >
            {issue === "no_tiers"
              ? "Add a fee tier in GCash Settings"
              : "Check the fee tiers in GCash Settings"}
          </Link>
        ) : issue === "no_tiers" ? (
          "Ask an admin to add one in GCash Settings."
        ) : (
          "Ask an admin to add a tier for it in GCash Settings."
        )}
      </p>
    </div>
  );
}
