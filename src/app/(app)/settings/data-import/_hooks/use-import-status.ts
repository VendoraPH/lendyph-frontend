"use client";

/**
 * Polling one import run, at a rate that matches what the server is doing.
 *
 * The processor advances its cursor roughly once a minute, in batches, so there
 * is nothing to be gained by asking faster than that and a lot to be lost by a
 * page that asks forever. Three rules follow:
 *
 *  - **10 s while the tab is in front, 60 s behind it.** A background tab is
 *    nobody's progress bar, and throttled timers make the fast rate a lie
 *    anyway. Coming back to the tab polls immediately, so the first thing an
 *    admin sees is current rather than up to a minute old.
 *  - **Stop on `is_closed`.** That flag is published by the server precisely so
 *    a client never has to hardcode the phase list — a phase (`cancelled`) was
 *    added mid-build, and hardcoding is what broke.
 *  - **Chained timeouts, never `setInterval`.** A poll that takes longer than
 *    the interval would otherwise stack requests behind a slow link, which is
 *    the exact condition where piling on more of them is worst.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { getErrorMessage } from "@/lib/api-error";
import { dataImportService } from "@/services/data-import.service";
import type { ImportRunStatus } from "@/types/data-import";

/** Foreground cadence. Comfortably inside the server's ~60 s advance. */
export const STATUS_POLL_VISIBLE_MS = 10_000;

/** Background cadence. Slower than the server advances, deliberately. */
export const STATUS_POLL_HIDDEN_MS = 60_000;

/**
 * Consecutive failed polls before the error is shown.
 *
 * One failed poll on a link that stalls for tens of seconds is not news, and
 * replacing a live screen with an error the moment a single request drops is
 * how a working import gets abandoned. Two in a row is a real signal.
 */
export const POLL_FAILURES_BEFORE_REPORTING = 2;

/** Pure so the cadence rule is testable without a document. */
export function pollIntervalFor(
  visibility: string | undefined,
  visibleMs: number = STATUS_POLL_VISIBLE_MS,
  hiddenMs: number = STATUS_POLL_HIDDEN_MS,
): number {
  return visibility === "hidden" ? hiddenMs : visibleMs;
}

export interface UseImportStatusOptions {
  /** Null pauses the hook entirely — the shell has no run to watch yet. */
  runId: number | string | null | undefined;
  enabled?: boolean;
  visibleIntervalMs?: number;
  hiddenIntervalMs?: number;
  /** Called after every successful read, with the payload as it arrived. */
  onStatus?: (status: ImportRunStatus) => void;
}

export interface UseImportStatusResult {
  status: ImportRunStatus | null;
  /** True only until the first answer — never between polls. */
  loading: boolean;
  error: string | null;
  /** The server said `is_closed`, so polling has stopped for good. */
  stopped: boolean;
  /** Poll now. Also used by the visibility handler. */
  refresh: () => Promise<ImportRunStatus | null>;
}

export function useImportStatus(options: UseImportStatusOptions): UseImportStatusResult {
  const {
    runId,
    enabled = true,
    visibleIntervalMs = STATUS_POLL_VISIBLE_MS,
    hiddenIntervalMs = STATUS_POLL_HIDDEN_MS,
    onStatus,
  } = options;

  const [status, setStatus] = useState<ImportRunStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(runId) && enabled);
  const [error, setError] = useState<string | null>(null);
  const [stopped, setStopped] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stoppedRef = useRef(false);
  const inFlightRef = useRef(false);
  const failuresRef = useRef(0);
  const mountedRef = useRef(true);
  const onStatusRef = useRef(onStatus);
  onStatusRef.current = onStatus;

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const poll = useCallback(async (): Promise<ImportRunStatus | null> => {
    if (!runId || !enabled || stoppedRef.current || inFlightRef.current) return null;
    inFlightRef.current = true;

    try {
      const next = await dataImportService.status(runId);
      if (!mountedRef.current) return null;

      failuresRef.current = 0;
      setError(null);
      setLoading(false);

      if (next && typeof next === "object") {
        setStatus(next);
        onStatusRef.current?.(next);

        // `is_closed` is the server's own answer to "is this over", derived
        // from its CLOSED_PHASES. Reading it rather than matching on `phase`
        // is what keeps this hook working when a phase is added.
        if (next.is_closed) {
          stoppedRef.current = true;
          setStopped(true);
          clearTimer();
        }
      }
      return next ?? null;
    } catch (err) {
      if (!mountedRef.current) return null;
      failuresRef.current += 1;
      setLoading(false);
      if (failuresRef.current >= POLL_FAILURES_BEFORE_REPORTING) {
        setError(getErrorMessage(err, "Could not read the import's progress."));
      }
      return null;
    } finally {
      inFlightRef.current = false;
    }
  }, [runId, enabled, clearTimer]);

  /** Poll, then queue the next one at the cadence the tab currently deserves. */
  const scheduleNext = useCallback(() => {
    clearTimer();
    if (stoppedRef.current || !runId || !enabled) return;

    const visibility = typeof document === "undefined" ? undefined : document.visibilityState;
    const wait = pollIntervalFor(visibility, visibleIntervalMs, hiddenIntervalMs);

    timerRef.current = setTimeout(() => {
      void poll().finally(() => {
        if (mountedRef.current) scheduleNext();
      });
    }, wait);
  }, [clearTimer, runId, enabled, visibleIntervalMs, hiddenIntervalMs, poll]);

  useEffect(() => {
    mountedRef.current = true;
    stoppedRef.current = false;
    failuresRef.current = 0;
    setStopped(false);

    if (!runId || !enabled) {
      setLoading(false);
      return () => {
        mountedRef.current = false;
        clearTimer();
      };
    }

    setLoading(true);
    void poll().finally(() => {
      if (mountedRef.current) scheduleNext();
    });

    const onVisibility = () => {
      if (typeof document === "undefined") return;
      if (document.visibilityState === "visible") {
        // Straight away, not on the next tick: the number on screen may be a
        // minute old, and the first thing a returning admin reads should not be
        // the stale one.
        void poll().finally(() => {
          if (mountedRef.current) scheduleNext();
        });
      } else {
        scheduleNext();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      mountedRef.current = false;
      document.removeEventListener("visibilitychange", onVisibility);
      clearTimer();
    };
  }, [runId, enabled, poll, scheduleNext, clearTimer]);

  return { status, loading, error, stopped, refresh: poll };
}
