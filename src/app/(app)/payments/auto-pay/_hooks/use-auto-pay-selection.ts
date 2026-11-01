import { useEffect, useState } from "react";
import { autoPayService } from "@/services/auto-pay.service";
import { getErrorMessage } from "@/lib/api-error";
import type { AutoPayFilter, AutoPayPreview, AutoPayPreviewQuery } from "@/types";
import {
  autoPayTotalsKey,
  selectionView,
  type SelectionAnswer,
  type SelectionView,
} from "../_lib/auto-pay-view";

/** Long enough to wait out a run of ticks, short enough to feel immediate. */
const DEBOUNCE_MS = 300;

/**
 * The preview for the part-paid rows selected now, asked again with
 * `include_schedule_ids[]` once the ticking pauses. It answers the whole
 * review step (cards, loans, skips, run total): selecting a row can bring a
 * skipped loan back. A request for a selection that has since changed is
 * cancelled, and its answer ignored if it arrives anyway.
 */
export function useAutoPaySelection(
  filter: AutoPayFilter,
  initial: AutoPayPreview,
  includedScheduleIds: ReadonlySet<number>,
): SelectionView {
  const [state, setState] = useState<{
    answer: SelectionAnswer | null;
    lastGood: AutoPayPreview | null;
  }>({ answer: null, lastGood: null });
  const key = autoPayTotalsKey(filter, includedScheduleIds);

  useEffect(() => {
    const query = JSON.parse(key) as AutoPayPreviewQuery;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      autoPayService
        .preview(query, controller.signal)
        .then((preview) => {
          if (controller.signal.aborted) return;
          setState({ answer: { key, preview, error: null }, lastGood: preview });
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return;
          setState((prev) => ({
            answer: {
              key,
              preview: null,
              error: getErrorMessage(err, "We couldn't update the preview for this selection. Please try again."),
            },
            lastGood: prev.lastGood,
          }));
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key]);

  return selectionView(initial, state.lastGood, state.answer, key);
}
