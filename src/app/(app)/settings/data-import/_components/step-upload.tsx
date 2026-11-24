"use client";

/**
 * The upload step: open the run, send its CSVs a piece at a time, resume.
 *
 * The engine lives in ../_hooks/use-chunk-upload; this is the screen over it.
 * What it has to get right, beyond drawing a bar:
 *
 *  - **A resume needs the file back, and this step is where it is asked for.**
 *    A `File` handle cannot be serialised, so a reload leaves the run intact on
 *    the server and nothing on the client. Every prop except `runId` is
 *    therefore allowed to be null: a resumed run arrives with an id and little
 *    else, and requiring the rest made every resumed run unreachable. From an
 *    id alone this screen says how much already landed and asks for the SAME
 *    file by name.
 *  - **The wrong file is refused, loudly.** Continuing with a different export
 *    splices two files into one CSV that still parses, and imports the result
 *    as real members and loans.
 *  - **A digest mismatch is not a restart.** The server keeps the chunks
 *    precisely so specific pieces can be re-sent, so that is what is offered.
 *  - **Once every file is assembled the file stops mattering.** The import
 *    continues on the server whether or not this tab is open.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CloudOff,
  FileUp,
  RefreshCw,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import { api } from "@/lib/api-client";
import { getErrorMessage, httpStatusOf } from "@/lib/api-error";
import { CSV_FILE_ACCEPT } from "@/lib/csv-file";
import { todayISO } from "@/lib/format";
import {
  loadImportSession,
  recordUploadedChunk,
  saveImportSession,
  type ImportSession,
  type NewImportSession,
} from "@/lib/import-session";
import { notifyError } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { dataImportService } from "@/services/data-import.service";
import type { ImportFileKind } from "@/types/data-import";
import {
  sha256Hex,
  useChunkUpload,
  type ChunkUploadFileState,
  type DigestMismatch,
} from "../_hooks/use-chunk-upload";
import { keepsRunForUpload } from "../_hooks/use-import-reattach";

/* ------------------------------------------------------------------ */
/* The seam                                                             */
/* ------------------------------------------------------------------ */

// `ImportFiles` and `PrecheckOutcome` are owned by ./data-import-view, which
// holds the wizard's shared vocabulary. They were declared locally so this file
// compiled on its own branch; now that both are on one branch they are imported,
// so there is one definition rather than two that agree until someone edits one.
import type { ImportFiles, PrecheckOutcome } from "./data-import-view";
import { FILE_LABELS, IMPORT_FILE_KINDS, fileNameInSentence, filesPhrase, filesProblem } from "./import-files";
import { piecesAccepted } from "@/lib/count-words";

export interface StepUploadProps {
  /** The branch the members and loans are created under. Null on a resume. */
  branchId: number | null;
  /** The picked files. Both null on a resume — this step asks for them again. */
  files: ImportFiles;
  /** What step 2 settled. Null on a resume; the run already carries it. */
  precheck: PrecheckOutcome | null;
  /** The open run, or null to open one from the props above. */
  runId: number | null;
  /** Fired once, with the id of the run this step opened. */
  onRunCreated: (id: number) => void;
  /**
   * The run turned out to be finished (completed, failed or cancelled). A
   * finished run never takes another upload: the wizard forgets it, and this
   * step opens a new run with the same files.
   */
  onRunFinished: () => void;
  /** Back to the pre-check step. */
  onBack: () => void;
  /** Every file of the run is on the server and verified. */
  onUploaded: () => void;
  className?: string;
}

/* ------------------------------------------------------------------ */
/* Pure — unit tested in ./step-upload.test.ts                          */
/* ------------------------------------------------------------------ */

/** Human bytes. Local because nothing else in the app formats sizes. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * "Piece 3 of 7". 1-based on screen because the admin is counting things, not
 * indexing an array — the wire stays 0-based.
 */
export function chunkLabel(currentIndex: number | null, totalChunks: number): string | null {
  if (currentIndex === null || totalChunks <= 0) return null;
  return `Piece ${currentIndex + 1} of ${totalChunks}`;
}

/** One file as the create-run request declares it. */
interface DeclaredFile {
  filename: string;
  size_bytes: number;
  sha256: string;
}

/**
 * The create-run `files`: each picked file, in the order the import reads
 * them. The server takes the members file, the share capital file or both,
 * and a loans file only beside the members file (`StoreCsvImportRunRequest`);
 * `filesProblem` holds the picks to that before a run is opened.
 */
export function declaredFiles(
  picked: Partial<Record<ImportFileKind, { name: string; size: number } | null>>,
  digests: Partial<Record<ImportFileKind, string | undefined>>,
): Partial<Record<ImportFileKind, DeclaredFile>> {
  const declared: Partial<Record<ImportFileKind, DeclaredFile>> = {};
  for (const kind of IMPORT_FILE_KINDS) {
    const file = picked[kind];
    const sha256 = digests[kind];
    if (file && sha256) declared[kind] = { filename: file.name, size_bytes: file.size, sha256 };
  }
  return declared;
}

/** The create-run body, as `StoreCsvImportRunRequest` validates it. */
interface CreateRunBody {
  message?: string;
  warning?: string | null;
  reclaimed_run_id?: number | null;
  run: { id: number };
  chunk_size: number;
}

/* ------------------------------------------------------------------ */

export function StepUpload({
  branchId,
  files,
  precheck,
  runId,
  onRunCreated,
  onRunFinished,
  onBack,
  onUploaded,
  className,
}: StepUploadProps) {
  // Files re-picked on this screen sit on top of whatever the shell passed in,
  // which on a resume is nothing.
  const [repicked, setRepicked] = useState<Partial<Record<ImportFileKind, File>>>({});
  const [session, setSession] = useState<ImportSession | null>(null);
  const [chunkSize, setChunkSize] = useState<unknown>(undefined);
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  // Opening a run is not idempotent and the server refuses a second one while
  // any run is open, so a duplicate POST leaves an orphan that blocks every
  // future import at this coop. The guard is set synchronously, before the
  // first await, because React mounts an effect twice in development.
  const openingRef = useRef(false);

  useEffect(() => {
    setSession(loadImportSession());
  }, []);

  const merged = useMemo<Partial<Record<ImportFileKind, File | null>>>(
    () => ({
      customers: repicked.customers ?? files.customers,
      loans: repicked.loans ?? files.loans,
      share_capital: repicked.share_capital ?? files.share_capital,
    }),
    [files, repicked],
  );

  /* -------------------- opening the run -------------------- */

  useEffect(() => {
    if (runId !== null || openingRef.current) return;
    const picked: Record<ImportFileKind, File | null> = {
      customers: merged.customers ?? null,
      loans: merged.loans ?? null,
      share_capital: merged.share_capital ?? null,
    };
    // The picked files must make an import: the members file, the share
    // capital file or both, with loans only beside the members file
    // (./import-files).
    if (branchId === null || !precheck || filesProblem(picked) !== null) return;

    openingRef.current = true;
    setOpening(true);
    setOpenError(null);

    void (async () => {
      try {
        const digests: Partial<Record<ImportFileKind, string>> = Object.fromEntries(
          await Promise.all(
            IMPORT_FILE_KINDS.flatMap((kind) => {
              const file = picked[kind];
              return file ? [sha256Hex(file).then((sha) => [kind, sha] as const)] : [];
            }),
          ),
        );

        /**
         * `api.rawPost`, NOT `dataImportService.createRun` — and this is a
         * defect in the service, not a preference here.
         *
         * `POST /imports` answers with a FLAT body (`message`, `warning`,
         * `reclaimed_run_id`, `run`, `chunk_size`, `files`), while
         * `createRun` unwraps through `api.post`, which returns
         * `response.data.data`. That is `undefined` for this endpoint, and its
         * declared `CreateRunResponse` means TypeScript never says so. Calling
         * it would open a real run on the server and lose its id — and an
         * un-cancellable open run 409s every future import at this coop. The
         * fix belongs in data-import.service.ts (`rawPost`, as `auth/login`
         * already does); until then this reads the envelope it is actually
         * given.
         */
        const created = await api.rawPost<CreateRunBody>(API_ENDPOINTS.DATA_IMPORT.RUNS, {
          branch_id: branchId,
          as_of_date: todayISO(),
          files: declaredFiles(picked, digests),
        });

        const id = created?.run?.id;
        if (typeof id !== "number") {
          throw new Error("The server did not return a run id.");
        }

        setChunkSize(created.chunk_size);

        const sessionFile = (file: File) => ({
          name: file.name,
          size: file.size,
          lastModified: file.lastModified,
          totalChunks: Math.ceil(file.size / created.chunk_size),
          uploadedChunks: [],
        });

        // Persisted immediately, because everything after this point depends on
        // being able to find the run again — and the tab can die at any moment.
        const stored: NewImportSession = {
          sessionId: String(id),
          branchId,
          // Carried through per file, exactly as step 2 settled them. A single
          // boolean here would re-apply one file's header answer to the other
          // on resume, and a coop's export routinely has a header on one and
          // not the other.
          productMap: precheck.productMap,
          hasHeaderRow: precheck.hasHeaderRow,
          dateFormat: precheck.dateFormat,
          chunkSize: created.chunk_size,
          files: Object.fromEntries(
            IMPORT_FILE_KINDS.flatMap((kind) => {
              const file = picked[kind];
              return file ? [[kind, sessionFile(file)] as const] : [];
            }),
          ),
          startedAt: Date.now(),
        };
        saveImportSession(stored);
        // Re-read rather than assumed: `saveImportSession` stamps the version
        // and the clock, and the copy held here has to be the one on disk.
        setSession(loadImportSession());
        onRunCreated(id);
      } catch (err) {
        openingRef.current = false;
        setOpenError(getErrorMessage(err, "Could not open the import."));
        notifyError(err, "Could not open the import.");
      } finally {
        setOpening(false);
      }
    })();
  }, [runId, branchId, merged, precheck, onRunCreated]);

  /* -------------------- the upload -------------------- */

  const handleChunk = useCallback((kind: ImportFileKind, index: number) => {
    // Written after every acknowledged chunk, never batched: whatever is on
    // disk when the tab dies is what the resume gets.
    setSession((current) => (current ? recordUploadedChunk(current, kind, index) : current));
  }, []);

  const handleAssembled = useCallback(() => {
    onUploaded();
  }, [onUploaded]);

  const { state, serverStatus, start, resend } = useChunkUpload({
    runId,
    files: merged,
    advertisedChunkSize: chunkSize,
    session,
    onChunkAcknowledged: handleChunk,
    onAssembled: handleAssembled,
  });

  const pick = useCallback((kind: ImportFileKind, file: File | null | undefined) => {
    if (!file) return;
    setRepicked((current) => ({ ...current, [kind]: file }));
  }, []);

  // A run the server says has finished is never uploaded into: it is handed
  // back to be forgotten, and this step opens a new run. Only this run's own
  // status counts, never one read for the run before it.
  useEffect(() => {
    if (runId !== null && serverStatus?.id === runId && !keepsRunForUpload(serverStatus)) {
      onRunFinished();
    }
  }, [runId, serverStatus, onRunFinished]);

  const cancelAndGoBack = useCallback(async () => {
    if (runId === null) {
      onBack();
      return;
    }
    setCancelling(true);
    try {
      await dataImportService.cancel(runId);
    } catch (err) {
      // A finished run cannot be cancelled (409), and never takes another
      // upload: forget it, so going back and on opens a new run instead of
      // landing in this one again.
      const finished =
        httpStatusOf(err) === 409 &&
        !keepsRunForUpload(await dataImportService.status(runId).catch(() => null));
      if (finished) onRunFinished();
      else notifyError(err, "Could not cancel this run.");
    } finally {
      setCancelling(false);
      onBack();
    }
  }, [runId, onBack, onRunFinished]);

  const assembled = state.phase === "assembled";
  const busy =
    opening ||
    state.phase === "uploading" ||
    state.phase === "assembling" ||
    state.phase === "checking";
  const refused = state.files.some((file) => file.blocked?.kind === "refuse");
  const phrase = filesPhrase(state.files.map((file) => file.kind));

  return (
    <div className={cn("space-y-6", className)}>
      <div>
        <h2 className="font-heading text-lg font-medium">Uploading your files</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Each file is sent in pieces, one at a time. If the connection drops, only
          the piece in flight is lost — everything already accepted stays on the
          server and the upload carries on from there.
        </p>
      </div>

      {/* The one place a screen reader is told what is happening. */}
      <p role="status" aria-live="polite" className="sr-only">
        {assembled
          ? phrase.announced
          : state.phase === "paused"
            ? "Upload paused, waiting for the connection."
            : state.phase === "uploading"
              ? `Uploading, ${Math.round(state.overallPercent)} percent complete.`
              : state.phase === "assembling"
                ? "Joining the pieces back together."
                : ""}
      </p>

      {opening ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner />
          Opening the import and checksumming your files…
        </p>
      ) : null}

      {openError ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-600" aria-hidden="true" />
          <div>
            <p className="font-medium text-red-900 dark:text-red-200">{openError}</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={onBack}>
              <ArrowLeft />
              Back
            </Button>
          </div>
        </div>
      ) : null}

      {state.offline ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm"
        >
          <CloudOff className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden="true" />
          <div>
            <p className="font-medium text-amber-900 dark:text-amber-200">
              Paused — this device reports no connection
            </p>
            <p className="mt-0.5 text-muted-foreground">
              Nothing is lost. The upload resumes on its own when the connection
              comes back, and tries again shortly regardless — a browser&apos;s idea
              of &ldquo;offline&rdquo; is not always right.
            </p>
          </div>
        </div>
      ) : null}

      <div className="space-y-4">
        {state.files.map((file) => (
          <FileProgress
            key={file.kind}
            file={file}
            retrying={state.retrying?.kind === file.kind ? state.retrying : null}
            onPick={(picked) => pick(file.kind, picked)}
          />
        ))}
      </div>

      {state.error && !state.digestMismatch ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-600" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-medium text-red-900 dark:text-red-200">{state.error}</p>
            <p className="mt-0.5 text-muted-foreground">
              Everything already accepted is still on the server. Trying again picks
              up from the first piece it is missing.
            </p>
            <Button variant="outline" size="sm" className="mt-2" onClick={start}>
              <RefreshCw />
              Try again
            </Button>
          </div>
        </div>
      ) : null}

      {state.digestMismatch ? (
        <DigestMismatchNotice
          mismatch={state.digestMismatch}
          onResend={() => resend(state.digestMismatch?.fileKind ?? "customers")}
          onCancelRun={() => void cancelAndGoBack()}
          cancelling={cancelling}
        />
      ) : null}

      {assembled ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-lg border border-green-500/40 bg-green-500/10 p-4 text-sm"
        >
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-600" aria-hidden="true" />
          <div>
            <p className="font-medium text-green-900 dark:text-green-200">{phrase.verified}</p>
            <p className="mt-0.5 text-muted-foreground">
              The file on your computer no longer matters. The import runs on the
              server from here — you can close this page, switch devices, or come
              back later, and it will carry on either way.
            </p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 border-t pt-4">
        <Button variant="ghost" onClick={onBack} disabled={busy}>
          <ArrowLeft />
          Back
        </Button>
        {refused && runId !== null ? (
          <Button variant="outline" onClick={() => void cancelAndGoBack()} disabled={cancelling}>
            {cancelling ? "Cancelling…" : "Cancel this run and start again"}
          </Button>
        ) : null}
        {busy && state.files.length > 0 ? (
          <span className="text-sm text-muted-foreground tabular-nums">
            {Math.round(state.overallPercent)}% {phrase.sent}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function FileProgress({
  file,
  retrying,
  onPick,
}: {
  file: ChunkUploadFileState;
  retrying: { index: number; attempt: number; waitMs: number } | null;
  onPick: (file: File | null) => void;
}) {
  const inputId = `import-file-${file.kind}`;
  const piece = chunkLabel(file.currentChunkIndex, file.totalChunks);
  const percent = Math.round(file.percent);

  return (
    <div className="rounded-lg border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">{FILE_LABELS[file.kind]}</p>
          <p className="truncate text-sm text-muted-foreground" title={file.filename}>
            {file.filename}
            {file.totalBytes > 0 ? ` · ${formatBytes(file.totalBytes)}` : ""}
          </p>
        </div>
        <div className="text-right text-sm tabular-nums">
          {file.assembled ? (
            <span className="text-green-600 dark:text-green-400">Verified</span>
          ) : (
            <span className="text-muted-foreground">
              {piecesAccepted(file.uploadedChunks, file.totalChunks)}
            </span>
          )}
        </div>
      </div>

      {file.blocked ? (
        <div
          className={cn(
            "mt-3 rounded-lg border p-3 text-sm",
            file.blocked.kind === "refuse"
              ? "border-red-500/40 bg-red-500/10"
              : "border-border bg-muted/40",
          )}
          role={file.blocked.kind === "refuse" ? "alert" : undefined}
        >
          <p
            className={cn(
              "font-medium",
              file.blocked.kind === "refuse" && "text-red-900 dark:text-red-200",
            )}
          >
            {file.blocked.kind === "refuse"
              ? "That is not the file this run was started with"
              : "Choose the file again to carry on"}
          </p>
          <p className="mt-0.5 text-muted-foreground">{file.blocked.reason}</p>

          <label htmlFor={inputId} className="sr-only">
            Choose the {fileNameInSentence(file.kind)}
          </label>
          <input
            id={inputId}
            type="file"
            accept={CSV_FILE_ACCEPT}
            className="sr-only"
            onChange={(event) => onPick(event.target.files?.[0] ?? null)}
          />
          <Button
            variant={file.blocked.kind === "refuse" ? "outline" : "default"}
            size="sm"
            className="mt-2"
            onClick={() => document.getElementById(inputId)?.click()}
          >
            <FileUp />
            Choose file
          </Button>
        </div>
      ) : (
        <>
          <Progress
            value={percent}
            className="mt-3"
            aria-label={`${FILE_LABELS[file.kind]} upload progress`}
          >
            <ProgressLabel>{file.assembled ? "Uploaded" : (piece ?? "Waiting")}</ProgressLabel>
            <ProgressValue />
          </Progress>

          <p className="mt-2 text-xs text-muted-foreground tabular-nums">
            {formatBytes(file.completedBytes + file.inFlightBytes)} of{" "}
            {formatBytes(file.totalBytes)} sent · pieces of {formatBytes(file.chunkSize)}
          </p>

          {retrying ? (
            <p role="status" className="mt-1 text-xs text-amber-700 dark:text-amber-400">
              <Upload className="mr-1 inline size-3" aria-hidden="true" />
              Piece {retrying.index + 1} did not get through — trying again in{" "}
              {Math.round(retrying.waitMs / 1000)}s (attempt {retrying.attempt + 1}).
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function DigestMismatchNotice({
  mismatch,
  onResend,
  onCancelRun,
  cancelling,
}: {
  mismatch: DigestMismatch;
  onResend: () => void;
  onCancelRun: () => void;
  cancelling: boolean;
}) {
  return (
    <div
      role="alert"
      className="space-y-2 rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm"
    >
      <p className="font-medium text-red-900 dark:text-red-200">
        The rebuilt file does not match what was promised
      </p>
      <p className="text-muted-foreground">
        Every piece arrived intact, but joined together they do not hash to the
        value declared when this run was opened. Nothing has been imported, and{" "}
        <strong>the pieces have been kept</strong> — this does not have to start
        over.
      </p>
      <dl className="grid gap-1 font-mono text-xs text-muted-foreground">
        <div className="flex flex-wrap gap-2">
          <dt className="w-24 shrink-0 font-sans">Declared</dt>
          <dd className="break-all">{mismatch.declared ?? "—"}</dd>
        </div>
        <div className="flex flex-wrap gap-2">
          <dt className="w-24 shrink-0 font-sans">Rebuilt</dt>
          <dd className="break-all">{mismatch.assembled ?? "—"}</dd>
        </div>
        {mismatch.declaredSizeBytes !== null || mismatch.assembledSizeBytes !== null ? (
          <div className="flex flex-wrap gap-2">
            <dt className="w-24 shrink-0 font-sans">Size</dt>
            <dd>
              declared {mismatch.declaredSizeBytes?.toLocaleString() ?? "—"} bytes,
              rebuilt {mismatch.assembledSizeBytes?.toLocaleString() ?? "—"} bytes
            </dd>
          </div>
        ) : null}
      </dl>
      <div className="flex flex-wrap gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={onResend}>
          <RefreshCw />
          Send the pieces again
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancelRun} disabled={cancelling}>
          {cancelling ? "Cancelling…" : "Cancel and start a new run"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        If the file was edited on your computer after this run was opened, sending
        the same pieces again will change nothing — the server already holds those
        exact bytes. A new run is the fix in that case.
      </p>
    </div>
  );
}
