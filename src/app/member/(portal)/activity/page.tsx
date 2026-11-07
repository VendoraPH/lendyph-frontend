"use client";

import { useCallback, useState } from "react";
import { TablePagination } from "@/components/common";
import { DataState } from "@/components/common/data-state";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useApiResource } from "@/hooks/use-api-resource";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { ACTIVITY_KINDS, groupActivityByDay } from "@/lib/portal/engagement";
import { portalService } from "@/services/portal.service";
import type { ActivityItem } from "@/types/portal";
import { PortalPageHeader } from "../../_components/portal-shell";

type Kind = ActivityItem["kind"];

/** Everything that happened on the member's accounts, newest first, paged on the server. */
export default function MemberActivityPage() {
  const [kind, setKind] = useState<Kind | "">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const fetcher = useCallback(
    () =>
      portalService.activity({
        page,
        per_page: perPage,
        kind: kind || undefined,
        from: from || undefined,
        to: to || undefined,
      }),
    [page, perPage, kind, from, to],
  );
  const resource = useApiResource(fetcher);
  const filter = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(1);
  };

  return (
    <>
      <PortalPageHeader title="Activity" description="Payments, deposits, loans and requests on your accounts." />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="activity-kind">Type</Label>
          <NativeSelect id="activity-kind" value={kind} onChange={(e) => filter(setKind)(e.target.value as Kind | "")}>
            <NativeSelectOption value="">Everything</NativeSelectOption>
            {(Object.keys(ACTIVITY_KINDS) as Kind[]).map((k) => (
              <NativeSelectOption key={k} value={k}>
                {ACTIVITY_KINDS[k]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="activity-from">From</Label>
          <Input id="activity-from" type="date" value={from} max={to || undefined} onChange={(e) => filter(setFrom)(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="activity-to">To</Label>
          <Input id="activity-to" type="date" value={to} min={from || undefined} onChange={(e) => filter(setTo)(e.target.value)} />
        </div>
      </div>
      <DataState
        resource={resource}
        endpoints={["GET /portal/activity"]}
        summary="Your account activity will show here once online access is connected."
        isEmpty={(body) => body.data.length === 0}
        emptyMessage="No activity for this selection."
      >
        {(body) => (
          <div className="space-y-4">
            {groupActivityByDay(body.data).map((day) => (
              <section key={day.key} aria-label={formatDate(day.key)}>
                <h2 className="mb-2 text-sm font-medium text-muted-foreground">{formatDate(day.key)}</h2>
                <Card>
                  <CardContent className="divide-y p-0">
                    {day.rows.map((item) => (
                      <div key={item.id} className="flex items-start gap-3 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm">{item.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {ACTIVITY_KINDS[item.kind] ?? "Other"}
                            {item.date.length > 10 && ` · ${formatDateTime(item.date)}`}
                          </p>
                        </div>
                        {item.amount !== null && (
                          <span className="shrink-0 text-sm font-medium">{formatCurrency(item.amount)}</span>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </section>
            ))}
            <TablePagination
              page={page}
              perPage={perPage}
              total={body.meta?.total ?? body.data.length}
              onPageChange={setPage}
              onPerPageChange={(n) => {
                setPerPage(n);
                setPage(1);
              }}
            />
          </div>
        )}
      </DataState>
    </>
  );
}
