"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Ban, HandCoins, Printer } from "lucide-react";
import { DataState } from "@/components/common/data-state";
import { PermissionButton } from "@/components/common/permission-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiResource } from "@/hooks";
import { formatCurrency, formatDate, formatRate, todayISO } from "@/lib/format";
import { savingsService } from "@/services";
import type { TimeDeposit } from "@/types";
import {
  MATURITY_INSTRUCTION_LABELS,
  canPreterminate,
  canSettle,
  maturityHint,
  termLabel,
} from "../../../_lib/time-deposit-rules";
import { TdStatusBadge } from "../../_components/td-status-badge";
import { printTimeDepositCertificate } from "../_lib/print-certificate";
import { PreterminateDialog } from "./preterminate-dialog";
import { SettleDialog } from "./settle-dialog";

export function TimeDepositDetail({ depositId }: { depositId: number }) {
  const router = useRouter();
  const fetcher = useCallback(() => savingsService.timeDeposit(depositId), [depositId]);
  const resource = useApiResource(fetcher);
  const [settling, setSettling] = useState(false);
  const [breaking, setBreaking] = useState(false);
  const [printing, setPrinting] = useState(false);

  function print(td: TimeDeposit) {
    setPrinting(true);
    printTimeDepositCertificate(td).then(() => setPrinting(false));
  }

  function settled(next: TimeDeposit) {
    // A rollover hands back the new placement; follow it.
    if (next.id !== depositId) router.push(`/savings/time-deposits/${next.id}`);
    else resource.refetch();
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/savings/time-deposits" />}>
        <ArrowLeft className="h-4 w-4" /> Time deposits
      </Button>

      <DataState
        resource={resource}
        endpoints={["GET /savings/time-deposits/{id}"]}
        summary="This placement's terms, maturity and certificate will show here once the backend is connected."
      >
        {(td) => {
          const today = todayISO();
          const settleable = canSettle(td, today);
          const breakable = canPreterminate(td, today);
          return (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-semibold tracking-tight">{td.certificate_number}</h1>
                    <TdStatusBadge status={td.status} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    <Link href={`/borrowers/${td.borrower_id}`} className="font-medium text-foreground hover:underline">
                      {td.borrower_name ?? "Member"}
                    </Link>
                    {td.borrower_code && ` · ${td.borrower_code}`} · {td.product.name}
                    {td.branch_name && ` · ${td.branch_name}`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => print(td)} disabled={printing}>
                    <Printer className="h-4 w-4" /> {printing ? "Preparing…" : "Print certificate"}
                  </Button>
                  {(td.status === "active" || td.status === "matured") && (
                    <>
                      <PermissionButton
                        permission="savings:transact"
                        onClick={() => setSettling(true)}
                        disabled={!settleable}
                        title={settleable ? undefined : `Settles on or after ${formatDate(td.maturity_date)}.`}
                      >
                        <HandCoins className="h-4 w-4" /> Settle at maturity
                      </PermissionButton>
                      <PermissionButton
                        permission="savings:close"
                        variant="outline"
                        onClick={() => setBreaking(true)}
                        disabled={!breakable}
                        title={breakable ? undefined : "Only a running placement can be pre-terminated."}
                      >
                        <Ban className="h-4 w-4" /> Pre-terminate
                      </PermissionButton>
                    </>
                  )}
                </div>
              </div>

              <Figures td={td} today={today} />
              <Terms td={td} />

              <SettleDialog open={settling} deposit={td} onOpenChange={setSettling} onSettled={settled} />
              <PreterminateDialog open={breaking} deposit={td} onOpenChange={setBreaking} onDone={() => resource.refetch()} />
            </>
          );
        }}
      </DataState>
    </div>
  );
}

function Figures({ td, today }: { td: TimeDeposit; today: string }) {
  const hint = maturityHint(td, today);
  const items = [
    { label: "Principal", value: formatCurrency(td.principal), strong: true },
    { label: "Rate · term", value: `${formatRate(td.annual_interest_rate)}% · ${termLabel(td.term_days)}` },
    { label: "Matures on", value: formatDate(td.maturity_date), sub: hint },
    { label: "Amount at maturity", value: formatCurrency(td.maturity_amount) },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((i) => (
        <Card key={i.label}>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">{i.label}</p>
            <p className={`mt-1 tabular-nums ${i.strong ? "text-2xl font-semibold" : "text-xl font-medium"}`}>{i.value}</p>
            {i.sub && <p className="text-xs text-muted-foreground">{i.sub}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function Terms({ td }: { td: TimeDeposit }) {
  const rows: [string, React.ReactNode][] = [
    ["Placed on", formatDate(td.placement_date)],
    ["Interest for the term", formatCurrency(td.gross_interest)],
    ["Withholding tax", formatCurrency(td.withholding_tax)],
    ["Net interest", formatCurrency(td.net_interest)],
    ["At maturity", MATURITY_INSTRUCTION_LABELS[td.maturity_instruction] ?? td.maturity_instruction],
    ["Pre-termination rate", td.pretermination_rate == null ? "—" : `${formatRate(td.pretermination_rate)}% a year`],
  ];
  if (td.settled_at) rows.push(["Settled on", formatDate(td.settled_at)]);
  if (td.settled_amount != null) rows.push(["Paid to the member", formatCurrency(td.settled_amount)]);
  if (td.rolled_over_from_id)
    rows.push(["Rolled over from", <Link key="from" className="hover:underline" href={`/savings/time-deposits/${td.rolled_over_from_id}`}>Previous placement</Link>]);
  if (td.rolled_over_to_id)
    rows.push(["Rolled over into", <Link key="to" className="hover:underline" href={`/savings/time-deposits/${td.rolled_over_to_id}`}>New placement</Link>]);
  if (td.created_by_user) rows.push(["Placed by", td.created_by_user.name]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Terms</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-3 border-b pb-2">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="text-right font-medium tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
