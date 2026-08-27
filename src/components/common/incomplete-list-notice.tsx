import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Deliberately NOT re-exported from `@/components/common` — import it directly:
 *
 *     import { IncompleteListNotice } from "@/components/common/incomplete-list-notice";
 *
 * That barrel is not tree-shaken and is imported by nearly every route for
 * `RouteGuard`; see the note in its index.ts.
 */
export interface IncompleteListNoticeProps {
  /** How many rows the screen actually has in hand. */
  shown: number;
  /**
   * How many exist, per the server's `meta.total`. Null or undefined when the
   * response carried no usable total — the notice then says the list is
   * incomplete without inventing a figure for how incomplete.
   */
  total?: number | null;
  /** Plural noun for the rows, e.g. `"members"`, `"active loans"`. */
  noun: string;
  /**
   * What the user will actually notice, in one sentence. The point of this
   * component is that "incomplete" is abstract and "the member you are looking
   * for is not in this picker" is not, so this is required rather than optional.
   */
  consequence: string;
  className?: string;
}

/**
 * The banner a screen shows when it knows its list is short.
 *
 * Every one of these truncation bugs looked identical from the outside: a
 * complete-looking list that was missing rows, with nothing on screen to
 * distinguish it from the real thing. Paging fixes the common case; this covers
 * the case paging cannot — a runaway guard tripping, or a paginator that never
 * ends — by making the shortfall loud instead of silent.
 *
 * `role="alert"` so a screen reader announces it when it appears mid-load,
 * rather than leaving it to be discovered by sighted scanning alone.
 */
export function IncompleteListNotice({
  shown,
  total,
  noun,
  consequence,
  className,
}: IncompleteListNoticeProps) {
  const hasTotal = typeof total === "number" && total > shown;

  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4",
        className,
      )}
    >
      <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" aria-hidden="true" />
      <div className="text-sm">
        <p className="font-medium text-amber-900 dark:text-amber-200">
          This list is incomplete
          {hasTotal
            ? ` — showing ${shown} of ${total} ${noun}.`
            : `. Only ${shown} ${noun} could be loaded.`}
        </p>
        <p className="mt-0.5 text-muted-foreground">
          {consequence} Please report this so the screen can be paged properly.
        </p>
      </div>
    </div>
  );
}
