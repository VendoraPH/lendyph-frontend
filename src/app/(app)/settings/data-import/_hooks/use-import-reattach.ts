"use client";

/**
 * "Is an import already running?" — asked before the wizard shows anyone step 1.
 *
 * The failure this exists to stop is not a lost upload, it is a DUPLICATE one.
 * An admin who closes the tab mid-migration and comes back to a blank step 1
 * concludes nothing happened and starts again; the server refuses (run creation
 * 409s while a run is open), and the admin is now stuck in front of an error
 * with no way to reach the run they actually have. So the page must not render
 * step 1 until every source has been asked, and while it asks it must show that
 * it is asking — see `checking` / `probe` / `progress` below, which the view
 * renders as a determinate panel rather than a spinner.
 *
 * Three sources, in falling order of how much the admin meant it:
 *
 *   1. `?session=` — they followed a link to a specific run. Most explicit.
 *   2. `localStorage` — same browser, same device, interrupted work.
 *   3. `GET /imports?active=1` — a cleared browser, or a different device
 *      entirely. The coop has one open run at a time, so this is unambiguous.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { getErrorMessage } from "@/lib/api-error";
import { clearImportSession, loadImportSession } from "@/lib/import-session";
import { dataImportService } from "@/services/data-import.service";
import type { ImportRunStatus } from "@/types/data-import";

// Type-only, and therefore erased at compile time — this is not a runtime cycle
// with the view that imports this hook. The step vocabulary belongs to the
// machine; deciding WHICH step to resume at belongs here.
import type { ImportStep } from "../_components/data-import-view";

export type ReattachSource = "url" | "storage" | "server";

/** Which source is being asked right now. `done` ends the panel. */
export type ReattachProbe = ReattachSource | "done";

export interface ImportReattachHit {
  runId: number;
  status: ImportRunStatus;
  source: ReattachSource;
  /** Where the wizard should open. Already accounts for `source`. */
  step: ImportStep;
}

export interface UseImportReattachResult {
  /** True until every source has been asked. While true, render the panel. */
  checking: boolean;
  probe: ReattachProbe;
  /** 0–100. Determinate: there are exactly three sources and we know which. */
  progress: number;
  hit: ImportReattachHit | null;
  /** A run we were pointed at turned out to be gone. Never reset silently. */
  notice: string | null;
  /** We could not find out. Blocks the wizard rather than guessing "nothing". */
  error: string | null;
  retry: () => void;
  /** Deliberate escape hatch from `error` — start fresh knowing we did not check. */
  proceedWithoutReattach: () => void;
  dismissNotice: () => void;
}

/** The sources, in order. Length drives the progress bar. */
const PROBES: readonly ReattachSource[] = ["url", "storage", "server"];

const PROBE_LABELS: Record<ReattachProbe, string> = {
  url: "Reading the import link…",
  storage: "Checking this device for an unfinished import…",
  server: "Asking the server whether an import is already running…",
  done: "Ready",
};

export function reattachProbeLabel(probe: ReattachProbe): string {
  return PROBE_LABELS[probe];
}

/**
 * A run id that is safe to put in a URL path.
 *
 * `?session=` is attacker-controlled in the sense that anyone can type it, and
 * it is interpolated straight into `/imports/{id}`. Ids are integers today, but
 * the stored `sessionId` is typed as a string, so this stays permissive about
 * shape and strict about characters.
 */
const SAFE_RUN_ID = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Statuses that mean "that run is not there any more" as opposed to "we could
 * not reach the server". 410 is the honest one for an expired upload session;
 * 404 is what most of this API returns for a run the coop no longer has.
 */
const GONE_STATUSES = new Set([404, 410]);

/**
 * Structural, matching `@/lib/api-error` — `instanceof AxiosError` is unreliable
 * when axios ends up bundled twice.
 */
function httpStatusOf(err: unknown): number | null {
  if (!err || typeof err !== "object" || !("response" in err)) return null;
  const response = (err as { response?: { status?: unknown } }).response;
  return typeof response?.status === "number" ? response.status : null;
}

/**
 * Which step a run belongs on.
 *
 * `is_closed` decides "finished", on its own, before the phase is even looked
 * at. The phase list is NOT the authority and must not be treated as one:
 * `cancelled` was added to it mid-build, and every place that had hardcoded
 * "completed | failed" quietly started routing cancelled runs into the live
 * progress view, where they polled forever.
 *
 * The `switch` keeps a `default` for the same reason. A phase this build has
 * never heard of means the server is doing something — "processing" polls,
 * re-reads `is_closed`, and self-corrects within one tick. Throwing, or falling
 * through to step 1, would not.
 */
export function stepForRunStatus(status: {
  phase: string;
  is_closed: boolean;
}): ImportStep {
  if (status.is_closed) return "result";

  switch (status.phase) {
    case "uploading":
      return "upload";
    // The server has staged the rows and is waiting on the admin to map CSV
    // product names onto loan products. That is step 2's job.
    case "awaiting_mapping":
      return "check";
    case "assembled":
    case "staging":
    case "importing_customers":
    case "importing_loans":
      return "processing";
    default:
      return "processing";
  }
}

/**
 * Where to open the wizard for a hit, given how we found it.
 *
 * A CLOSED run found in `localStorage` or via the active-run probe is not a
 * resume — it is a receipt for an import that finished while the admin was
 * elsewhere. Dropping them onto that run's result screen hides the "start a new
 * import" they came for, so they land on step 1 and the prior-import warning
 * tells them what happened. A closed run reached through `?session=` is
 * different: they asked for that run by name, so show it.
 */
export function stepForHit(
  status: { phase: string; is_closed: boolean },
  source: ReattachSource,
): ImportStep {
  const step = stepForRunStatus(status);
  if (step === "result" && source !== "url") return "prepare";
  return step;
}

/** Copy for a run that has vanished. Said out loud, never a silent reset. */
function goneMessage(sources: ReattachSource[], clearedLocal: boolean): string {
  const where =
    sources.includes("url") && sources.includes("storage")
      ? "The import in that link, and the one saved on this device, are"
      : sources.includes("url")
        ? "The import in that link is"
        : "The import saved on this device is";

  return (
    `${where} no longer on the server — it finished, was cancelled, or expired.` +
    (clearedLocal ? " The saved progress on this device has been cleared." : "") +
    " Nothing was imported by this check; you are starting fresh."
  );
}

export function useImportReattach(): UseImportReattachResult {
  const searchParams = useSearchParams();
  const sessionParam = searchParams.get("session");

  const [checking, setChecking] = useState(true);
  const [probe, setProbe] = useState<ReattachProbe>("url");
  const [completed, setCompleted] = useState(0);
  const [hit, setHit] = useState<ImportReattachHit | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  // The wizard reads `?session=` once, on arrival. Re-running the probe because
  // some other control edited the query string would yank an admin who is three
  // steps in back to the "checking" panel.
  const initialSessionParam = useRef(sessionParam);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const dismissNotice = useCallback(() => setNotice(null), []);
  const proceedWithoutReattach = useCallback(() => {
    setError(null);
    setHit(null);
    setProbe("done");
    setCompleted(PROBES.length);
    setChecking(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setChecking(true);
      setError(null);
      setNotice(null);
      setHit(null);
      setCompleted(0);

      const gone: ReattachSource[] = [];
      let clearedLocal = false;

      const finish = (found: ImportReattachHit | null) => {
        if (cancelled) return;
        setHit(found);
        setProbe("done");
        setCompleted(PROBES.length);
        if (gone.length > 0) setNotice(goneMessage(gone, clearedLocal));
        setChecking(false);
      };

      const stored = loadImportSession();

      const candidates: Array<{ id: string; source: ReattachSource }> = [];
      const fromUrl = initialSessionParam.current;
      if (fromUrl && SAFE_RUN_ID.test(fromUrl)) {
        candidates.push({ id: fromUrl, source: "url" });
      }
      if (stored?.sessionId && stored.sessionId !== fromUrl) {
        candidates.push({ id: stored.sessionId, source: "storage" });
      }

      for (const source of PROBES) {
        if (cancelled) return;
        setProbe(source);

        const candidate = candidates.find((c) => c.source === source);

        try {
          if (source === "server") {
            // Only reached when neither the link nor this device named a run.
            const active = await dataImportService.activeRun();
            if (cancelled) return;
            if (active) {
              finish({
                runId: active.id,
                status: active,
                source,
                step: stepForHit(active, source),
              });
              return;
            }
          } else if (candidate) {
            const status = await dataImportService.status(candidate.id);
            if (cancelled) return;
            finish({
              runId: status.id,
              status,
              source,
              step: stepForHit(status, source),
            });
            return;
          }
        } catch (err) {
          if (cancelled) return;
          const code = httpStatusOf(err);

          if (GONE_STATUSES.has(code ?? 0)) {
            // On the collection probe a 404 means "no open run" (or an API that
            // predates this feature), not "your run vanished" — there was no run
            // to vanish. Only a named run can be reported as gone.
            if (source !== "server") {
              gone.push(source);
              // Only drop the local record if it is the one that turned out to
              // be dead. A dud `?session=` in someone's chat history must not
              // wipe the perfectly good session this device is holding.
              if (stored && stored.sessionId === candidate?.id) {
                clearImportSession();
                clearedLocal = true;
              }
            }
          } else {
            // Network, 5xx, timeout: we do not KNOW there is no import running,
            // and showing step 1 here is the exact lie this hook exists to
            // prevent. Block, and let the admin retry or override deliberately.
            setError(
              getErrorMessage(
                err,
                "We could not check whether an import is already running.",
              ),
            );
            setProbe("done");
            setCompleted(PROBES.length);
            setChecking(false);
            return;
          }
        }

        if (cancelled) return;
        setCompleted((done) => done + 1);
      }

      finish(null);
    };

    void run();
    return () => {
      cancelled = true;
    };
    // `attempt` is the retry trigger; nothing else may re-run the probe.
  }, [attempt]);

  return {
    checking,
    probe,
    progress: Math.round((completed / PROBES.length) * 100),
    hit,
    notice,
    error,
    retry,
    proceedWithoutReattach,
    dismissNotice,
  };
}
