import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DashboardCashAccount } from "@/types";
import { cashKindLabel } from "../../_lib/display-labels";
import { centavosOrDash } from "../../_lib/dashboard-figures";

/** Each money account's balance at As of, as the server sends it. */
export function CashAccountsTable({ accounts }: { accounts: readonly DashboardCashAccount[] | undefined }) {
  return (
    <Card>
      <CardContent className="pt-6">
        {!accounts || accounts.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No money accounts in this selection.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Code</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead className="w-28">Kind</TableHead>
                  <TableHead className="w-36 text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((account) => (
                  <TableRow key={account.account_id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {account.account_code}
                    </TableCell>
                    <TableCell className="text-sm">{account.account_name}</TableCell>
                    <TableCell className="text-sm">
                      {account.cash_kind ? cashKindLabel(account.cash_kind) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums">
                      {centavosOrDash(account.balance)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
