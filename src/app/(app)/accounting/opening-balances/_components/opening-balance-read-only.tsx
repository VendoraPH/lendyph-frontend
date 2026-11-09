import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCentavos } from "@/lib/accounting/money";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { OpeningBalance } from "@/types";
import {
  OPENING_EQUITY_LABEL,
  equityAccountId,
  postedElsewhereText,
  viewFor,
} from "../_lib/opening-balances";

/** The server's lines and totals as they stand, with who posted them and where. */
export function OpeningBalanceReadOnly({ opening }: { opening: OpeningBalance }) {
  const view = viewFor(opening);
  const equityId = equityAccountId(opening);

  return (
    <div className="space-y-4">
      {view === "finalised" && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
          Posted
          {opening.journal && (
            <>
              {" as "}
              <Link
                href={`/accounting/journals/${opening.journal.id}`}
                className="font-mono font-medium underline underline-offset-2"
              >
                {opening.journal.journal_no}
              </Link>
            </>
          )}
          {opening.finalised_by && ` by ${opening.finalised_by.name}`}
          {opening.finalised_at && ` on ${formatDateTime(opening.finalised_at)}`}.
        </div>
      )}
      {view === "posted_elsewhere" && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
          {postedElsewhereText(opening)}
          {opening.journal && (
            <>
              {" "}
              <Link
                href={`/accounting/journals/${opening.journal.id}`}
                className="font-medium underline underline-offset-2"
              >
                Open the journal
              </Link>
            </>
          )}
        </div>
      )}
      {view === "draft_read_only" && (
        <p className="text-sm text-muted-foreground">
          You can view this draft. Changing it needs the Accounting: Settings permission.
        </p>
      )}

      {opening.as_of && (
        <p className="text-sm">
          <span className="text-muted-foreground">As of </span>
          <span className="font-medium">{formatDate(opening.as_of)}</span>
        </p>
      )}

      {opening.lines.length > 0 && (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Code</TableHead>
                <TableHead>Account</TableHead>
                <TableHead className="w-36 text-right">Debit</TableHead>
                <TableHead className="w-36 text-right">Credit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {opening.lines.map((line) => {
                const isEquity = line.account_id === equityId;
                return (
                  <TableRow key={line.id} className={cn(isEquity && "bg-primary/5")}>
                    <TableCell className="font-mono text-xs">{line.account_code}</TableCell>
                    <TableCell className="text-sm">
                      {isEquity ? OPENING_EQUITY_LABEL : line.account_name}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {line.debit ? formatCentavos(line.debit) : ""}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {line.credit ? formatCentavos(line.credit) : ""}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2} className="font-semibold">
                  Total
                </TableCell>
                <TableCell className="text-right font-mono font-semibold">
                  {formatCentavos(opening.total_debit)}
                </TableCell>
                <TableCell className="text-right font-mono font-semibold">
                  {formatCentavos(opening.total_credit)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}
    </div>
  );
}
