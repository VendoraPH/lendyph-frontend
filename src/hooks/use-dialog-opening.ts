import { useState } from "react";

/**
 * `true` for the render in which a dialog opens, or in which `source` (the
 * record it edits) changes while it is open — the moment to refill its form:
 *
 *   if (useDialogOpening(open, role)) setLabel(role?.label ?? "");
 *
 * The state is set during render, as react.dev's "adjusting state when a prop
 * changes" does, rather than in `useEffect(..., [open, source])`: that painted
 * the dialog once with the previous contents and then again with the right
 * ones. Closing refills nothing, so a closing dialog keeps its contents while
 * it animates out.
 *
 * `source` is compared by identity, exactly as an effect dependency is.
 */
export function useDialogOpening<T>(open: boolean, source: T): boolean {
  const [seen, setSeen] = useState({ open: false, source });
  // A closed dialog's source is not tracked: nothing refills until it opens.
  const changed = seen.open !== open || (open && seen.source !== source);
  if (changed) setSeen({ open, source });
  return changed && open;
}
