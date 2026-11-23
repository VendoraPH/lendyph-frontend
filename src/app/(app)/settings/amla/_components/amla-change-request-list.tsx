"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { amlaChangeRequestActions } from "@/lib/amla/access";
import { amlaChangeRequestChanges, amlaChangeRequestLines, type AmlaRuleBaselines } from "@/lib/amla/settings-view";
import type { Permission } from "@/types";
import type { AmlaChangeRequest } from "@/types/amla";
import type { AmlaDecision } from "./amla-decisions";

interface Props {
  requests: AmlaChangeRequest[];
  userId: number | null;
  can: (permission: Permission) => boolean;
  onDecide: (request: AmlaChangeRequest, decision: AmlaDecision) => void;
  /** The calendar tab lists its year's waiting requests without the decision column. */
  compact?: boolean;
  /** The rule versions a rule change is compared with (current → proposed). */
  baselines?: AmlaRuleBaselines;
}

/** Change requests in words, with only the steps the server would allow this user. */
export function AmlaChangeRequestList({ requests, userId, can, onDecide, compact = false, baselines }: Props) {
  return (
    <Table>
      <TableHeader className="sticky top-0 z-10 bg-background">
        <TableRow>
          <TableHead>Change</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Reason</TableHead>
          {!compact && <TableHead>Decision</TableHead>}
          <TableHead className="text-right">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {requests.map((request) => {
          const lines = amlaChangeRequestLines(request);
          const actions = amlaChangeRequestActions(request, userId, can);
          const changes = amlaChangeRequestChanges(request, baselines);
          return (
            <TableRow key={request.id}>
              <TableCell className="whitespace-normal">
                <div className="font-medium">{lines.summary}</div>
                {changes.length > 0 && (
                  <ul aria-label="The change" className="my-1 list-disc pl-5 text-sm">
                    {changes.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                )}
                <div className="text-xs text-muted-foreground">
                  #{request.id} · {request.type_words} · {lines.asked}
                </div>
              </TableCell>
              <TableCell>
                <Badge variant={request.status === "pending" ? "secondary" : "outline"}>{request.status_words}</Badge>
              </TableCell>
              <TableCell className="max-w-xs whitespace-normal">{request.reason}</TableCell>
              {!compact && <TableCell className="max-w-xs whitespace-normal text-sm">{lines.decided ?? "—"}</TableCell>}
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  {actions.approve && (
                    <Button size="sm" onClick={() => onDecide(request, "approve")}>
                      Approve
                    </Button>
                  )}
                  {actions.reject && (
                    <Button size="sm" variant="outline" onClick={() => onDecide(request, "reject")}>
                      Reject
                    </Button>
                  )}
                  {actions.withdraw && (
                    <Button size="sm" variant="outline" onClick={() => onDecide(request, "withdraw")}>
                      Withdraw
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
