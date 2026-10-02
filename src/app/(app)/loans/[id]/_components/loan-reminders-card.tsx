"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import {
  BellRing,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  CircleSlash,
  PauseCircle,
  PlayCircle,
  Send,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { CollapsibleCard } from "@/components/common/collapsible-card";
import { DataState } from "@/components/common/data-state";
import { PermissionButton } from "@/components/common/permission-button";
import { PauseDialog } from "@/components/reminders/pause-dialog";
import { SendReminderDialog } from "@/components/reminders/send-reminder-dialog";
import { useApiResource, usePermission } from "@/hooks";
import { formatCurrencyExact, formatDate, formatDateTime } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { reminderService } from "@/services";
import type { LoanReminderSummary, ReminderTimelineEventKind } from "@/types/reminder";

const EVENT_STYLE: Record<ReminderTimelineEventKind, { icon: LucideIcon; tone: string }> = {
  scheduled: { icon: CalendarClock, tone: "text-blue-600" },
  sent: { icon: Send, tone: "text-blue-600" },
  delivered: { icon: CheckCircle2, tone: "text-green-600" },
  failed: { icon: XCircle, tone: "text-red-600" },
  cancelled: { icon: CircleSlash, tone: "text-muted-foreground" },
  skipped: { icon: CircleSlash, tone: "text-amber-600" },
  payment_received: { icon: CircleDollarSign, tone: "text-green-600" },
  paused: { icon: PauseCircle, tone: "text-amber-600" },
  resumed: { icon: PlayCircle, tone: "text-green-600" },
  manual_sent: { icon: Send, tone: "text-indigo-600" },
};

function Summary({ data }: { data: LoanReminderSummary }) {
  const pause = data.pause ?? data.inherited_pause;
  return (
    <div className="space-y-4">
      <dl className="grid gap-3 text-sm sm:grid-cols-3">
        <div className="rounded-lg border p-3">
          <dt className="text-xs text-muted-foreground">Next due date</dt>
          <dd className="font-medium">{data.next_due_date ? formatDate(data.next_due_date) : "—"}</dd>
        </div>
        <div className="rounded-lg border p-3">
          <dt className="text-xs text-muted-foreground">Amount due</dt>
          <dd className="font-medium tabular-nums">
            {data.next_amount_due !== null ? formatCurrencyExact(data.next_amount_due) : "—"}
          </dd>
        </div>
        <div className="rounded-lg border p-3">
          <dt className="text-xs text-muted-foreground">Next reminder</dt>
          <dd className="font-medium">
            {pause ? "Paused" : data.next_reminder_at ? formatDateTime(data.next_reminder_at) : "None scheduled"}
          </dd>
        </div>
      </dl>

      {pause && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
          {pause.scope === "loan"
            ? "Reminders for this loan are paused"
            : pause.scope === "borrower"
              ? "Reminders for this borrower are paused"
              : "All automated reminders are paused"}{" "}
          by {pause.paused_by_name} on {formatDate(pause.paused_at)} — {pause.reason}
        </p>
      )}

      {data.events.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">No reminders for this loan yet.</p>
      ) : (
        <ol className="relative space-y-3 border-l pl-5">
          {data.events.map((e) => {
            const { icon: Icon, tone } = EVENT_STYLE[e.kind] ?? EVENT_STYLE.scheduled;
            return (
              <li key={e.id} className="relative">
                <span className="absolute top-0.5 -left-[1.95rem] rounded-full bg-background p-0.5">
                  <Icon className={cn("h-4 w-4", tone)} />
                </span>
                <p className="text-sm font-medium">{e.title}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(e.at)}
                  {e.installment_number ? ` · installment #${e.installment_number}` : ""}
                </p>
                {e.detail && <p className="text-xs text-muted-foreground">{e.detail}</p>}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function LoanRemindersContent({ loanId }: { loanId: number }) {
  const fetcher = useCallback(() => reminderService.getLoanReminders(loanId), [loanId]);
  const summary = useApiResource(fetcher);
  const [sendOpen, setSendOpen] = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [resuming, setResuming] = useState(false);
  const loanPause = summary.data?.pause ?? null;

  const resume = () => {
    setResuming(true);
    reminderService
      .resume({ scope: "loan", loan_id: loanId })
      .then(() => {
        setResuming(false);
        notifySuccess("Reminders resumed for this loan");
        summary.refetch();
      })
      .catch((err) => {
        setResuming(false);
        notifyError(err, "Could not resume reminders.");
      });
  };

  return (
    <CollapsibleCard
      icon={<BellRing className="h-4 w-4 text-muted-foreground" />}
      title="Reminders"
      defaultOpen={false}
      headerExtra={
        summary.data && (
          <div className="flex flex-wrap gap-2">
            {loanPause ? (
              <PermissionButton permission="reminders:pause" size="sm" variant="outline" onClick={resume} disabled={resuming}>
                <PlayCircle className="mr-1 h-3.5 w-3.5" /> {resuming ? "Resuming…" : "Resume"}
              </PermissionButton>
            ) : (
              <PermissionButton permission="reminders:pause" size="sm" variant="outline" onClick={() => setPauseOpen(true)}>
                <PauseCircle className="mr-1 h-3.5 w-3.5" /> Pause
              </PermissionButton>
            )}
            <PermissionButton permission="reminders:send" size="sm" onClick={() => setSendOpen(true)}>
              <Send className="mr-1 h-3.5 w-3.5" /> Send reminder
            </PermissionButton>
          </div>
        )
      }
    >
      <DataState
        resource={summary}
        summary="This loan's reminder timeline — scheduled, sent, delivered, and cancelled once paid — will appear here once the reminder service is connected."
        endpoints={[`GET /loans/${loanId}/reminders`]}
      >
        {(data) => (
          <div className="space-y-3">
            <Summary data={data} />
            <Link
              href="/loans/reminders/history"
              className="inline-block text-xs text-brand-orange hover:underline"
            >
              All message history
            </Link>
          </div>
        )}
      </DataState>

      <SendReminderDialog
        open={sendOpen}
        onOpenChange={setSendOpen}
        loanId={loanId}
        defaultTemplate={summary.data?.suggested_template_type ?? null}
        onSent={summary.refetch}
      />
      <PauseDialog
        open={pauseOpen}
        onOpenChange={setPauseOpen}
        scope="loan"
        loanId={loanId}
        targetLabel="this loan"
        onPaused={summary.refetch}
      />
    </CollapsibleCard>
  );
}

/**
 * The loan's reminder story, plus manual send and a loan-only pause. Renders
 * nothing — and requests nothing — without `reminders:view`.
 */
export function LoanRemindersCard({ loanId }: { loanId: number }) {
  const { can } = usePermission();
  if (!can("reminders:view")) return null;
  return <LoanRemindersContent loanId={loanId} />;
}
