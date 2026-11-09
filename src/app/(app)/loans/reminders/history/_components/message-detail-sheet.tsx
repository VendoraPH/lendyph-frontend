"use client";

import Link from "next/link";
import { DeliveryStatusBadge, TestModeBadge } from "@/components/reminders/reminder-status-badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { usePermission } from "@/hooks";
import { formatCurrencyExact, formatDateTime } from "@/lib/format";
import {
  CHANNEL_LABELS,
  TEMPLATE_TYPE_LABELS,
  deliveryStatusWentOut,
  isMessageRedacted,
  messageSourceLabel,
  recipientLabel,
  reminderReason,
  rowTestMode,
  type SendMode,
} from "@/lib/reminders";
import type { ReminderMessage } from "@/types/reminder";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right break-words">{children ?? "—"}</dd>
    </>
  );
}

/**
 * One message, exactly as it was handed over (or, in test mode, logged).
 * History rows are never edited.
 */
export function MessageDetailSheet({
  message,
  testMode,
  onOpenChange,
}: {
  message: ReminderMessage | null;
  testMode: SendMode;
  onOpenChange: (open: boolean) => void;
}) {
  const canSeeContacts = usePermission().can("borrowers:view");
  const mode = message ? rowTestMode(message, testMode) : null;
  const wentOut = message !== null && deliveryStatusWentOut(message.status);
  const loggedOnly = wentOut && mode === true;
  const redacted = message !== null && isMessageRedacted(message);
  // A failed message always has a reason; without its text the server hid it.
  const failure = message
    ? reminderReason(
        { reason: message.failure_reason },
        { failed: ["failed", "rejected", "bounced"].includes(message.status) },
      )
    : null;
  return (
    <Sheet open={message !== null} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="overflow-y-auto sm:max-w-md">
        {message && (
          <>
            <SheetHeader>
              <SheetTitle>{CHANNEL_LABELS[message.channel]} to {message.borrower_name}</SheetTitle>
              <SheetDescription>
                <Link href={`/loans/${message.loan_id}`} className="text-brand-orange hover:underline">
                  {message.loan_account_number}
                </Link>
                {message.installment_number ? ` · installment #${message.installment_number}` : ""}
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-4 px-4 pb-6">
              <div className="flex items-center gap-2">
                <DeliveryStatusBadge status={message.status} mode={mode} />
                {loggedOnly && <TestModeBadge />}
                <span className="text-xs text-muted-foreground">{messageSourceLabel(message, testMode)}</span>
              </div>

              {failure && (
                <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  {failure}
                </p>
              )}

              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {(loggedOnly ? "Logged, not sent" : mode === false && wentOut ? "Message sent" : "Message") +
                    (message.recipient || !canSeeContacts
                      ? ` · ${recipientLabel(message.recipient, canSeeContacts)}`
                      : "")}
                </p>
                {redacted ? (
                  <p className="text-sm italic text-muted-foreground">Message text removed after 2 years</p>
                ) : (
                  <>
                    {message.subject && <p className="mb-1 text-sm font-medium">{message.subject}</p>}
                    <p className="whitespace-pre-wrap text-sm">{message.body}</p>
                  </>
                )}
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                <Row label="Template">{message.template_type ? TEMPLATE_TYPE_LABELS[message.template_type] : null}</Row>
                <Row label="Scheduled">{message.scheduled_at ? formatDateTime(message.scheduled_at) : null}</Row>
                <Row label={loggedOnly ? "Logged" : mode === false ? "Sent" : "Handled"}>{message.sent_at ? formatDateTime(message.sent_at) : null}</Row>
                <Row label={mode === false ? "Delivered" : "Confirmed"}>{message.delivered_at ? formatDateTime(message.delivered_at) : null}</Row>
                <Row label="Attempts">{message.attempts}</Row>
                <Row label="Provider">{message.provider}</Row>
                <Row label="Provider reference">
                  {message.provider_reference && (
                    <span className="font-mono text-xs">{message.provider_reference}</span>
                  )}
                </Row>
                {message.segments != null && <Row label="SMS parts">{message.segments}</Row>}
                {message.cost != null && <Row label="Cost">{formatCurrencyExact(message.cost)}</Row>}
              </dl>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
