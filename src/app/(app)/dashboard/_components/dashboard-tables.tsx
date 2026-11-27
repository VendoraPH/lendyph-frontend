import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getInitials } from "@/lib/initials";
import { currencyOrDash } from "@/lib/report-format";
import { dueAmountLabel, type DueItemView } from "../_lib/daily-dues";
import type { RecentTransactionRow } from "../_lib/recent-transactions";

/** Request lifecycle for a section, so empty data and a failed fetch render differently. */
export type LoadState = "loading" | "ready" | "error";

export type { DueItemView } from "../_lib/daily-dues";

/** Placeholder row for a table with nothing to show. */
function TableEmptyRow({
  colSpan,
  state,
  emptyText,
}: {
  colSpan: number;
  state: LoadState;
  emptyText: string;
}) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className="py-10 text-center text-sm text-muted-foreground">
        {state === "loading"
          ? "Loading…"
          : state === "error"
            ? "Couldn't load this data. Please refresh the page."
            : emptyText}
      </TableCell>
    </TableRow>
  );
}

/** Today's dues, one row per loan period, as the server sent them. */
export function DuesTable({ items, state }: { items: DueItemView[]; state: LoadState }) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="pl-4 text-muted-foreground">Member</TableHead>
          <TableHead className="text-muted-foreground">Loan ID</TableHead>
          <TableHead className="text-right text-muted-foreground">Amount Due</TableHead>
          <TableHead className="text-right text-muted-foreground">Paid</TableHead>
          <TableHead className="pr-4 text-right text-muted-foreground">Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.length === 0 && <TableEmptyRow colSpan={5} state={state} emptyText="Nothing due today." />}
        {items.map((item) => (
          <TableRow key={item.id} className="hover:bg-muted/40 transition-colors">
            <TableCell className="pl-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-purple-500/15 flex items-center justify-center text-xs font-semibold text-purple-700 dark:text-purple-300 shrink-0">
                  {getInitials(item.borrower)}
                </div>
                <span className="font-medium text-sm whitespace-nowrap">{item.borrower}</span>
              </div>
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">{item.loanId}</TableCell>
            <TableCell className="text-right text-sm font-medium">{dueAmountLabel(item.amountDue)}</TableCell>
            <TableCell className="text-right text-sm font-medium">
              {dueAmountLabel(item.amountPaid)}
            </TableCell>
            <TableCell className="pr-4 text-right">
              <Badge
                variant="outline"
                className={
                  item.status === "collected"
                    ? "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30"
                    : item.status === "partial"
                      ? "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30"
                      : "bg-muted text-muted-foreground border-border"
                }
              >
                {item.status === "collected" ? "Paid" : item.status === "partial" ? "Partial" : "Pending"}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** GET /dashboard/recent-transactions, in the server's order. */
export function TransactionsTable({ rows, state }: { rows: RecentTransactionRow[]; state: LoadState }) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="pl-4 text-muted-foreground">Name</TableHead>
          <TableHead className="text-muted-foreground">Description</TableHead>
          <TableHead className="text-right text-muted-foreground">Amount</TableHead>
          <TableHead className="pr-4 text-right text-muted-foreground">Date</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 && (
          <TableEmptyRow
            colSpan={4}
            state={state}
            emptyText="No transactions yet. Payments and loan releases will appear here."
          />
        )}
        {rows.map((tx) => (
          <TableRow key={tx.key} className="hover:bg-muted/40 transition-colors">
            <TableCell className="pl-4">
              <div className="flex items-center gap-3">
                <div
                  className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0 ${tx.color}`}
                >
                  {getInitials(tx.name)}
                </div>
                <span className="font-medium text-sm whitespace-nowrap">{tx.name}</span>
              </div>
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">{tx.desc}</TableCell>
            <TableCell className="text-right text-sm font-medium">{currencyOrDash(tx.amount)}</TableCell>
            <TableCell className="text-right text-sm text-muted-foreground pr-4">{tx.date}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
