"use client";

import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SavingsAccount } from "@/types/savings";
import { ACCOUNT_STATUS_LABEL, ACCOUNT_STATUS_TONE } from "../../_lib/account-status";
import { ToneBadge } from "../../_components/tone-badge";

const href = (a: SavingsAccount) => `/savings/accounts/${a.id}`;

function StatusBadge({ account }: { account: SavingsAccount }) {
  return <ToneBadge tone={ACCOUNT_STATUS_TONE[account.status]}>{ACCOUNT_STATUS_LABEL[account.status]}</ToneBadge>;
}

/** Savings accounts, cards on mobile and a table from `md` up. Each opens its detail page. */
export function AccountTable({ accounts }: { accounts: SavingsAccount[] }) {
  if (accounts.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No savings accounts match these filters.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-3 md:hidden">
        {accounts.map((a) => (
          <Link key={a.id} href={href(a)} className="block">
            <Card className="transition-colors hover:bg-muted/40">
              <CardContent className="space-y-2 py-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{a.member.full_name}</p>
                    <p className="font-mono text-xs text-muted-foreground">{a.account_number}</p>
                  </div>
                  <StatusBadge account={a} />
                </div>
                <dl className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Product</dt>
                    <dd className="truncate">{a.product.name}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Available</dt>
                    <dd className="font-medium">{formatCurrency(a.available_balance)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Branch</dt>
                    <dd className="truncate">{a.branch?.name ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Opened</dt>
                    <dd>{formatDate(a.opened_at)}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="hidden min-w-0 overflow-hidden md:block">
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account no.</TableHead>
                <TableHead>Member</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Opened</TableHead>
                <TableHead className="text-right">Available</TableHead>
                <TableHead className="text-right">Ledger</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-mono text-xs">
                    <Link href={href(a)} className="text-primary hover:underline">
                      {a.account_number}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{a.member.full_name}</div>
                    {a.member.borrower_code && (
                      <div className="text-xs text-muted-foreground">{a.member.borrower_code}</div>
                    )}
                  </TableCell>
                  <TableCell>{a.product.name}</TableCell>
                  <TableCell>{a.branch?.name ?? "—"}</TableCell>
                  <TableCell>{formatDate(a.opened_at)}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(a.available_balance)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(a.ledger_balance)}</TableCell>
                  <TableCell>
                    <StatusBadge account={a} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
