import { useEffect, useState } from "react";
import { loanService } from "@/services/loan.service";

/** Often enough to notice a new submission, rare enough not to hammer the API. */
const REFRESH_MS = 2 * 60_000;

/**
 * How many loan applications are waiting on an approver ("For Approval").
 *
 * One integer off `meta.total` of a `per_page: 1` read, like the Members
 * badge: the count covers the whole filtered query at any page size.
 *
 * `enabled` is for users who can approve and can read the loans list
 * (`loans:approve` and `loans:view`, since `GET /loans` needs the latter) —
 * for anyone else the badge is noise or a 403, and the read is skipped. A
 * failed read keeps the last figure rather than blanking the badge.
 *
 * The refresh pauses while the tab is hidden and catches up as soon as it is
 * shown again, so a background tab makes no reads.
 *
 * This counts every application in For Approval, not only the step assigned to
 * the signed-in user: the list endpoint has no "awaiting me" filter.
 */
export function usePendingLoanApprovals(enabled: boolean): number {
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    const load = () => {
      loanService
        .list({ status: "for_review", per_page: 1 })
        .then((res) => {
          if (cancelled) return;
          const n = res?.meta?.total;
          if (typeof n === "number") setTotal(n);
        })
        .catch(() => {});
    };
    const stop = () => {
      if (interval !== null) clearInterval(interval);
      interval = null;
    };
    const start = () => {
      stop();
      load();
      interval = setInterval(load, REFRESH_MS);
    };
    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled]);

  return enabled ? total : 0;
}
