"use client";

/**
 * Getting two CSVs onto the server one piece at a time, and surviving the link.
 *
 * The arithmetic lives in @/lib/import-chunks and the resume guard lives in
 * @/lib/import-session; this is the part that actually talks to the network.
 * Everything here follows from three facts about the deployment:
 *
 *  1. **Serial, one chunk in flight.** The browser posts to the frontend host,
 *     which proxies through Next, which rewrites to the API — and the Next
 *     proxy buffers and clones the body, so every parallel request costs about
 *     twice its own size in resident memory on a box that is also serving the
 *     app. Serial also keeps the progress bar honest: with four in flight the
 *     percentage is an average of four half-finished things and it moves in a
 *     way that matches nothing the user can see.
 *  2. **The link stalls for tens of seconds.** So a failure is retried with
 *     backoff rather than surfaced, and a TIMEOUT is treated as "may have gone
 *     through" — we re-query which chunks landed before spending another one.
 *  3. **The server is the authority on what it holds.** `GET /imports/{run}`
 *     reports `missing_chunks` per file, and that — not our own bookkeeping —
 *     is what the resume sends.
 *
 * WHAT A CHUNK REQUEST ACTUALLY CARRIES. `UploadCsvImportChunkRequest` requires
 * a `chunk` file part AND a `sha256` field holding the SHA-256 of that slice
 * alone, 64 lowercase hex. That digest is not optional and there is no
 * unauthenticated fallback, which means an upload is only possible where
 * `crypto.subtle` exists — i.e. a secure context. `http://localhost` counts;
 * a plain-HTTP LAN origin does not, and there this feature must say so plainly
 * rather than fail with a 422 nobody can read.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  missingChunks,
  planChunks,
  resolveChunkSize,
  type ChunkPlan,
} from "@/lib/import-chunks";
import {
  resumableChunks,
  sameFile,
  type FileIdentity,
  type ImportSession,
} from "@/lib/import-session";
import { getErrorMessage } from "@/lib/api-error";
import { dataImportService } from "@/services/data-import.service";
import type {
  ImportFileKind,
  ImportFileStatus,
  ImportRunStatus,
} from "@/types/data-import";

/* ------------------------------------------------------------------ */
/* The per-file block                                                   */
/* ------------------------------------------------------------------ */

/**
 * `ImportFileStatus` itself — no longer widened here.
 *
 * This module used to declare a local `extends ImportFileStatus` that added
 * `original_filename`, `size_bytes` and `sha256` as OPTIONAL, because the
 * contract type omitted them while `CsvImportUploadService::runPayload()`
 * publishes them. They are on the contract now, and REQUIRED — after a reload
 * they are the only description of the file the admin is being asked to
 * re-pick, which is why `sameFile()` compares against them. So the local widening
 * is deleted rather than kept as a near-twin that quietly makes three required
 * fields optional again.
 */
type ServerFiles = Partial<Record<ImportFileKind, ImportFileStatus>>;

/* ------------------------------------------------------------------ */
/* Tuning                                                              */
/* ------------------------------------------------------------------ */

/** Attempts per chunk, first try included. */
export const MAX_CHUNK_ATTEMPTS = 5;

/** Backoff floor and ceiling. */
export const RETRY_BASE_MS = 1_000;
export const RETRY_MAX_MS = 15_000;

/**
 * How long a pause for `offline` may last before we try anyway.
 *
 * `navigator.onLine` and its events are advisory: a captive portal, a VPN
 * flapping, or a browser that simply never fires `online` again all leave the
 * flag stuck at false while the connection is fine. Waiting forever on a signal
 * that is allowed to be wrong turns a recoverable upload into a hung one, so
 * the pause has a ceiling and the network gets the final say.
 */
export const OFFLINE_WAIT_MS = 15_000;

/** The order files are sent in. Deterministic so progress is reproducible. */
const KIND_ORDER: readonly ImportFileKind[] = ["customers", "loans"];

export const INSECURE_CONTEXT_MESSAGE =
  "This page must be served over HTTPS (or opened on localhost) to upload. " +
  "The server checks each piece against a checksum, and the browser only " +
  "provides one on a secure connection.";

/* ------------------------------------------------------------------ */
/* Pure helpers — unit tested in ./use-chunk-upload.test.ts            */
/* ------------------------------------------------------------------ */

interface HttpErrorLike {
  response?: { status?: number; data?: Record<string, unknown> };
  code?: unknown;
}

function asHttpError(err: unknown): HttpErrorLike | null {
  return err && typeof err === "object" ? (err as HttpErrorLike) : null;
}

/** The HTTP status of a thrown value, or null when the request never answered. */
export function httpStatusOf(err: unknown): number | null {
  const status = asHttpError(err)?.response?.status;
  return typeof status === "number" ? status : null;
}

/** The response body of a thrown value, for the fields an error carries. */
export function errorBodyOf(err: unknown): Record<string, unknown> {
  const data = asHttpError(err)?.response?.data;
  return data && typeof data === "object" ? data : {};
}

/**
 * Axios reports a timeout on the error itself, never under `response`.
 *
 * Duplicated from the private `isTimeout` in @/lib/api-error rather than
 * shared, because that module exports only the finished copy. The two must stay
 * in step: the whole point is that a timeout and an offline are told apart, and
 * a chunk that timed out MAY have been stored.
 */
export function isTimeoutError(err: unknown): boolean {
  const code = asHttpError(err)?.code;
  return (
    typeof code === "string" &&
    (code.toUpperCase() === "ECONNABORTED" || code.toUpperCase() === "ETIMEDOUT")
  );
}

/**
 * A 422 that means the wire ate a byte, not that the request was wrong.
 *
 * The chunk endpoint returns 422 for two different things and they need
 * opposite handling:
 *
 *   - the declared digest did not match the bytes received — `declared_sha256`
 *     and `received_sha256`. Its own message says "Send this chunk again", and
 *     re-sending is exactly the fix.
 *   - the chunk is the wrong SIZE — `expected_size_bytes`. Our plan disagrees
 *     with the file's frozen `chunk_size`, and every retry produces the same
 *     bytes and the same refusal. Retrying that is a loop.
 */
export function isTransientDigestFailure(err: unknown): boolean {
  const body = errorBodyOf(err);
  if (body.expected_size_bytes !== undefined) return false;
  return (
    typeof body.received_sha256 === "string" &&
    typeof body.declared_sha256 === "string"
  );
}

export type ChunkFailureAction = "retry" | "refresh-then-retry" | "stop";

/**
 * What to do about a failed chunk.
 *
 * `refresh-then-retry` exists for the timeout alone. A 60 s axios timeout means
 * the request left the device and may well have been stored, so re-querying the
 * landed set first can turn a retry into a no-op — and asking is one cheap
 * request against a link that has already shown it is expensive.
 */
export function chunkFailureAction(err: unknown): ChunkFailureAction {
  const status = httpStatusOf(err);

  if (status === null) {
    return isTimeoutError(err) ? "refresh-then-retry" : "retry";
  }
  if (status === 408 || status === 429) return "retry";
  if (status >= 500) return "retry";
  if (status === 422 && isTransientDigestFailure(err)) return "retry";

  // Every other 4xx is a statement about the request, not the connection.
  // 409 = a different file resumed into this session; 413 = the chunk is
  // larger than a hop on the path will carry; 403/404 = the run is not ours.
  return "stop";
}

/** Exponential backoff, capped. `attempt` is 1-based: the delay AFTER try 1. */
export function retryDelayMs(
  attempt: number,
  baseMs: number = RETRY_BASE_MS,
  maxMs: number = RETRY_MAX_MS,
): number {
  if (attempt < 1) return baseMs;
  return Math.min(baseMs * 2 ** (attempt - 1), maxMs);
}

/**
 * How many of this chunk's bytes are on the wire, from an upload-progress event.
 *
 * `event.loaded` counts the whole multipart body — about 410 bytes of framing
 * plus the 64-character digest field — so it overshoots the slice and would
 * push a single-chunk file past 100%. Scaling by `event.total` when the browser
 * supplies it keeps the ratio right; clamping covers the case where it does not.
 */
export function inFlightBytesFor(
  chunkBytes: number,
  loaded: number,
  total?: number,
): number {
  if (!Number.isFinite(loaded) || loaded <= 0) return 0;
  if (typeof total === "number" && Number.isFinite(total) && total > 0) {
    return Math.min(chunkBytes, Math.round((loaded / total) * chunkBytes));
  }
  return Math.min(chunkBytes, Math.round(loaded));
}

/** Whole-file percentage: what is acknowledged, plus what is on the wire. */
export function wholeFilePercent(
  completedBytes: number,
  inFlightBytes: number,
  totalBytes: number,
): number {
  if (!Number.isFinite(totalBytes) || totalBytes <= 0) return 0;
  const done = Math.max(0, completedBytes) + Math.max(0, inFlightBytes);
  return Math.max(0, Math.min(100, (done / totalBytes) * 100));
}

/**
 * The chunk indices the server says it already holds.
 *
 * Derived from `missing_chunks` because that is what the endpoint publishes —
 * on a 99%-complete upload the missing set is the short one. Two rules:
 *
 *   - An assembled file has had its chunk rows deleted, and the server reports
 *     no missing chunks for it. Everything is held.
 *   - A TRUNCATED missing list is unusable. The list is capped at 500 entries,
 *     so "not in the list" no longer means "landed", and treating it as such
 *     skips chunks that were never sent — an assemble that fails at the very
 *     end. Nothing is claimed instead: every chunk is re-sent, and the ones the
 *     server already holds cost a 200 apiece.
 */
export function landedChunksFrom(
  block: ImportFileStatus | undefined,
  totalChunks: number,
): number[] {
  if (!block) return [];
  if (block.assembled) {
    return Array.from({ length: totalChunks }, (_, index) => index);
  }

  const listed = block.missing_chunks ?? [];

  // The list is only usable when it is provably the WHOLE missing set:
  // untruncated, and as long as the exact count the server publishes beside it.
  // Anything else — a cap that bit, a list and a count that disagree — makes
  // "absent from the list" stop meaning "landed", and skipping a chunk that was
  // never sent surfaces as an assemble failure at the very end of the upload.
  // Claiming nothing costs a 200 per chunk the server already holds.
  if (block.missing_chunks_truncated) return [];
  if (listed.length !== block.missing_chunk_count) return [];

  const missing = new Set(listed);
  const landed: number[] = [];
  for (let index = 0; index < totalChunks; index += 1) {
    if (!missing.has(index)) landed.push(index);
  }
  return landed;
}

export type ResumeVerdict =
  | { kind: "go"; reason: null }
  | { kind: "needs-file"; reason: string }
  | { kind: "refuse"; reason: string };

/** `File` satisfies this; a test stub does too. */
export interface PickedFileLike extends FileIdentity {
  slice: (start: number, end: number) => Blob;
}

/**
 * May we upload this pick into this run's slot?
 *
 * The refusal is the point. A `File` handle is not serialisable, so a returning
 * admin re-picks from disk and nothing stops them picking a different file.
 * Resuming a different file into a half-uploaded session appends its bytes to
 * the previous file's chunks, and the server assembles a CSV that is the head
 * of one export and the tail of another — which parses, into garbage rows, and
 * imports them as real members and loans.
 *
 * Three guards, strongest first, and any one of them is enough to refuse:
 *
 *   1. The stored session's identity, via `sameFile` — name, size AND
 *      `lastModified`, which is what catches a file edited in place.
 *   2. The server's own record of the file, when the session is gone (cleared
 *      browser, another device). Only name and size survive that far, but a
 *      wrong pick almost always differs in one of them.
 *   3. Failing both — a run with nothing received yet — there is nothing to
 *      contradict, and the per-chunk digest check on the server is the backstop:
 *      a chunk index already held with different bytes is a 409, refused before
 *      it can be spliced in.
 *
 * The chunk size is checked through `resumableChunks` rather than by hand,
 * because a landed index means nothing except relative to the size it was cut
 * with — and a server that re-advertises a different one invalidates every
 * stored index while `sameFile` passes happily.
 */
export function resumeVerdict(args: {
  picked: FileIdentity | null | undefined;
  block: ImportFileStatus | undefined;
  session: ImportSession | null | undefined;
  slot: ImportFileKind;
  advertisedChunkSize: unknown;
}): ResumeVerdict {
  const { picked, block, session, slot, advertisedChunkSize } = args;
  const received = block?.received_chunks ?? 0;

  if (!picked) {
    const name = session?.files[slot]?.name ?? block?.original_filename ?? "the same file";
    const total = block?.total_chunks ?? 0;
    return {
      kind: "needs-file",
      reason:
        received > 0
          ? `${received} of ${total} pieces of ${name} are already on the server. Pick ${name} again to carry on from there — the file itself is never stored in this browser, so it has to be re-opened.`
          : `Pick ${name} to start the upload.`,
    };
  }

  const stored = session?.files[slot];

  if (stored && !sameFile(stored, picked)) {
    return {
      kind: "refuse",
      reason:
        `This run was opened for ${stored.name} (${stored.size.toLocaleString()} bytes). ` +
        `${picked.name} is a different file, and continuing would join the two together into one CSV that still parses — as rows belonging to nobody. Cancel this run and start again with the file you want.`,
    };
  }

  if (!stored && received > 0 && block) {
    const serverName = block.original_filename;
    const serverSize = block.size_bytes;
    const nameDiffers = typeof serverName === "string" && serverName !== "" && serverName !== picked.name;
    const sizeDiffers = typeof serverSize === "number" && serverSize !== picked.size;

    if (nameDiffers || sizeDiffers) {
      const size = typeof serverSize === "number" ? ` (${serverSize.toLocaleString()} bytes)` : "";
      return {
        kind: "refuse",
        reason:
          `This run was opened for ${serverName ?? "another file"}${size}, and ${picked.name} does not match it. ` +
          "Continuing would join two different exports into one CSV. Cancel this run and start again with the file you want.",
      };
    }
  }

  if (
    session &&
    stored &&
    stored.uploadedChunks.length > 0 &&
    resumableChunks(session, slot, picked, block?.chunk_size ?? advertisedChunkSize).length === 0
  ) {
    return {
      kind: "refuse",
      reason:
        "The server has changed the size of the pieces it accepts since this run was opened, so the pieces already uploaded no longer line up with this file. Cancel this run and start a new one — nothing has been imported.",
    };
  }

  return { kind: "go", reason: null };
}

/** Lowercase hex, as `hash_file('sha256', ...)` produces on the other side. */
export function toHex(bytes: Uint8Array): string {
  let hex = "";
  for (const byte of bytes) hex += byte.toString(16).padStart(2, "0");
  return hex;
}

/** True when this browser can compute the digest every chunk request requires. */
export function hasSubtleCrypto(): boolean {
  return (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.subtle?.digest === "function"
  );
}

/**
 * SHA-256 of a blob, lowercase hex.
 *
 * Reads the blob into memory: Web Crypto has no streaming digest, and the
 * alternative is shipping a JS implementation of SHA-256 to hash files that are
 * a few hundred KB. Exported because run creation has to declare the digest of
 * each WHOLE file and must compute it exactly the way each chunk is computed.
 */
export async function sha256Hex(blob: Blob): Promise<string> {
  if (!hasSubtleCrypto()) throw new Error(INSECURE_CONTEXT_MESSAGE);
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    await blob.arrayBuffer(),
  );
  return toHex(new Uint8Array(digest));
}

/* ------------------------------------------------------------------ */
/* Published state                                                      */
/* ------------------------------------------------------------------ */

export interface ChunkUploadFileState {
  kind: ImportFileKind;
  /** What to call this file on screen: the pick, else the server's record. */
  filename: string;
  totalBytes: number;
  totalChunks: number;
  chunkSize: number;
  /** How many chunks the server has acknowledged. */
  uploadedChunks: number;
  /** 0-based index on the wire right now, or null. */
  currentChunkIndex: number | null;
  completedBytes: number;
  inFlightBytes: number;
  /** 0..100 for the whole file, in-flight bytes included. */
  percent: number;
  assembled: boolean;
  /** Set when this file cannot be sent: no pick, or the wrong one. */
  blocked: { kind: "needs-file" | "refuse"; reason: string } | null;
}

export interface DigestMismatch {
  fileKind: ImportFileKind | null;
  declared: string | null;
  assembled: string | null;
  declaredSizeBytes: number | null;
  assembledSizeBytes: number | null;
  message: string;
}

export type ChunkUploadPhase =
  | "idle"
  | "checking"
  | "uploading"
  | "paused"
  | "assembling"
  | "assembled"
  | "blocked"
  | "error";

export interface ChunkUploadState {
  phase: ChunkUploadPhase;
  files: ChunkUploadFileState[];
  /** Whole-run percentage across both files, by bytes. */
  overallPercent: number;
  /** Friendly copy, always through `getErrorMessage`. */
  error: string | null;
  /** An assemble that found the wrong digest. The chunks are still there. */
  digestMismatch: DigestMismatch | null;
  /** Between attempts: which chunk, which try, how long the wait is. */
  retrying: { kind: ImportFileKind; index: number; attempt: number; waitMs: number } | null;
  /** The browser has told us it is offline and the loop is waiting. */
  offline: boolean;
}

export interface UseChunkUploadOptions {
  /** Null before the run is opened. The hook idles rather than being called
   *  conditionally, which the rules of hooks forbid. */
  runId: number | string | null;
  /** The picked `File` per kind. Absent or null means "not in hand". */
  files: Partial<Record<ImportFileKind, File | null>>;
  /** `chunk_size` from the create-run response, raw. The per-file value the
   *  server reports wins over it when both exist. */
  advertisedChunkSize?: unknown;
  /** The stored session, for the re-pick guard. */
  session?: ImportSession | null;
  /** Begin as soon as the files and the server's view are both in hand. */
  autoStart?: boolean;
  /** Fired per acknowledged chunk so the shell can persist progress. */
  onChunkAcknowledged?: (kind: ImportFileKind, index: number) => void;
  /** Fired once both files are assembled, with a freshly read status. */
  onAssembled?: (status: ImportRunStatus) => void;
}

export interface UseChunkUploadResult {
  state: ChunkUploadState;
  /** The server's own view, re-read on mount, after a timeout, and after
   *  assembling. Null until the first read lands. */
  serverStatus: ImportRunStatus | null;
  /** Start, or resume after an error. */
  start: () => void;
  /** Re-send every chunk of one file into the same run, then assemble again —
   *  the answer to a digest mismatch, which keeps its chunks on purpose. */
  resend: (kind: ImportFileKind) => void;
  /** Stop the loop. Safe to call on unmount. */
  abort: () => void;
}

const EMPTY_STATE: ChunkUploadState = {
  phase: "idle",
  files: [],
  overallPercent: 0,
  error: null,
  digestMismatch: null,
  retrying: null,
  offline: false,
};

/* ------------------------------------------------------------------ */
/* The hook                                                             */
/* ------------------------------------------------------------------ */

export function useChunkUpload(options: UseChunkUploadOptions): UseChunkUploadResult {
  const {
    runId,
    files,
    advertisedChunkSize,
    session,
    autoStart = true,
    onChunkAcknowledged,
    onAssembled,
  } = options;

  const [state, setState] = useState<ChunkUploadState>(EMPTY_STATE);
  const [serverStatus, setServerStatus] = useState<ImportRunStatus | null>(null);
  const [startToken, setStartToken] = useState(0);

  // Everything the loop reads but must not restart for. Written in an effect
  // rather than during render: a ref mutated in the render body is read by the
  // running loop at whatever moment React happens to be re-rendering, and React
  // is explicit that this is not a supported thing to do.
  const filesRef = useRef(files);
  const sessionRef = useRef(session);
  const chunkSizeRef = useRef(advertisedChunkSize);
  const onChunkRef = useRef(onChunkAcknowledged);
  const onAssembledRef = useRef(onAssembled);

  // Declared before the effect that starts the upload, so the loop always sees
  // this commit's props rather than the previous one's.
  useEffect(() => {
    filesRef.current = files;
    sessionRef.current = session;
    chunkSizeRef.current = advertisedChunkSize;
    onChunkRef.current = onChunkAcknowledged;
    onAssembledRef.current = onAssembled;
  });

  /**
   * The tail of the upload chain.
   *
   * A new pass QUEUES behind the one it is replacing rather than being dropped
   * on the floor. React re-runs an effect on every dependency change — and in
   * development it mounts, tears down and mounts again — so "already running,
   * do nothing" loses the second pass entirely while the first is still
   * unwinding from its abort, and the upload never starts at all.
   */
  const pendingRef = useRef<Promise<void>>(Promise.resolve());
  const abortRef = useRef<AbortController | null>(null);
  const offlineRef = useRef(false);
  const onlineWaiters = useRef<Array<() => void>>([]);
  const serverFilesRef = useRef<ServerFiles>({});
  const landedRef = useRef<Partial<Record<ImportFileKind, Set<number>>>>({});
  const forceResendRef = useRef<Set<ImportFileKind>>(new Set());
  const stateRef = useRef<ChunkUploadState>(EMPTY_STATE);
  const activeSignatureRef = useRef<string>("");

  const publish = useCallback((next: ChunkUploadState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  /**
   * A signature of the picks, so the effect restarts when the admin re-picks a
   * file but not when the shell hands us a fresh object literal each render.
   */
  const pickSignature = useMemo(
    () =>
      KIND_ORDER.map((kind) => {
        const file = files[kind];
        return file ? `${kind}:${file.name}:${file.size}:${file.lastModified}` : `${kind}:-`;
      }).join("|"),
    [files],
  );

  /* -------------------- offline / online -------------------- */

  useEffect(() => {
    if (typeof window === "undefined") return;

    const goOffline = () => {
      offlineRef.current = true;
      publish({ ...stateRef.current, offline: true });
    };
    const goOnline = () => {
      offlineRef.current = false;
      publish({ ...stateRef.current, offline: false });
      const waiters = onlineWaiters.current;
      onlineWaiters.current = [];
      waiters.forEach((resolve) => resolve());
    };

    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, [publish]);

  /* -------------------- the engine -------------------- */

  const engine = useCallback(async (signature: string) => {
    if (runId === null) return;
    activeSignatureRef.current = signature;

    const controller = new AbortController();
    abortRef.current = controller;
    const { signal } = controller;

    // Abandoned either by an explicit abort, or because the admin picked a
    // different file while this pass was mid-flight — in which case every plan
    // and every landed index below describes a file we are no longer sending.
    const aborted = () => signal.aborted || activeSignatureRef.current !== signature;

    /** Sleep that wakes early when the run is abandoned. */
    const delay = (ms: number) =>
      new Promise<void>((resolve) => {
        const timer = setTimeout(finish, ms);
        function finish() {
          clearTimeout(timer);
          signal.removeEventListener("abort", finish);
          resolve();
        }
        signal.addEventListener("abort", finish);
      });

    /** Hold while the browser says it is offline — but never indefinitely. */
    const waitWhileOffline = async () => {
      if (!offlineRef.current || aborted()) return;
      publish({ ...stateRef.current, phase: "paused", offline: true });
      await Promise.race([
        new Promise<void>((resolve) => onlineWaiters.current.push(resolve)),
        delay(OFFLINE_WAIT_MS),
      ]);
      if (!aborted()) {
        publish({ ...stateRef.current, phase: "uploading", offline: offlineRef.current });
      }
    };

    const readStatus = async (): Promise<ImportRunStatus | null> => {
      try {
        const status = await dataImportService.status(runId);
        if (status && typeof status === "object") {
          serverFilesRef.current = status.files ?? {};
          setServerStatus(status);
        }
        return status ?? null;
      } catch {
        // A failed status read is not itself fatal: the loop can still send
        // what it believes is missing, and the next attempt asks again.
        return null;
      }
    };

    /** The on-screen model, rebuilt from the plans and the acknowledged set. */
    const snapshot = (
      plans: Partial<Record<ImportFileKind, ChunkPlan>>,
      blocks: Partial<Record<ImportFileKind, { kind: "needs-file" | "refuse"; reason: string } | null>>,
      current: { kind: ImportFileKind; index: number; bytes: number } | null,
      patch: Partial<ChunkUploadState> = {},
    ): ChunkUploadState => {
      const fileStates: ChunkUploadFileState[] = [];
      let totalBytes = 0;
      let doneBytes = 0;

      for (const kind of KIND_ORDER) {
        const picked = filesRef.current[kind] ?? null;
        const block = serverFilesRef.current[kind];
        if (!picked && !block) continue;

        const plan = plans[kind];
        const landed = landedRef.current[kind] ?? new Set<number>();
        const chunkSize = plan?.chunkSize ?? resolveChunkSize(block?.chunk_size ?? chunkSizeRef.current);
        const fileBytes = plan?.totalBytes ?? block?.size_bytes ?? 0;
        const totalChunks = plan?.totalChunks ?? block?.total_chunks ?? 0;

        let completedBytes = 0;
        if (plan) {
          for (const chunk of plan.chunks) {
            if (landed.has(chunk.index)) completedBytes += chunk.size;
          }
        } else if (block) {
          completedBytes = Math.min(fileBytes, block.received_chunks * chunkSize);
        }

        const inFlight = current?.kind === kind ? current.bytes : 0;

        fileStates.push({
          kind,
          filename: picked?.name ?? block?.original_filename ?? kind,
          totalBytes: fileBytes,
          totalChunks,
          chunkSize,
          // While a file is blocked there is no plan and nothing in the local
          // landed set, so the count has to come from the server — otherwise the
          // header reads "0 of 8 accepted" directly above a prompt saying 2 of 8
          // are already there, and the admin has two numbers and no way to tell
          // which is true.
          uploadedChunks: plan ? landed.size : (block?.received_chunks ?? 0),
          currentChunkIndex: current?.kind === kind ? current.index : null,
          completedBytes,
          inFlightBytes: inFlight,
          percent: wholeFilePercent(completedBytes, inFlight, fileBytes),
          assembled: Boolean(block?.assembled),
          blocked: blocks[kind] ?? null,
        });

        totalBytes += fileBytes;
        doneBytes += completedBytes + inFlight;
      }

      return {
        ...stateRef.current,
        files: fileStates,
        overallPercent: wholeFilePercent(doneBytes, 0, totalBytes),
        ...patch,
      };
    };

    try {
      publish({ ...EMPTY_STATE, phase: "checking" });

      if (!hasSubtleCrypto()) {
        publish({ ...EMPTY_STATE, phase: "error", error: INSECURE_CONTEXT_MESSAGE });
        return;
      }

      await readStatus();
      if (aborted()) return;

      const plans: Partial<Record<ImportFileKind, ChunkPlan>> = {};
      const blocks: Partial<Record<ImportFileKind, { kind: "needs-file" | "refuse"; reason: string } | null>> = {};
      const queue: ImportFileKind[] = [];

      for (const kind of KIND_ORDER) {
        const picked = filesRef.current[kind] ?? null;
        const block = serverFilesRef.current[kind];
        if (!picked && !block) continue;

        // An assembled file is finished; nothing about the pick matters.
        if (block?.assembled) {
          const size = resolveChunkSize(block.chunk_size ?? chunkSizeRef.current);
          plans[kind] = planChunks({ size: block.size_bytes ?? picked?.size ?? 0 }, size);
          landedRef.current[kind] = new Set(
            Array.from({ length: plans[kind]!.totalChunks }, (_, i) => i),
          );
          blocks[kind] = null;
          continue;
        }

        const verdict = resumeVerdict({
          picked,
          block,
          session: sessionRef.current,
          slot: kind,
          advertisedChunkSize: chunkSizeRef.current,
        });

        if (verdict.kind !== "go") {
          blocks[kind] = { kind: verdict.kind, reason: verdict.reason };
          continue;
        }

        blocks[kind] = null;
        const chunkSize = resolveChunkSize(block?.chunk_size ?? chunkSizeRef.current);
        const plan = planChunks(picked!, chunkSize);
        plans[kind] = plan;

        const forced = forceResendRef.current.has(kind);
        landedRef.current[kind] = new Set(
          forced ? [] : landedChunksFrom(block, plan.totalChunks),
        );
        queue.push(kind);
      }

      const anyRefused = KIND_ORDER.some((k) => blocks[k]?.kind === "refuse");
      const anyMissing = KIND_ORDER.some((k) => blocks[k]?.kind === "needs-file");

      // A refusal means this run cannot be finished with the files in hand, so
      // sending more bytes into it is waste. A file merely not picked yet is
      // different: the other file can still be uploaded while the admin finds
      // it, and only the assemble at the end has to wait for both.
      if (anyRefused) {
        publish(
          snapshot(plans, blocks, null, { phase: "blocked", error: null, retrying: null }),
        );
        return;
      }

      publish(snapshot(plans, blocks, null, { phase: "uploading", error: null }));

      /* ---- the serial send ---- */

      for (const kind of queue) {
        const plan = plans[kind]!;
        const picked = filesRef.current[kind]!;
        const landed = landedRef.current[kind]!;
        const outstanding = missingChunks(plan, landed);

        for (const index of outstanding) {
          const chunk = plan.chunks[index];
          if (!chunk) continue;

          for (let attempt = 1; attempt <= MAX_CHUNK_ATTEMPTS; attempt += 1) {
            if (aborted()) return;
            await waitWhileOffline();
            if (aborted()) return;

            try {
              const blob = picked.slice(chunk.start, chunk.end);
              const digest = await sha256Hex(blob);

              const body = new FormData();
              body.append("chunk", blob, `${picked.name}.part${index}`);
              body.append("sha256", digest);

              publish(
                snapshot(plans, blocks, { kind, index, bytes: 0 }, {
                  phase: "uploading",
                  retrying: null,
                  error: null,
                }),
              );

              await dataImportService.uploadChunk(runId, kind, index, body, {
                signal,
                onUploadProgress: (event) => {
                  publish(
                    snapshot(plans, blocks, {
                      kind,
                      index,
                      bytes: inFlightBytesFor(chunk.size, event.loaded, event.total),
                    }),
                  );
                },
              });

              // 201 stored and 200 already-held are both success, and are
              // indistinguishable here: `api.upload` returns the unwrapped body
              // and drops the status code. That costs nothing — the required
              // behaviour for an idempotent replay is to carry on either way.
              landed.add(index);
              onChunkRef.current?.(kind, index);
              publish(snapshot(plans, blocks, null, { retrying: null }));
              break;
            } catch (err) {
              if (aborted()) return;

              const action = chunkFailureAction(err);

              if (action === "refresh-then-retry") {
                await readStatus();
                const refreshed = landedChunksFrom(
                  serverFilesRef.current[kind],
                  plan.totalChunks,
                );
                if (refreshed.includes(index)) {
                  // It did go through. The timeout was about the answer, not
                  // the request.
                  landed.add(index);
                  onChunkRef.current?.(kind, index);
                  publish(snapshot(plans, blocks, null, { retrying: null }));
                  break;
                }
              }

              if (action === "stop" || attempt === MAX_CHUNK_ATTEMPTS) {
                publish(
                  snapshot(plans, blocks, null, {
                    phase: "error",
                    retrying: null,
                    error: getErrorMessage(
                      err,
                      `Could not upload piece ${index + 1} of ${plan.totalChunks}.`,
                    ),
                  }),
                );
                return;
              }

              const waitMs = retryDelayMs(attempt);
              publish(
                snapshot(plans, blocks, null, {
                  phase: "uploading",
                  retrying: { kind, index, attempt, waitMs },
                  error: null,
                }),
              );
              await delay(waitMs);
            }
          }
        }
      }

      if (aborted()) return;

      if (anyMissing) {
        // Everything in hand is on the server; the run cannot be assembled
        // until the other file is picked.
        publish(
          snapshot(plans, blocks, null, { phase: "blocked", error: null, retrying: null }),
        );
        return;
      }

      /* ---- assemble ---- */

      publish(snapshot(plans, blocks, null, { phase: "assembling", retrying: null }));

      try {
        await dataImportService.assemble(runId);
      } catch (err) {
        if (aborted()) return;

        const body = errorBodyOf(err);
        const isDigestMismatch =
          httpStatusOf(err) === 422 && typeof body.assembled_sha256 === "string";

        if (isDigestMismatch) {
          publish(
            snapshot(plans, blocks, null, {
              phase: "error",
              error: getErrorMessage(err),
              digestMismatch: {
                fileKind: (body.kind as ImportFileKind) ?? null,
                declared: (body.declared_sha256 as string) ?? null,
                assembled: (body.assembled_sha256 as string) ?? null,
                declaredSizeBytes: (body.declared_size_bytes as number) ?? null,
                assembledSizeBytes: (body.assembled_size_bytes as number) ?? null,
                message: getErrorMessage(err),
              },
            }),
          );
          return;
        }

        publish(
          snapshot(plans, blocks, null, {
            phase: "error",
            error: getErrorMessage(err, "The uploaded pieces could not be joined back together."),
          }),
        );
        return;
      }

      forceResendRef.current.clear();

      // `assemble` answers with a flat body, so `api.post` unwraps it to
      // undefined and its declared `ImportRunStatus` never arrives. The status
      // endpoint is properly enveloped, so the run is re-read rather than
      // trusted from the return value.
      const fresh = await readStatus();
      if (aborted()) return;

      publish(
        snapshot(plans, blocks, null, {
          phase: "assembled",
          error: null,
          retrying: null,
          digestMismatch: null,
        }),
      );

      if (fresh) onAssembledRef.current?.(fresh);
    } catch {
      // Anything not already turned into copy above. The pass ends; `start`
      // runs another one.
      if (!signal.aborted) {
        publish({ ...stateRef.current, phase: "error", error: getErrorMessage(null) });
      }
    }
  }, [publish, runId]);

  /** Abort whatever is in flight and queue a fresh pass behind it. */
  const launch = useCallback(
    (signature: string) => {
      abortRef.current?.abort();
      const previous = pendingRef.current;
      pendingRef.current = previous
        .catch(() => undefined)
        .then(() => engine(signature));
    },
    [engine],
  );

  useEffect(() => {
    if (!autoStart && startToken === 0) return;
    // `pickSignature` changes when the admin picks a different file, and NOT
    // when the shell re-renders with a fresh object literal — which is what
    // stops a controlled `files` prop from restarting the upload every render.
    launch(pickSignature);
    return () => {
      abortRef.current?.abort();
    };
  }, [launch, autoStart, startToken, pickSignature]);

  const start = useCallback(() => {
    setStartToken((token) => token + 1);
  }, []);

  const resend = useCallback((kind: ImportFileKind) => {
    forceResendRef.current.add(kind);
    landedRef.current[kind] = new Set();
    setStartToken((token) => token + 1);
  }, []);

  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { state, serverStatus, start, resend, abort };
}
