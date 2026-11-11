"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PageMeta } from "@/lib/portal/types";

/** Previous and next for a paged member list, from the server's `meta`. */
export function Pager({ meta, onPage }: { meta: PageMeta | null | undefined; onPage: (page: number) => void }) {
  if (!meta || meta.last_page <= 1) return null;
  return (
    <nav aria-label="Pages" className="mt-4 flex items-center justify-between gap-2">
      <Button variant="outline" size="sm" disabled={meta.current_page <= 1} onClick={() => onPage(meta.current_page - 1)}>
        <ChevronLeft className="h-4 w-4" aria-hidden />
        Previous
      </Button>
      <span className="text-xs text-muted-foreground">
        Page {meta.current_page} of {meta.last_page}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={meta.current_page >= meta.last_page}
        onClick={() => onPage(meta.current_page + 1)}
      >
        Next
        <ChevronRight className="h-4 w-4" aria-hidden />
      </Button>
    </nav>
  );
}
