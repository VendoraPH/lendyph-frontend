"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { usePermission } from "@/hooks";
import { formatCurrencyExact } from "@/lib/format";

interface Props {
  action: "Cash In" | "Cash Out";
  amount: number;
}

/**
 * Says why a Cash In / Cash Out can't be recorded when no fee tier covers the
 * amount (the server preview's 422), instead of leaving a "—" charge and a
 * silently disabled button.
 */
export function GCashTierNotice({ action, amount }: Props) {
  const canEditTiers = usePermission().can("gcash:settings");

  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50/50 p-3 text-sm dark:border-amber-700 dark:bg-amber-900/10"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
      <p>
        No fee tier covers {formatCurrencyExact(amount)}, so the charge
        can&rsquo;t be worked out and this {action} can&rsquo;t be recorded.{" "}
        {canEditTiers ? (
          <Link
            href="/settings/gcash"
            className="font-medium underline underline-offset-2"
          >
            Check the fee tiers in GCash Settings
          </Link>
        ) : (
          "Ask an admin to add a tier for it in GCash Settings."
        )}
      </p>
    </div>
  );
}
