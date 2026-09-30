"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { AlertCircle, Inbox, RefreshCw, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { formatCurrencyExact, formatDate } from "@/lib/format";
import { restructureSuccessor } from "@/lib/loan-restructure";
import type { Loan } from "@/types/loan";

/** Where the schedule request stands. Rows only ever come from `loaded`. */
export type ScheduleLoad = "loading" | "failed" | "loaded";

interface ScheduleNoticeProps {
  /** `loaded` here means the server answered with no instalments. */
  load: ScheduleLoad;
  loan: Loan;
  onRetry: () => void;
}

function Notice({
  icon,
  title,
  role,
  action,
  children,
}: {
  icon: ReactNode;
  title: string;
  role?: "alert";
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      role={role}
      className="rounded-lg border border-dashed bg-muted/30 p-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
    >
      <div className="flex items-start gap-2">
        {icon}
        <div className="text-sm space-y-1">
          <p className="font-medium">{title}</p>
          {children}
        </div>
      </div>
      {action}
    </div>
  );
}

function RestructuredNotice({ loan }: { loan: Loan }) {
  const successor = restructureSuccessor(loan.restructured_into);
  const writeOff = loan.write_off_amount ?? 0;
  return (
    <Notice
      icon={<Shuffle className="h-4 w-4 text-orange-600 mt-0.5 shrink-0" />}
      title="No instalments — this loan was restructured"
    >
      <p className="text-muted-foreground">
        {loan.restructured_at
          ? `This loan was restructured on ${formatDate(loan.restructured_at)}`
          : "This loan was restructured"}
        , and its remaining balance
        {loan.restructured_balance != null && (
          <>
            {" "}of{" "}
            <span className="font-medium text-foreground tabular-nums">
              {formatCurrencyExact(loan.restructured_balance)}
            </span>
          </>
        )}{" "}
        moved to{" "}
        {successor ? (
          <>
            loan{" "}
            <Link
              href={`/loans/${successor.id}`}
              className="font-mono font-medium text-brand-orange hover:underline"
            >
              {successor.loan_account_number || successor.application_number}
            </Link>
          </>
        ) : (
          "a new loan"
        )}
        {writeOff > 0 && (
          <>
            , less{" "}
            <span className="font-medium text-foreground tabular-nums">
              {formatCurrencyExact(writeOff)}
            </span>{" "}
            written off
          </>
        )}
        .
      </p>
      {!successor && (
        <p className="text-muted-foreground">
          That loan could not be found on this loan&apos;s record, so it cannot
          be linked here.
        </p>
      )}
    </Notice>
  );
}

/**
 * What the Amortization Schedule card shows where its rows would be: the
 * request is still out, it failed, or the server answered with no instalments.
 *
 * Never a stand-in schedule. Loan screens show only figures that come from the
 * server, so a schedule the page could not read is reported as unavailable
 * rather than rebuilt in the browser from the loan's terms.
 */
export function ScheduleNotice({ load, loan, onRetry }: ScheduleNoticeProps) {
  if (load === "loading") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground"
      >
        <Spinner className="size-4" />
        Loading the schedule&hellip;
      </div>
    );
  }

  if (load === "failed") {
    return (
      <Notice
        role="alert"
        icon={<AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />}
        title="Schedule unavailable"
        action={
          <Button variant="outline" size="sm" className="w-full sm:w-auto shrink-0" onClick={onRetry}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        }
      >
        <p className="text-muted-foreground">
          We couldn&apos;t load this loan&apos;s schedule from the server, so no
          instalments or schedule totals are shown. Nothing on the loan has
          changed.
        </p>
      </Notice>
    );
  }

  if (loan.status === "restructured") return <RestructuredNotice loan={loan} />;

  return (
    <Notice
      icon={<Inbox className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />}
      title="No instalments"
    >
      <p className="text-muted-foreground">
        The server returned no instalments for this loan.
      </p>
    </Notice>
  );
}

/**
 * What a restructure's release recorded on the loan it closed, in the style of
 * the Balances tab's summary strip. Nothing for any other loan.
 */
export function RestructuredBalanceFigures({ loan }: { loan: Loan }) {
  if (loan.status !== "restructured" || loan.restructured_balance == null) return null;
  return (
    <div className="flex flex-wrap gap-4 px-1">
      <div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Restructured Balance</p>
        <p className="text-base font-bold tabular-nums">
          {formatCurrencyExact(loan.restructured_balance)}
        </p>
      </div>
      {loan.write_off_amount != null && (
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Written Off</p>
          <p className="text-base font-bold tabular-nums">
            {formatCurrencyExact(loan.write_off_amount)}
          </p>
        </div>
      )}
    </div>
  );
}
