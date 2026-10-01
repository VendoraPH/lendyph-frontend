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
 * `enabled` is for users who can approve (`loans:approve`) — for anyone else
 * the badge is noise, and the read is skipped. A failed read keeps the last
 * figure rather than blanking the badge.
 *
 * This counts every application in For Approval, not only the step assigned to
 * the signed-in user: the list endpoint has no "awaiting me" filter.
 */
export function usePendingLoanApprovals(enabled: boolean): number {
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
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
    load();
    const interval = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [enabled]);

  return enabled ? total : 0;
}
