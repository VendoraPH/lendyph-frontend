"use client";

import { useCallback, useState } from "react";
import { Plus } from "lucide-react";
import { DataState } from "@/components/common/data-state";
import { PermissionButton } from "@/components/common/permission-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApiResource } from "@/hooks";
import { formatCurrency, formatDate } from "@/lib/format";
import { savingsService } from "@/services";
import type { SavingsAccount, SavingsHold } from "@/types";
import {
  HOLD_STATUS_LABELS,
  HOLD_TYPE_LABELS,
  actorName,
  canPlaceHold,
  labelOf,
} from "../../../_lib/savings-rules";
import { PlaceHoldDialog } from "./place-hold-dialog";
import { ReleaseHoldDialog } from "./release-hold-dialog";

interface HoldsCardProps {
  account: SavingsAccount;
  /** After a hold is placed or released, so the balances above refresh too. */
  onChanged: () => void;
}

/** The holds on one account: what is earmarked, why, and until when. */
export function HoldsCard({ account, onChanged }: HoldsCardProps) {
  const fetcher = useCallback(() => savingsService.holds(account.id), [account.id]);
  const resource = useApiResource(fetcher);
  const [placing, setPlacing] = useState(false);
  const [releasing, setReleasing] = useState<SavingsHold | null>(null);

  const changed = () => {
    resource.refetch();
    onChanged();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">Holds</CardTitle>
        {canPlaceHold(account) && (
          <PermissionButton
            permission="savings:transact"
            size="sm"
            variant="outline"
            onClick={() => setPlacing(true)}
          >
            <Plus className="h-4 w-4" /> Place hold
          </PermissionButton>
        )}
      </CardHeader>
      <CardContent>
        <DataState
          resource={resource}
          endpoints={["GET /savings/accounts/{id}/holds"]}
          summary="Amounts set aside on this account will be listed here once the savings service is connected."
          isEmpty={(holds) => holds.length === 0}
          emptyMessage="Nothing is on hold on this account."
        >
          {(holds) => (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Placed</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Until</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>By</TableHead>
                    <TableHead className="w-0" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holds.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell>{formatDate(h.placed_on)}</TableCell>
                      <TableCell>{labelOf(HOLD_TYPE_LABELS, h.type)}</TableCell>
                      <TableCell className="max-w-64">
                        <p className="truncate">{h.reason}</p>
                        {h.release_reason && (
                          <p className="truncate text-xs text-muted-foreground">
                            Released: {h.release_reason}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(h.amount)}</TableCell>
                      <TableCell>{h.expires_on ? formatDate(h.expires_on) : "Until released"}</TableCell>
                      <TableCell>
                        {h.status === "active" ? (
                          <Badge variant="secondary">On hold</Badge>
                        ) : (
                          <Badge variant="outline">
                            {labelOf(HOLD_STATUS_LABELS, h.status)}
                            {h.released_on ? ` ${formatDate(h.released_on)}` : ""}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{actorName(h.created_by)}</TableCell>
                      <TableCell>
                        {h.status === "active" && (
                          <PermissionButton
                            permission="savings:transact"
                            size="sm"
                            variant="ghost"
                            onClick={() => setReleasing(h)}
                          >
                            Release
                          </PermissionButton>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DataState>
      </CardContent>
      <PlaceHoldDialog open={placing} account={account} onOpenChange={setPlacing} onPlaced={changed} />
      <ReleaseHoldDialog
        hold={releasing}
        onOpenChange={(open) => {
          if (!open) setReleasing(null);
        }}
        onReleased={changed}
      />
    </Card>
  );
}
