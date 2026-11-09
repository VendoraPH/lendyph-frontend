import { EyeOff } from "lucide-react";
import { DETAILS_HIDDEN_NOTE } from "@/lib/credit-scoring/score-state";

/** The one line a summary-only answer shows in place of its detail sections. */
export function DetailsHiddenNotice() {
  return (
    <p className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
      <EyeOff className="h-4 w-4 shrink-0" aria-hidden="true" />
      {DETAILS_HIDDEN_NOTE}
    </p>
  );
}
