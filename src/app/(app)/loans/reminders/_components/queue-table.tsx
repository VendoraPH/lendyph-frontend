import Link from "next/link";
import { Mail, MessageSquare } from "lucide-react";
import { QueueStatusBadge, TestModeBadge } from "@/components/reminders/reminder-status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrencyExact, formatDate, formatDateTime } from "@/lib/format";
import { queueStatusWentOut, reminderReason, rowTestMode, type SendMode } from "@/lib/reminders";
import type { ReminderQueueItem } from "@/types/reminder";

/**
 * Reminder rows, as the dashboard's status overview and the full queue show
 * them. Cancelled and skipped rows carry their reason under the badge: the two
 * look alike and mean opposite things (paid vs. couldn't reach).
 *
 * A reminder that was only logged (its own `test_mode`, else the deployment's
 * `testMode`) reads "Logged" with a Test mode badge, never "Sent"; one whose
 * mode can't be read reads "Processed".
 */
export function QueueTable({ items, testMode }: { items: ReminderQueueItem[]; testMode: SendMode }) {
  return (
    <div className="overflow-x-auto rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Member</TableHead>
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
          {items.map((item) => {
            const mode = rowTestMode(item, testMode);
            const loggedOnly = mode === true && queueStatusWentOut(item.status);
            const reason = reminderReason(item);
            return (
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
                  <span className="flex flex-wrap items-center gap-1">
                    <QueueStatusBadge status={item.status} mode={mode} />
                    {loggedOnly && <TestModeBadge />}
                  </span>
                  {reason && (
                    <span className="mt-1 block max-w-[14rem] text-xs text-muted-foreground">{reason}</span>
                  )}
                  {item.attempts > 1 && (
                    <span className="block text-xs text-muted-foreground">{item.attempts} attempts</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
