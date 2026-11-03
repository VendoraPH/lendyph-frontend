"use client";

import Link from "next/link";
import { usePermission } from "@/hooks";
import { Button } from "@/components/ui/button";
import type { SavingsAccount } from "@/types/savings";
import { canDeposit, canWithdraw } from "../../../_lib/savings-rules";

/**
 * Deposit, withdraw and transfer from this account, each shown to those
 * allowed to post it and only when the account's status takes it.
 */
export function AccountMoneyLinks({ account }: { account: SavingsAccount }) {
  const { can } = usePermission();
  const query = `?account=${account.id}`;
  const links = [
    { href: `/savings/deposits${query}`, label: "Deposit", show: can("savings:deposit") && canDeposit(account).ok },
    { href: `/savings/withdrawals${query}`, label: "Withdraw", show: can("savings:withdraw") && canWithdraw(account).ok },
    { href: `/savings/transfers${query}`, label: "Transfer", show: can("savings:transfer") && canWithdraw(account).ok },
  ].filter((l) => l.show);

  return links.map((l) => (
    <Button key={l.href} variant="outline" render={<Link href={l.href} />}>
      {l.label}
    </Button>
  ));
}
