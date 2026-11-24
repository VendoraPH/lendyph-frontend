"use client";

import { useState } from "react";
import { IdCard, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePermission } from "@/hooks";
import { todayISO } from "@/lib/format";
import type { Borrower } from "@/types";
import { canEditMembership, membershipRows } from "../../_lib/member-membership";
import { MembershipDialog } from "./membership-dialog";

interface MembershipCardProps {
  borrower: Borrower;
  /** After a save: the member's record as the server answered it. */
  onSaved: (saved: Borrower) => void;
}

/**
 * The member's membership details (finish run round 2, decision 15):
 * Membership Date, Member Type, Membership Number and Member since (how long
 * the membership has lasted), and for a withdrawn or deceased member when it
 * ended. `borrowers:update` holders get Edit. The Overview shows the card for
 * members only: a pending or rejected registration has no membership.
 */
export function MembershipCard({ borrower, onSaved }: MembershipCardProps) {
  const { can } = usePermission();
  const [editing, setEditing] = useState(false);
  const editable = canEditMembership(can, borrower);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <IdCard className="h-4 w-4 text-muted-foreground" aria-hidden />
          Membership
        </CardTitle>
        {editable ? (
          <CardAction>
            <Button variant="outline" size="sm" onClick={() => setEditing(true)} aria-label="Edit membership">
              <Pencil className="mr-1 h-3.5 w-3.5" aria-hidden />
              Edit
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4">
        {membershipRows(borrower, todayISO()).map((row) => (
          <div key={row.label}>
            <p className="text-xs text-muted-foreground">{row.label}</p>
            <p className="text-sm font-medium">{row.value}</p>
          </div>
        ))}
      </CardContent>
      {editable ? (
        <MembershipDialog borrower={borrower} open={editing} onOpenChange={setEditing} onSaved={onSaved} />
      ) : null}
    </Card>
  );
}
