"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AmlaPageMeta } from "@/types/amla";

/**
 * Previous and next under a server-paged AMLA list (25 or 50 rows a page, as
 * the server pages them). `data-fab-clear` keeps its right end clear of Linda's
 * floating button, as `TablePagination` does.
 */
export function AmlaPager({ meta, onPage }: { meta: AmlaPageMeta; onPage: (page: number) => void }) {
  if (meta.total === 0) return null;
  return (
    <nav aria-label="Pages" data-fab-clear="" className="flex shrink-0 items-center justify-between gap-2 border-t pt-3 text-sm">
      <span className="text-muted-foreground">
        Page {meta.current_page} of {meta.last_page} · {meta.total} in all
      </span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={meta.current_page <= 1} onClick={() => onPage(meta.current_page - 1)}>
          <ChevronLeft className="mr-1 h-4 w-4" aria-hidden="true" />
          Previous
        </Button>
        <Button variant="outline" size="sm" disabled={meta.current_page >= meta.last_page} onClick={() => onPage(meta.current_page + 1)}>
          Next
          <ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}
