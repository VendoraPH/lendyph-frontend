import type { ReactNode } from "react";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { decimalInputValue } from "@/lib/percent";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SavingsAccount } from "@/types/savings";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium">{children}</dd>
    </div>
  );
}

/** The member's details and the account's balances, rate and dates, as the server reports them. */
export function AccountSummary({ account }: { account: SavingsAccount }) {
  const { member, product } = account;
  const rate = account.rate_override ?? account.interest_rate;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Member</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Field label="Name">{member.full_name}</Field>
            <Field label="Member code">{member.borrower_code ?? "—"}</Field>
            <Field label="Contact">{member.contact_number ?? "—"}</Field>
            <Field label="Email">{member.email ?? "—"}</Field>
            <div className="col-span-2">
              <Field label="Address">{member.address ?? "—"}</Field>
            </div>
          </dl>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Account</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <Field label="Available balance">{formatCurrency(account.available_balance)}</Field>
            <Field label="Ledger balance">{formatCurrency(account.ledger_balance)}</Field>
            <Field label="Accrued interest">
              {account.accrued_interest === null ? "—" : formatCurrency(account.accrued_interest)}
            </Field>
            <Field label="Product">{product.name}</Field>
            <Field label="Interest rate">
              {decimalInputValue(rate) || "0"}% p.a.{account.rate_override != null ? " (override)" : ""}
            </Field>
            <Field label="Maintaining balance">{formatCurrency(product.min_maintaining_balance)}</Field>
            <Field label="Branch">{account.branch?.name ?? "—"}</Field>
            <Field label="Opened">{formatDate(account.opened_at)}</Field>
            <Field label="Last transaction">
              {account.last_transaction_at ? formatDateTime(account.last_transaction_at) : "—"}
            </Field>
            {account.closed_at && <Field label="Closed">{formatDate(account.closed_at)}</Field>}
          </dl>
          {account.remarks && (
            <p className="mt-3 rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">{account.remarks}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
