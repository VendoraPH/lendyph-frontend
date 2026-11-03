/**
 * A session-aware poller for small reads the app repeats in the background
 * (the notification bell's unread count, the sidebar's "awaiting me" badge):
 * an interval that pauses while the tab is hidden, catches up on focus and
 * visibility, and stops for good once the session is over (no access token
 * stored, or a 401). No React and no DOM, so `node:test` covers it.
 */

/** The default interval between reads while the tab is visible (the bell's). */
export const UNREAD_POLL_MS = 60_000;

/**
 * Focus and `visibilitychange` both fire when the user comes back to the tab;
 * a second refresh inside this gap is skipped, so returning makes one read.
 */
export const UNREAD_MIN_GAP_MS = 2_000;

export interface UnreadPollerDeps {
  /**
   * Reads the figure. A rejection is swallowed; the caller keeps its last
   * one. It must settle: the caller bounds it with a request timeout, or a
   * hung read would hold the schedule (a scheduled read is skipped while one
   * is in flight).
   */
  load: () => Promise<unknown>;
  isHidden: () => boolean;
  /**
   * Whether there is a session to read with (an access token is stored).
   * Without one nothing reads and the interval stops: once a session has
   * ended, every read would be a 401.
   */
  hasSession?: () => boolean;
  /**
   * Whether a failed read means the session is over (a 401). The poller then
   * halts for good; the caller remounts it when a user signs in again.
   */
  isSessionEnded?: (err: unknown) => boolean;
  now: () => number;
  setInterval: (fn: () => void, ms: number) => unknown;
  clearInterval: (handle: unknown) => void;
  intervalMs?: number;
  minGapMs?: number;
}

export interface UnreadPoller {
  /** Reads now and every interval after, unless the tab is hidden. */
  start: () => void;
  /** Stops the interval. */
  stop: () => void;
  /** `visibilitychange`: hidden stops polling; shown reads again and resumes. */
  handleVisibilityChange: () => void;
  /** Window `focus`: reads again (once per gap) and restarts the interval. */
  handleFocus: () => void;
  /**
   * Reads now, outside the schedule and even with a read in flight (after a
   * mark-read settles, for example): the older read's answer may predate the
   * change, and the mutation gate drops it.
   */
  refresh: () => void;
  /** The session ended (a 401 from any of the caller's reads): stops for good. */
  halt: () => void;
  /** Stops for good: nothing reads after this, even a late event. */
  dispose: () => void;
}

/**
 * The read schedule. A hook creates one only while a user is signed in and
 * disposes of it on sign-out, so nothing reads while signed out; a hidden
 * tab makes none either. Nor does a tab whose session has
 * ended: with no access token stored, or after a 401, it stops, and focus and
 * visibility changes don't restart it.
 */
export function createUnreadPoller(deps: UnreadPollerDeps): UnreadPoller {
  const intervalMs = deps.intervalMs ?? UNREAD_POLL_MS;
  const minGapMs = deps.minGapMs ?? UNREAD_MIN_GAP_MS;
  let handle: unknown = null;
  let inFlight = 0;
  let lastStartedAt: number | null = null;
  let disposed = false;
  const hasSession = deps.hasSession ?? (() => true);

  const stop = () => {
    if (handle !== null) deps.clearInterval(handle);
    handle = null;
  };

  const halt = () => {
    disposed = true;
    stop();
  };

  const read = (respectGap: boolean, force: boolean) => {
    if (disposed || deps.isHidden()) return;
    if (!hasSession()) {
      stop();
      return;
    }
    if (inFlight > 0 && !force) return;
    const now = deps.now();
    if (respectGap && lastStartedAt !== null && now - lastStartedAt < minGapMs) return;
    inFlight += 1;
    lastStartedAt = now;
    let pending: Promise<unknown>;
    try {
      pending = Promise.resolve(deps.load());
    } catch (err) {
      pending = Promise.reject(err);
    }
    pending
      .catch((err: unknown) => {
        if (deps.isSessionEnded?.(err)) halt();
      })
      .finally(() => {
        inFlight -= 1;
      });
  };

  const schedule = () => {
    stop();
    if (disposed || deps.isHidden() || !hasSession()) return;
    handle = deps.setInterval(() => read(false, false), intervalMs);
  };

  const resume = () => {
    read(true, false);
    schedule();
  };

  return {
    start: resume,
    stop,
    handleVisibilityChange: () => {
      if (deps.isHidden()) stop();
      else resume();
    },
    handleFocus: resume,
    refresh: () => read(false, true),
    halt,
    dispose: halt,
  };
}

/** Whether a failed request was a 401: the session it carried is over. */
export function isUnauthorizedError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const response = (err as { response?: { status?: unknown } }).response;
  return response?.status === 401;
}
