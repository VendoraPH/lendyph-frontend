import Link from "next/link";
import { Mail, MessageSquare } from "lucide-react";
import { QueueStatusBadge } from "@/components/reminders/reminder-status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrencyExact, formatDate, formatDateTime } from "@/lib/format";
import type { ReminderQueueItem } from "@/types/reminder";

/**
 * Reminder rows, as the dashboard's status overview and the full queue show
 * them. Cancelled and skipped rows carry their reason under the badge: the two
 * look alike and mean opposite things (paid vs. couldn't reach).
 */
export function QueueTable({ items }: { items: ReminderQueueItem[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Borrower</TableHead>
            <TableHead>Loan</TableHead>
            <TableHead>Installment</TableHead>
            <TableHead className="text-right">Amount due</TableHead>
            <TableHead>Rule</TableHead>
            <TableHead>Channel</TableHead>
            <TableHead>Scheduled</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                <Link href={`/borrowers/${item.borrower_id}`} className="font-medium hover:underline">
                  {item.borrower_name}
                </Link>
              </TableCell>
              <TableCell>
                <Link href={`/loans/${item.loan_id}`} className="text-brand-orange hover:underline">
                  {item.loan_account_number}
                </Link>
              </TableCell>
              <TableCell className="whitespace-nowrap">
                #{item.installment_number}
                <span className="block text-xs text-muted-foreground">due {formatDate(item.due_date)}</span>
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrencyExact(item.amount_due)}</TableCell>
              <TableCell className="text-sm">
                {item.rule_name ?? (item.source === "manual" ? "Manual" : "—")}
              </TableCell>
              <TableCell>
                <span className="flex items-center gap-1.5 text-sm">
                  {item.channel === "sms" ? (
                    <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  {item.recipient}
                </span>
              </TableCell>
              <TableCell className="whitespace-nowrap text-sm">{formatDateTime(item.scheduled_at)}</TableCell>
              <TableCell>
                <QueueStatusBadge status={item.status} />
                {item.reason && (
                  <span className="mt-1 block max-w-[14rem] text-xs text-muted-foreground">{item.reason}</span>
                )}
                {item.attempts > 1 && (
                  <span className="block text-xs text-muted-foreground">{item.attempts} attempts</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
