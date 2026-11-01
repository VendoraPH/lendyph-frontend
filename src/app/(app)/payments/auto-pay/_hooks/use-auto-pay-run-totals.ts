import { useEffect, useState } from "react";
import { autoPayService } from "@/services/auto-pay.service";
import { getErrorMessage } from "@/lib/api-error";
import type { AutoPayFilter, AutoPayPreviewQuery } from "@/types";
import { autoPayTotalsKey, runTotals, type RunTotals } from "../_lib/auto-pay-view";

/** Long enough to wait out a run of ticks, short enough to feel immediate. */
const DEBOUNCE_MS = 300;

interface Answer {
  key: string;
  totals: RunTotals | null;
  error: string | null;
}

/**
 * The run's total for the part-paid rows selected now: the preview asked
 * again with `include_schedule_ids[]` once the ticking pauses. A request for
 * a selection that has since changed is cancelled, and its answer ignored if
 * it arrives anyway, so the total on screen is always the current selection's.
 */
export function useAutoPayRunTotals(
  filter: AutoPayFilter,
  includedScheduleIds: ReadonlySet<number>,
): { loading: boolean; totals: RunTotals | null; error: string | null } {
  const [answer, setAnswer] = useState<Answer | null>(null);
  const key = autoPayTotalsKey(filter, includedScheduleIds);

  useEffect(() => {
    const query = JSON.parse(key) as AutoPayPreviewQuery;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      autoPayService
        .preview(query, controller.signal)
        .then((preview) => {
          if (controller.signal.aborted) return;
          const totals = runTotals(preview.summary);
          setAnswer({
            key,
            totals,
            error: totals === null ? "The server's run total could not be read." : null,
          });
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return;
          setAnswer({
            key,
            totals: null,
            error: getErrorMessage(err, "We couldn't work out the run total. Please try again."),
          });
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key]);

  const current = answer?.key === key ? answer : null;
  return {
    loading: current === null,
    totals: current?.totals ?? null,
    error: current?.error ?? null,
  };
}
