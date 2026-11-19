"use client";

import Link from "next/link";
import { useState } from "react";
import { AmlaNoteDialog, type AmlaNoteAction } from "@/components/amla/amla-note-dialog";
import { DataState } from "@/components/common/data-state";
import { PageFill, ScrollBox } from "@/components/common/page-fill";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiResource, usePermission } from "@/hooks";
import { once } from "@/lib/amla/once";
import { amlaReleaseActions } from "@/lib/amla/screening-access";
import { amlaScreeningApi } from "@/lib/amla/screening-api";
import { amlaOrderLines, amlaOrderRow } from "@/lib/amla/screening-view";
import { useAuthStore } from "@/store";
import type { AmlaOrderDetail } from "@/types/amla-screening";
import { ReleaseRequestDialog } from "./release-request-dialog";

/** One order: what it requires, its holds and its release, with only the steps the server allows this user. Read once. */
export function OrderDetail({ id }: { id: number }) {
  const [fetcher, setFetcher] = useState(() => once(() => amlaScreeningApi.order(id)));
  const resource = useApiResource(fetcher);
  return (
    <PageFill>
      <Link href="/amla/orders" className="shrink-0 text-sm text-muted-foreground underline-offset-4 hover:underline">
        Back to the Orders Register
      </Link>
      <DataState resource={resource} summary="This order, its holds and its release." endpoints={["GET /amla/orders/{id}"]}>
        {(order) => <OrderBody order={order} onChanged={() => setFetcher(() => once(() => amlaScreeningApi.order(id)))} />}
      </DataState>
    </PageFill>
  );
}

function OrderBody({ order, onChanged }: { order: AmlaOrderDetail; onChanged: () => void }) {
  const { can } = usePermission();
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const row = amlaOrderRow(order);
  const lines = amlaOrderLines(order);
  const actions = amlaReleaseActions(order, userId, can);
  const [action, setAction] = useState<AmlaNoteAction | null>(null);
  const [requesting, setRequesting] = useState(false);

  const decide = (kind: "approve" | "reject" | "withdraw") =>
    setAction(
      {
        approve: {
          title: "Approve this release?",
          description: "Every hold the order placed is lifted at once, and the order reads Released.",
          label: "Note",
          required: false,
          confirmLabel: "Approve the release",
          destructive: true,
          success: "Order released",
          failure: "The release couldn't be approved.",
          run: (note: string) => amlaScreeningApi.approveRelease(order.id, note),
        },
        reject: {
          title: "Reject this release?",
          description: "The order stays in force with its holds. Say why.",
          label: "Note",
          required: true,
          confirmLabel: "Reject the release",
          success: "Release rejected",
          failure: "The release couldn't be rejected.",
          run: (note: string) => amlaScreeningApi.rejectRelease(order.id, note),
        },
        withdraw: {
          title: "Withdraw your release request?",
          description: "The order stays in force with its holds.",
          label: "Note",
          required: false,
          confirmLabel: "Withdraw",
          success: "Release request withdrawn",
          failure: "The request couldn't be withdrawn.",
          run: (note: string) => amlaScreeningApi.withdrawRelease(order.id, note),
        },
      }[kind],
    );

  return (
    <ScrollBox className="space-y-4 p-px">
      <div className="space-y-1">
        <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
          {order.reference}
          <Badge variant={row.active ? "secondary" : "outline"}>{row.status}</Badge>
        </h1>
        <p className="text-sm text-muted-foreground">
          {row.member} · {row.code}
        </p>
      </div>
      {lines.pending && <p className="rounded-md border bg-muted/40 p-3 text-sm">{lines.pending}</p>}
      {lines.released && <p className="rounded-md border bg-muted/40 p-3 text-sm">{lines.released}</p>}

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">The order</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[minmax(0,10rem)_1fr]">
              {lines.facts.map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="whitespace-pre-line">{value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Savings holds</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {lines.holds.length === 0 ? (
              <p className="text-muted-foreground">This order placed no savings holds.</p>
            ) : (
              lines.holds.map((hold) => <p key={hold}>{hold}</p>)
            )}
            <p className="pt-2 text-muted-foreground">Savings staff see these holds only as &quot;Held under a legal order&quot;.</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        {actions.request && (
          <Button variant="outline" onClick={() => setRequesting(true)}>
            Ask to release this order
          </Button>
        )}
        {actions.approve && (
          <Button variant="destructive" onClick={() => decide("approve")}>
            Approve the release
          </Button>
        )}
        {actions.reject && (
          <Button variant="outline" onClick={() => decide("reject")}>
            Reject the release
          </Button>
        )}
        {actions.withdraw && (
          <Button variant="outline" onClick={() => decide("withdraw")}>
            Withdraw my request
          </Button>
        )}
      </div>

      <ReleaseRequestDialog
        open={requesting}
        orderId={order.id}
        onClose={() => setRequesting(false)}
        onRequested={() => {
          setRequesting(false);
          onChanged();
        }}
      />
      <AmlaNoteDialog
        action={action}
        onClose={() => setAction(null)}
        onDone={() => {
          setAction(null);
          onChanged();
        }}
      />
    </ScrollBox>
  );
}
