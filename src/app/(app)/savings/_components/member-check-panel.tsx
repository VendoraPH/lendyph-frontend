"use client";

import { formatCurrency } from "@/lib/format";
import type { ApiResource } from "@/hooks/use-api-resource";
import type { SavingsOpeningCheck } from "@/types";
import { memberCheckRows } from "../_lib/opening-draft";
import { ACCOUNT_STATUS_LABELS, labelOf } from "../_lib/savings-rules";

/**
 * The member check on Open a savings account (`GET /savings/opening-check`):
 * the member's standing, loans, share capital and savings accounts, every
 * figure the server's. A figure the caller may not see reads "—".
 */
export function MemberCheckPanel({ check }: { check: ApiResource<SavingsOpeningCheck> }) {
  if (check.loading) {
    return <p className="rounded-lg border p-3 text-sm text-muted-foreground">Checking the member…</p>;
  }
  if (check.unavailable || check.error || !check.data) {
    return (
      <p role="alert" className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive">
        Couldn&apos;t check this member. The products below are every active product; the server still checks the
        member when the account is opened.
      </p>
    );
  }

  const data = check.data;
  return (
    <section aria-labelledby="member-check" className="space-y-3 rounded-lg border bg-muted/30 p-3">
      <h3 id="member-check" className="text-sm font-medium">
        Member check
      </h3>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
        {memberCheckRows(data).map((row) => (
          <div key={row.label}>
            <dt className="text-xs text-muted-foreground">{row.label}</dt>
            <dd className="tabular-nums">{row.value}</dd>
          </div>
        ))}
      </dl>
      <div>
        <p className="text-xs text-muted-foreground">Savings accounts</p>
        {data.savings_accounts.length === 0 ? (
          <p className="text-sm">None yet.</p>
        ) : (
          <ul className="text-sm">
            {data.savings_accounts.map((a) => (
              <li key={a.id} className="flex flex-wrap justify-between gap-x-3">
                <span>
                  {a.account_number} · {a.product_name ?? "—"} · {labelOf(ACCOUNT_STATUS_LABELS, a.status)}
                </span>
                <span className="tabular-nums">{formatCurrency(a.balance)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {data.eligible_products.length === 0
          ? "The member can't open any more savings products: none is open to them, or they already hold one of each."
          : `Can open: ${data.eligible_products.map((p) => p.name).join(", ")}.`}
      </p>
    </section>
  );
}
