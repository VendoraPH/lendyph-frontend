"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AmlaPager } from "@/components/amla/amla-pager";
import { DataState } from "@/components/common/data-state";
import { FillSection, PageFill, ScrollBox } from "@/components/common/page-fill";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApiResource } from "@/hooks";
import { once } from "@/lib/amla/once";
import { amlaScreeningApi } from "@/lib/amla/screening-api";
import { AMLA_ORDER_STATUS_OPTIONS, amlaOrderRow } from "@/lib/amla/screening-view";
import { RecordOrderDialog } from "./record-order-dialog";

/**
 * The register of freeze and other legal orders. Each order's holds stack on
 * any others, and only its own release, approved by a second sanctions
 * holder, lifts them. Each read is once.
 */
export function OrdersList() {
  const [filters, setFilters] = useState({ status: "active", page: 1 });
  const fetcher = useMemo(() => once(() => amlaScreeningApi.orders(filters)), [filters]);
  const resource = useApiResource(fetcher);
  const [recording, setRecording] = useState(false);

  return (
    <PageFill>
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Orders Register</h1>
          <p className="text-sm text-muted-foreground">
            Freeze and other orders from the AMLC or a court. Savings staff see an order&apos;s holds only as &quot;Held under a
            legal order&quot;.
          </p>
        </div>
        <Button onClick={() => setRecording(true)}>Record an order</Button>
      </div>
      <div className="flex shrink-0 flex-col gap-1.5 self-start">
        <Label htmlFor="amla-orders-status" className="text-xs text-muted-foreground">
          Status
        </Label>
        <NativeSelect id="amla-orders-status" value={filters.status} onChange={(e) => setFilters({ status: e.target.value, page: 1 })}>
          <NativeSelectOption value="">Every order</NativeSelectOption>
          {AMLA_ORDER_STATUS_OPTIONS.map((o) => (
            <NativeSelectOption key={o.value} value={o.value}>
              {o.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <FillSection>
        <DataState
          resource={resource}
          summary="Legal orders and their savings holds."
          endpoints={["GET /amla/orders"]}
          isEmpty={(page) => page.meta.total === 0}
          emptyMessage="No orders for this selection."
          emptyIllustration="emptyCompliance"
        >
          {(page) => (
            <>
              <ScrollBox className="min-h-0 flex-1">
                <Table className="min-w-[44rem]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order</TableHead>
                      <TableHead>Member</TableHead>
                      <TableHead>Received</TableHead>
                      <TableHead>Holds</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {page.data.map(amlaOrderRow).map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="whitespace-normal">
                          <Link href={row.href} className="font-medium whitespace-nowrap underline-offset-4 hover:underline">
                            {row.reference}
                          </Link>
                          <div className="text-xs text-muted-foreground">{row.authority}</div>
                        </TableCell>
                        <TableCell className="whitespace-normal">
                          {row.member}
                          <div className="text-xs whitespace-nowrap text-muted-foreground">{row.code}</div>
                        </TableCell>
                        <TableCell>{row.received}</TableCell>
                        <TableCell className="whitespace-normal">
                          {row.holds.map((hold) => (
                            <div key={hold}>{hold}</div>
                          ))}
                        </TableCell>
                        <TableCell>
                          <Badge variant={row.active ? "secondary" : "outline"}>{row.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollBox>
              <AmlaPager meta={page.meta} onPage={(next) => setFilters((current) => ({ ...current, page: next }))} />
            </>
          )}
        </DataState>
      </FillSection>
      <RecordOrderDialog open={recording} onClose={() => setRecording(false)} />
    </PageFill>
  );
}
