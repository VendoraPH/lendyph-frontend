import { useEffect, useState } from "react";
import { loanService } from "@/services/loan.service";
import type { Permission } from "@/types";

/** Often enough to notice a new submission, rare enough not to hammer the API. */
const REFRESH_MS = 2 * 60_000;

/**
 * Whether to ask for the badge at all: `loans:view` alone, which `GET /loans`
 * needs. Not `loans:approve` as well: the roles that own the default approval
 * steps (manager, bod1–bod7) act on them with `loans:view`, and `awaiting_me`
 * already limits the count to the user's own steps, so anyone with nothing
 * waiting on them simply gets 0.
 */
export function pendingApprovalsBadgeEnabled(can: (permission: Permission) => boolean): boolean {
  return can("loans:view");
}

/**
 * How many loan applications are waiting on the signed-in user's approval:
 * For Approval loans whose current pending approval step belongs to one of
 * the user's roles (`GET /loans?awaiting_me=1`). An application waiting on
 * another role's step is not counted.
 *
 * One integer off `meta.total` of a `per_page: 1` read, like the Members
 * badge: the count covers the whole filtered query at any page size.
 *
 * `enabled` is for users who can read the loans list (`loans:view`, which
 * `GET /loans` needs; see `pendingApprovalsBadgeEnabled`). For anyone else the
 * read would be a 403, so it is skipped. A failed read keeps the last figure
 * rather than blanking the badge.
 *
 * The refresh pauses while the tab is hidden and catches up as soon as it is
 * shown again, so a background tab makes no reads.
 */
export function usePendingLoanApprovals(enabled: boolean): number {
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    const load = () => {
      loanService
        .countAwaitingMyApproval()
        .then((n) => {
          if (cancelled) return;
          if (n !== null) setTotal(n);
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
