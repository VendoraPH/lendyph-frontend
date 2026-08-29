import { Badge } from "@/components/ui/badge";

interface Props {
  borrower?: { full_name: string } | null;
  nonMember?: { full_name: string } | null;
}

/**
 * The "who was this for" cell shared by the Transactions and Pending tables.
 * A walk-in is tagged so it can't be mistaken for a member at a glance.
 */
export function PartyCell({ borrower, nonMember }: Props) {
  if (nonMember) {
    return (
      <span className="inline-flex items-center gap-2">
        {nonMember.full_name}
        <Badge variant="outline" className="text-[10px] font-normal">
          Non-member
        </Badge>
      </span>
    );
  }
  return <>{borrower?.full_name ?? "—"}</>;
}
