import { Label } from "@/components/ui/label";
import type { GCashParty } from "@/types";

/**
 * Who a Cash In / Cash Out is for, as the read-only Name and Number fields at
 * the top of both dialogs. Opened from a table row or from New Transaction,
 * the teller sees the same two fields. A member's Number is their contact number.
 */
export function PartyFields({ party }: { party: GCashParty }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <Label className="text-muted-foreground">Name</Label>
        <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
          {party.full_name || "—"}
        </div>
      </div>
      <div>
        <Label className="text-muted-foreground">Number</Label>
        <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
          {(party.kind === "member" ? party.contact_number : party.mobile_number) || "—"}
        </div>
      </div>
    </div>
  );
}
