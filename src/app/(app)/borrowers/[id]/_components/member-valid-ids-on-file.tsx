"use client";

import { IdCard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import type { BorrowerValidId } from "@/services/borrower.service";
import { validIdName } from "../_lib/document-delete";
import type { MemberValidIdsStatus } from "../_hooks/use-member-valid-ids";

interface MemberValidIdsOnFileProps {
  ids: BorrowerValidId[];
  status: MemberValidIdsStatus;
  onRetry: () => void;
}

/**
 * The IDs a member already has, read-only, on the edit page, so the user can
 * check whether an upload that got no reply was stored before adding it again.
 * Removing one stays on the member's Documents tab.
 */
export function MemberValidIdsOnFile({ ids, status, onRetry }: MemberValidIdsOnFileProps) {
  return (
    <section aria-labelledby="member-ids-on-file" className="space-y-2">
      <h3 id="member-ids-on-file" className="text-sm font-medium">
        IDs on file
      </h3>
      {status === "loading" ? (
        <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          Loading the IDs on file…
        </p>
      ) : status === "error" ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>We couldn&apos;t load the IDs on file.</span>
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={onRetry}>
            Retry
          </Button>
        </div>
      ) : ids.length === 0 ? (
        <p className="text-xs text-muted-foreground">No IDs on file yet.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {ids.map((entry) => (
            <li key={entry.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <IdCard className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="truncate">{validIdName(entry)}</span>
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">{formatDate(entry.created_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
