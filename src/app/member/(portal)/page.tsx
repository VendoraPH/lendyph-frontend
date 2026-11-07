"use client";

import { useCallback } from "react";
import Link from "next/link";
import { Bell, CalendarClock, FileText, Inbox, Megaphone } from "lucide-react";
import { DataState } from "@/components/common/data-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiResource } from "@/hooks/use-api-resource";
import { formatCurrency, formatDate } from "@/lib/format";
import { greeting } from "@/lib/portal/greeting";
import { humanize, membershipTone, TONE_CLASS } from "@/lib/portal/labels";
import { usePortalSession } from "@/lib/portal/portal-session";
import { portalService } from "@/services/portal.service";
import type { DashboardCardKey, PortalDashboard, PortalFeatures } from "@/types/portal";
import { usePortalConfig } from "../_components/portal-config";
import { StatusPill } from "../_components/portal-shell";

/** Which feature switch hides each balance card. */
const CARD_FEATURE: Partial<Record<DashboardCardKey, keyof PortalFeatures>> = {
  share_capital: "share_capital",
  savings: "savings",
  time_deposits: "time_deposits",
  loans: "loans",
  next_payment: "loans",
};

export default function MemberDashboardPage() {
  const member = usePortalSession((s) => s.member);
  const fetcher = useCallback(() => portalService.dashboard(), []);
  const resource = useApiResource(fetcher);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">{greeting(member?.first_name ?? "", new Date())}</h1>
        <p className="text-sm text-muted-foreground">Here is a summary of your accounts.</p>
      </div>
      <DataState
        resource={resource}
        endpoints={["GET /portal/dashboard"]}
        summary="Your balances, next payment and recent activity will show here once online access is connected."
      >
        {(data) => <DashboardBody data={data} />}
      </DataState>
    </div>
  );
}

function DashboardBody({ data }: { data: PortalDashboard }) {
  const { config } = usePortalConfig();
  const shows = (key: DashboardCardKey) => {
    const feature = CARD_FEATURE[key];
    return config.dashboard_cards.includes(key) && (!feature || config.features[feature] !== false);
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-2 p-4 text-sm">
          <span>
            Member no. <span className="font-medium">{data.member.member_number}</span>
          </span>
          {data.member.member_since && <span>Member since {formatDate(data.member.member_since)}</span>}
          {data.member.branch_name && <span>{data.member.branch_name}</span>}
          <StatusPill className={TONE_CLASS[membershipTone(data.member.status)]}>
            {humanize(data.member.status)}
          </StatusPill>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {shows("share_capital") && data.share_capital && (
          <Balance href="/member/share-capital" label="Share capital" value={formatCurrency(data.share_capital.total)} />
        )}
        {shows("savings") && data.savings && (
          <Balance
            href="/member/savings"
            label="Savings"
            value={formatCurrency(data.savings.total)}
            note={`${formatCurrency(data.savings.available)} available`}
          />
        )}
        {shows("time_deposits") && data.time_deposits && (
          <Balance
            href="/member/savings"
            label="Time deposits"
            value={formatCurrency(data.time_deposits.total)}
            note={`${data.time_deposits.count} ${data.time_deposits.count === 1 ? "deposit" : "deposits"}`}
          />
        )}
        {shows("loans") && data.loans && (
          <Balance
            href="/member/loans"
            label="Loan balance"
            value={formatCurrency(data.loans.outstanding)}
            note={`${data.loans.active_count} active ${data.loans.active_count === 1 ? "loan" : "loans"}`}
          />
        )}
      </div>

      {shows("next_payment") && data.next_payment && (
        <Card className="border-brand-orange/40">
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <CalendarClock className="h-6 w-6 shrink-0 text-brand-orange" aria-hidden />
            <div>
              <p className="text-sm text-muted-foreground">Next payment · Loan {data.next_payment.loan_number}</p>
              <p className="font-semibold">
                {formatCurrency(data.next_payment.amount)} due {formatDate(data.next_payment.due_date)}
              </p>
            </div>
            <Link href="/member/loans" className="ml-auto text-sm font-medium text-brand-orange hover:underline">
              View loans
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-3">
        <Counter icon={Inbox} label="Pending requests" value={data.pending_requests} />
        <Counter icon={Bell} label="Unread notices" value={data.unread_notifications} />
        <Counter icon={FileText} label="Documents" value={data.documents} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            {data.recent_activity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent transactions.</p>
            ) : (
              <ul className="divide-y">
                {data.recent_activity.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="truncate">{a.description}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(a.date)}</p>
                    </div>
                    {a.amount !== null && <span className="shrink-0 font-medium">{formatCurrency(a.amount)}</span>}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {shows("announcements") && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Megaphone className="h-4 w-4" aria-hidden /> Announcements
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.announcements.length === 0 ? (
                <p className="text-sm text-muted-foreground">No announcements right now.</p>
              ) : (
                <ul className="divide-y">
                  {data.announcements.map((n) => (
                    <li key={n.id} className="py-2.5 text-sm">
                      <p className="font-medium">{n.title}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(n.published_at)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Balances are as of your cooperative&apos;s last posting. Questions about a figure?{" "}
        <Link href="/member/membership" className="underline">
          Contact your branch
        </Link>
        .
      </p>
    </div>
  );
}

function Balance({ href, label, value, note }: { href: string; label: string; value: string; note?: string }) {
  return (
    <Link href={href} className="block">
      <Card className="h-full transition-colors hover:bg-muted/40">
        <CardContent className="space-y-1 p-4">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-lg font-semibold tabular-nums">{value}</p>
          {note && <p className="text-xs text-muted-foreground">{note}</p>}
        </CardContent>
      </Card>
    </Link>
  );
}

function Counter({ icon: Icon, label, value }: { icon: typeof Bell; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-1 p-3 text-center">
        <Icon className="h-5 w-5 text-muted-foreground" aria-hidden />
        <span className="text-lg font-semibold">{value}</span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </CardContent>
    </Card>
  );
}
