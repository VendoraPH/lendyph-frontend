"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Money, SavingsTransaction } from "@/types/savings";
import { useSavingsReceipt } from "../_hooks/use-savings-receipt";
import { useTransactionPermissions } from "../_hooks/use-transaction-permissions";
import { TRANSACTION_STATUS_LABEL, TRANSACTION_STATUS_TONE, TRANSACTION_TYPE_LABEL } from "../_lib/account-status";
import { ReversalDialogs, type ReversalTarget } from "./reversal-dialogs";
import { ToneBadge } from "./tone-badge";
import { TransactionRowActions } from "./transaction-row-actions";

const amount = (v: Money) => (Number(v) ? formatCurrency(v) : "");

interface TransactionTableProps {
  rows: SavingsTransaction[];
  emptyText: string;
  /** Show which account and member each row belongs to (the cross-account history). */
  showAccount?: boolean;
  /** After a reversal is requested, approved or rejected. */
  onChanged: () => void;
}

/**
 * Savings transactions with the server's running balance. Each row links to
 * its detail, prints its receipt, and offers reversal (and its approval) to
 * those allowed.
 */
export function TransactionTable({ rows, emptyText, showAccount = false, onChanged }: TransactionTableProps) {
  const [target, setTarget] = useState<ReversalTarget | null>(null);
  const user = useTransactionPermissions();
  const receipt = useSavingsReceipt();

  return (
    <>
      <Card className="min-w-0 overflow-hidden">
        <CardContent className="overflow-x-auto">
          {rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">{emptyText}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Reference</TableHead>
                  {showAccount && <TableHead>Account</TableHead>}
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Processed by</TableHead>
                  <TableHead className="w-0">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="whitespace-nowrap">{formatDate(tx.transaction_date)}</TableCell>
                    <TableCell className="font-mono text-xs">
                      <Link href={`/savings/transactions/${tx.id}`} className="underline-offset-2 hover:underline">
                        {tx.reference_number}
                      </Link>
                    </TableCell>
                    {showAccount && (
                      <TableCell>
                        <div className="font-mono text-xs">{tx.account_number}</div>
                        <div className="text-xs text-muted-foreground">{tx.member_name}</div>
                      </TableCell>
                    )}
                    <TableCell>
                      {TRANSACTION_TYPE_LABEL[tx.type] ?? tx.type}
                      {tx.counterparty && (
                        <div className="text-xs text-muted-foreground">{tx.counterparty.account_number}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{amount(tx.debit)}</TableCell>
                    <TableCell className="text-right">{amount(tx.credit)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {tx.running_balance === null ? "—" : formatCurrency(tx.running_balance)}
                    </TableCell>
                    <TableCell>
                      <ToneBadge tone={TRANSACTION_STATUS_TONE[tx.status]}>{TRANSACTION_STATUS_LABEL[tx.status]}</ToneBadge>
                    </TableCell>
                    <TableCell>{tx.processed_by?.name ?? "—"}</TableCell>
                    <TableCell>
                      <TransactionRowActions
                        tx={tx}
                        user={user}
                        onPrint={receipt.print}
                        printing={receipt.printing}
                        onAction={(action, row) => setTarget({ action, tx: row })}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <ReversalDialogs
        target={target}
        onClose={() => setTarget(null)}
        onDone={() => {
          setTarget(null);
          onChanged();
        }}
      />
    </>
  );
}
