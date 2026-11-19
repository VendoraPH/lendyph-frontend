import { Badge } from "@/components/ui/badge";
import { BRANCH_STATUS_COLORS, BRANCH_STATUS_LABELS, branchStatusOf, type BranchStatusFields } from "@/lib/branch-status";

/** Active, Suspended or Closed, in the app's status colours. */
export function BranchStatusBadge({ branch }: { branch: BranchStatusFields }) {
  const status = branchStatusOf(branch);
  return (
    <Badge variant="outline" className={BRANCH_STATUS_COLORS[status]}>
      {BRANCH_STATUS_LABELS[status]}
    </Badge>
  );
}
