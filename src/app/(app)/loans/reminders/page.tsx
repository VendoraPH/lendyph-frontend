"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock,
  Mail,
  MessageSquare,
  Send,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DataState } from "@/components/common/data-state";
import { useReminderTestModeContext } from "@/components/reminders/test-mode";
import { Card, CardContent } from "@/components/ui/card";
import { useApiResource, useIsClient } from "@/hooks";
import { formatCurrencyExact, formatDate, todayISO } from "@/lib/format";
import { kpiLabel, queueStatusOptions } from "@/lib/reminders";
import { reminderService } from "@/services";
import type { ReminderDashboard, ReminderListFilters } from "@/types/reminder";
import { QueueTable } from "./_components/queue-table";
import { ReminderFilters, StatusSelect } from "./_components/reminder-filters";

/** Labels come from `kpiLabel`, so test mode never counts a message as sent. */
const KPIS: { key: keyof ReminderDashboard["counts"]; icon: LucideIcon; tone: string }[] = [
  { key: "today", icon: CalendarClock, tone: "text-blue-600" },
  { key: "sent", icon: CheckCircle2, tone: "text-green-600" },
  { key: "pending", icon: Clock, tone: "text-amber-600" },
  { key: "failed", icon: XCircle, tone: "text-red-600" },
  { key: "sms_sent", icon: MessageSquare, tone: "text-indigo-600" },
  { key: "emails_sent", icon: Mail, tone: "text-indigo-600" },
  { key: "upcoming_due", icon: Send, tone: "text-blue-600" },
  { key: "overdue", icon: AlertTriangle, tone: "text-red-600" },
];

function Kpi({ label, value, icon: Icon, tone }: { label: string; value: number; icon: LucideIcon; tone: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-4">
      <Icon className={`h-5 w-5 shrink-0 ${tone}`} />
      <div className="min-w-0">
        <p className="truncate text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-semibold tabular-nums">{value.toLocaleString("en-PH")}</p>
      </div>
    </div>
  );
}

function SmsCreditsCard({ sms, testMode }: { sms: ReminderDashboard["sms"]; testMode: boolean }) {
  const low =
    sms.credits_remaining !== null &&
    sms.low_credit_threshold !== null &&
    sms.credits_remaining <= sms.low_credit_threshold;
  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <p className="text-sm font-medium">SMS usage this month</p>
        <dl className="grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-muted-foreground">{testMode ? "Messages logged" : "Messages sent"}</dt>
          <dd className="text-right tabular-nums">{sms.sent_this_month.toLocaleString("en-PH")}</dd>
          <dt className="text-muted-foreground">Estimated cost</dt>
          <dd className="text-right tabular-nums">{formatCurrencyExact(sms.estimated_cost_this_month)}</dd>
          <dt className="text-muted-foreground">Credits remaining</dt>
          <dd className="text-right tabular-nums">
            {sms.credits_remaining === null ? "—" : sms.credits_remaining.toLocaleString("en-PH")}
          </dd>
        </dl>
        {low && (
          <p className="flex items-center gap-1.5 rounded-lg bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5" />
            SMS credits are low. Reminders stop sending when they run out.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function DeliveryChart({ daily, testMode }: { daily: ReminderDashboard["daily"]; testMode: boolean }) {
  const isClient = useIsClient();
  const rows = daily.map((d) => ({ ...d, label: formatDate(d.date) }));
  return (
    <Card className="lg:col-span-2">
      <CardContent className="pt-6">
        <p className="mb-2 text-sm font-medium">Delivery, last 7 days</p>
        {daily.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {testMode ? "No reminders logged in the last 7 days." : "No reminders sent in the last 7 days."}
          </p>
        ) : (
          <div className="h-56">
            {isClient && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" fontSize={11} tickLine={false} />
                  <YAxis allowDecimals={false} fontSize={11} tickLine={false} width={32} />
                  <Tooltip />
                  <Bar dataKey="delivered" name="Delivered" stackId="a" fill="#10b981" />
                  <Bar dataKey="sent" name={testMode ? "Logged" : "Sent"} stackId="a" fill="#60a5fa" />
                  <Bar dataKey="failed" name="Failed" stackId="a" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DashboardBody({ data, testMode }: { data: ReminderDashboard; testMode: boolean | null }) {
  const inTestMode = testMode === true;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {KPIS.map((k) => (
          <Kpi key={k.key} label={kpiLabel(k.key, inTestMode)} value={data.counts[k.key] ?? 0} icon={k.icon} tone={k.tone} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <DeliveryChart daily={data.daily} testMode={inTestMode} />
        <SmsCreditsCard sms={data.sms} testMode={inTestMode} />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Reminder status</p>
          <Link href="/loans/reminders/queue" className="text-sm text-brand-orange hover:underline">
            Open full queue
          </Link>
        </div>
        {data.items.length === 0 ? (
          <p className="rounded-xl border py-10 text-center text-sm text-muted-foreground">
            No reminders for this selection.
          </p>
        ) : (
          <QueueTable items={data.items} testMode={testMode} />
        )}
      </div>
    </div>
  );
}

export default function RemindersDashboardPage() {
  const [filters, setFilters] = useState<ReminderListFilters>(() => ({ date: todayISO() }));
  // Only the dashboard's own filters; paging and ranges belong to the lists.
  const fetcher = useCallback(() => {
    const { date, branch_id, channel, status, loan_product_id, search } = filters;
    return reminderService.getDashboard({ date, branch_id, channel, status, loan_product_id, search });
  }, [filters]);
  const resource = useApiResource(fetcher);
  const { testMode } = useReminderTestModeContext();

  return (
    <div className="space-y-4">
      <ReminderFilters value={filters} onChange={setFilters} dates="day">
        <StatusSelect
          value={filters.status}
          options={queueStatusOptions(testMode === true)}
          onChange={(status) => setFilters((f) => ({ ...f, status }))}
        />
      </ReminderFilters>
      <DataState
        resource={resource}
        summary="The reminders dashboard will show today's reminders, delivery results and SMS usage once the reminder service is connected."
        endpoints={["GET /reminders/dashboard", "GET /reminders/pauses"]}
      >
        {(data) => <DashboardBody data={data} testMode={testMode} />}
      </DataState>
    </div>
  );
}
