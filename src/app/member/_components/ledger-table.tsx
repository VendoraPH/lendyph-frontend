import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";
import { toAmount } from "@/lib/portal/finance";
import type { PortalLedgerEntry } from "@/types/portal";

/** A member ledger (share capital, savings): newest first as the server sends it. */
export function LedgerTable({ entries }: { entries: PortalLedgerEntry[] }) {
  if (entries.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No transactions yet.</p>;
  }
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="hidden text-right sm:table-cell">Balance</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((e) => {
            const credit = toAmount(e.credit);
            const debit = toAmount(e.debit);
            return (
              <TableRow key={e.id}>
                <TableCell className="whitespace-nowrap">{formatDate(e.date)}</TableCell>
                <TableCell>
                  {e.description}
                  {e.reference && <p className="text-xs text-muted-foreground">{e.reference}</p>}
                </TableCell>
                <TableCell
                  className={`whitespace-nowrap text-right font-medium ${credit > 0 ? "text-emerald-700 dark:text-emerald-400" : ""}`}
                >
                  {credit > 0 ? `+${formatCurrency(credit)}` : `−${formatCurrency(debit)}`}
                </TableCell>
                <TableCell className="hidden whitespace-nowrap text-right sm:table-cell">
                  {formatCurrency(e.balance)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
