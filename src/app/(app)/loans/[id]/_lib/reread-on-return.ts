// Reprint after a change: a document is printed in its own tab, so while a
// printed document is out of date the loan page reads the loan again each time
// staff come back to it (the tab shown again, or its window focused), and the
// notice clears once the reprint is recorded. It never reads on a timer.
// No React and no DOM, so `node:test` covers it; `useRereadOnReturn` wires it.

/**
 * Focus and `visibilitychange` both fire when staff come back to the tab; a
 * second read inside this gap is skipped, so one return makes one read.
 */
export const RETURN_MIN_GAP_MS = 2_000;

export interface ReturnReaderDeps {
  /** Reads the loan again. A rejection is swallowed; the page keeps what it has. */
  read: () => Promise<unknown>;
  isHidden: () => boolean;
  now: () => number;
  minGapMs?: number;
}

export interface ReturnReader {
  /** The window was focused, or the tab shown again. */
  handleReturn: () => void;
  /** Stops for good: nothing reads after this, even a late event. */
  dispose: () => void;
}

/**
 * One read per return: none while the tab is hidden, none while a read is
 * still out, and none within `minGapMs` of the last one.
 */
export function createReturnReader(deps: ReturnReaderDeps): ReturnReader {
  const minGapMs = deps.minGapMs ?? RETURN_MIN_GAP_MS;
  let inFlight = false;
  let lastStartedAt: number | null = null;
  let disposed = false;

  return {
    handleReturn() {
      if (disposed || inFlight || deps.isHidden()) return;
      const now = deps.now();
      if (lastStartedAt !== null && now - lastStartedAt < minGapMs) return;

      inFlight = true;
      lastStartedAt = now;
      deps
        .read()
        .catch(() => {})
        .finally(() => {
          inFlight = false;
        });
    },
    dispose() {
      disposed = true;
    },
  };
}
