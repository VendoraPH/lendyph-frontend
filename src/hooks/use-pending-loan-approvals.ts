import { useEffect, useState } from "react";
import { loanService } from "@/services/loan.service";
import { tokenManager } from "@/lib/axios-client";
import { createUnreadPoller, isUnauthorizedError, type UnreadPoller } from "@/lib/session-poller";
import type { Permission } from "@/types";

/** Often enough to notice a new submission, rare enough not to hammer the API. */
export const PENDING_APPROVALS_POLL_MS = 2 * 60_000;

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

export interface PendingApprovalsPollerDeps {
  /** Reads the count; `null` when the reply carried no total. */
  count: () => Promise<number | null>;
  /** Shows a count the server sent. */
  onCount: (n: number) => void;
  isHidden: () => boolean;
  /** Whether an access token is stored. */
  hasSession: () => boolean;
  now: () => number;
  setInterval: (fn: () => void, ms: number) => unknown;
  clearInterval: (handle: unknown) => void;
}

/**
 * The badge's schedule, on the shared session poller: a read every 2 minutes
 * while the tab is visible. A failed read keeps the last figure, and so does a
 * reply without a total. With no access token stored it reads nothing, and a
 * 401 stops it for good, so an expired session no longer sends
 * `GET /loans?awaiting_me=1` every interval. The read's error is passed on,
 * not swallowed, so the poller sees the 401.
 */
export function createPendingApprovalsPoller(deps: PendingApprovalsPollerDeps): UnreadPoller {
  return createUnreadPoller({
    load: () =>
      deps.count().then((n) => {
        if (n !== null) deps.onCount(n);
      }),
    isHidden: deps.isHidden,
    hasSession: deps.hasSession,
    isSessionEnded: isUnauthorizedError,
    now: deps.now,
    setInterval: deps.setInterval,
    clearInterval: deps.clearInterval,
    intervalMs: PENDING_APPROVALS_POLL_MS,
  });
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
 * shown again, so a background tab makes no reads. Once the session ends (no
 * access token stored, or a 401) it stops; the sidebar remounts on the next
 * sign-in. See `createPendingApprovalsPoller`.
 */
export function usePendingLoanApprovals(enabled: boolean): number {
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const poller = createPendingApprovalsPoller({
      count: () => loanService.countAwaitingMyApproval(),
      onCount: (n) => {
        if (!cancelled) setTotal(n);
      },
      isHidden: () => document.hidden,
      hasSession: () => tokenManager.getAccessToken() !== null,
      now: () => Date.now(),
      setInterval: (fn, ms) => window.setInterval(fn, ms),
      clearInterval: (handle) => window.clearInterval(handle as number),
    });
    const onVisibility = () => poller.handleVisibilityChange();
    poller.start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      poller.dispose();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled]);

  return enabled ? total : 0;
}
