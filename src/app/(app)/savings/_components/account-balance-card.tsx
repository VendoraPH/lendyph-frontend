import { formatCurrency } from "@/lib/format";
import type { SavingsAccount } from "@/types/savings";
import { ACCOUNT_STATUS_LABEL, ACCOUNT_STATUS_TONE } from "../_lib/account-status";
import { ToneBadge } from "./tone-badge";

/** The chosen account at a glance: who, which product, status and balances. */
export function AccountBalanceCard({ account }: { account: SavingsAccount }) {
  return (
    <div className="space-y-3 rounded-md border bg-muted/30 p-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono font-medium">{account.account_number}</p>
          <p className="truncate text-muted-foreground">
            {account.member.full_name} · {account.product.name}
          </p>
        </div>
        <ToneBadge tone={ACCOUNT_STATUS_TONE[account.status]}>{ACCOUNT_STATUS_LABEL[account.status]}</ToneBadge>
      </div>
      <dl className="grid grid-cols-3 gap-2">
        <div>
          <dt className="text-xs text-muted-foreground">Available</dt>
          <dd className="font-semibold">{formatCurrency(account.available_balance)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Ledger</dt>
          <dd className="font-medium">{formatCurrency(account.ledger_balance)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Maintaining</dt>
          <dd className="font-medium">{formatCurrency(account.product.min_maintaining_balance)}</dd>
        </div>
      </dl>
    </div>
  );
}
