import { ShieldAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { BRANCH_ACCESS_EXPLANATION } from "../_lib/reconciliation-view";

/** A notice in place of what the caller can't use: no branch assigned, or a reconciliation that isn't there. */
export function BranchAccessNotice({ message = BRANCH_ACCESS_EXPLANATION }: { message?: string }) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 py-8 text-sm text-muted-foreground">
        <ShieldAlert className="mt-0.5 size-4 shrink-0" />
        <p>{message}</p>
      </CardContent>
    </Card>
  );
}
