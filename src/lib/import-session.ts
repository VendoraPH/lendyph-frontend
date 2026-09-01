/**
 * The scrap of paper that lets an interrupted CSV import be picked up again.
 *
 * The failure this exists to stop: an admin is 30 chunks into migrating a
 * co-operative's book, the link drops or the laptop sleeps or the tab is
 * closed, and every decision they made on the way in — which branch, which CSV
 * product column maps to which Lendyph loan product, whether row 1 is a header,
 * whether 03/04 is March or April — dies with the React tree. Without this they
 * start the whole import from the first screen and re-answer all of it, which
 * in practice means they re-answer one of them differently and the migration
 * lands wrong.
 *
 * What is stored is only enough to REATTACH: the server's session id, the
 * answers, and the per-file chunk bookkeeping. The rows themselves are never
 * persisted — they live in the server's session, and the file lives on the
 * admin's disk.
 *
 * Modelled on @/lib/registration-key: the store is injectable and every single
 * access is wrapped, because storage does not merely return null when it is
 * unavailable, it THROWS (Safari lockdown mode, an in-app browser with
 * third-party storage blocked). A dead store degrades to "no resume", never to
 * a crash on mount.
 */

import { resolveChunkSize } from "./import-chunks";
import type { ImportFileKind } from "@/types/data-import";

// localStorage, NOT sessionStorage — a deliberate departure from the
// registration-key module next door, and the reason is the opposite of its
// reason. That module chose sessionStorage because its value must not outlive
// the tab: a stale idempotency key can only ever be refused by the server, so
// the safest lifetime is the shortest one. Here the entire requirement is
// surviving a closed tab and a browser crash, and sessionStorage is defined to
// be discarded by exactly those two events. It would throw away the record in
// precisely the cases the feature was built for.
//
// The risk that buys — a stale entry offering a resume that is no longer real —
// is contained on both sides: the entry is validated against the server on
// mount and discarded if the session is gone, and anything older than
// IMPORT_SESSION_TTL_MS is discarded here without asking.
const STORAGE_KEY = "lendyph.import_session";

/**
 * The shape number of the record at STORAGE_KEY.
 *
 * Stamped on save and required on load, so an entry written by an older build
 * is DISCARDED rather than half-read. The distinction matters more here than in
 * most stores: the answers in this record are applied to a file the browser
 * re-opens from disk, and a record that parses but means something different is
 * how the wrong header setting gets re-applied to the wrong file — a member row
 * eaten as a heading, or a heading imported as a member. `isImportSession`
 * checks value shapes, not meaning, so the version is the only thing that can
 * catch a change of meaning.
 *
 * 1 -> 2: `hasHeaderRow` and `dateFormat` became per-file. A v1 entry fails on
 * both the version and the value shape, and is deleted on the way out.
 */
export const IMPORT_SESSION_VERSION = 2;

/**
 * How long a stored session is worth offering.
 *
 * This mirrors the server's own upload-session TTL and must never exceed it:
 * the server is the authority, and a client that offers a resume the server has
 * already dropped sends the admin down a path that 404s. The clock runs from
 * when the session was OPENED, not from the last write, because that is what
 * the server's expiry counts from — refreshing it on every chunk would keep a
 * dead session in the picker indefinitely.
 */
export const IMPORT_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * The three things a browser can tell us about a file without reading it.
 *
 * Not a hash. Content fingerprinting via `crypto.subtle` needs a secure
 * context, and this repo deliberately accommodates plain-HTTP dev origins (a
 * phone on the LAN IP); the File System Access API, which could re-open the
 * handle without re-picking, is Chromium-only. The server checksums the
 * assembled file independently, so this is the client's half of a two-sided
 * check, not the whole of it.
 */
export interface FileIdentity {
  name: string;
  size: number;
  /** Epoch ms from the filesystem. */
  lastModified: number;
}

export interface ImportSessionFile extends FileIdentity {
  /** From `planChunks`, so a resume can size the progress bar before re-reading. */
  totalChunks: number;
  /** Indices the server has acknowledged. Feed to `missingChunks`. */
  uploadedChunks: number[];
}

export interface ImportSession {
  /** The shape of this record. See IMPORT_SESSION_VERSION. */
  version: number;
  /** Issued by upload-init. Everything else is meaningless without it. */
  sessionId: string;
  /** Branch the imported members and loans are created under. */
  branchId: number;
  /** CSV product label -> Lendyph `LoanProduct.id`. Genuinely per RUN, not per
   *  file: only the loans file names products. */
  productMap: Record<string, number>;
  /**
   * Whether row 1 of each file is column headings, PER FILE.
   *
   * Not one boolean, because it genuinely is not one answer: a coop's export
   * routinely has a header on the members file and none on the loans file, and
   * the server models it per file too (`ImportFileStatus.staging.header_skipped`).
   * One boolean re-applied to both on resume silently eats a member row as a
   * heading, or imports a heading as a member — and nothing downstream can tell,
   * because both outcomes parse.
   *
   * A MISSING key means "not answered for this file". It must never be read as
   * `false`: `if (session.hasHeaderRow[kind])` turns an unanswered question into
   * "no header", which is the same bug by another route. Check for `undefined`
   * and ask again.
   */
  hasHeaderRow: Partial<Record<ImportFileKind, boolean>>;
  /**
   * The date order the admin confirmed, per file and per COLUMN within it —
   * e.g. `{ customers: { birth_date: "dd/MM/yyyy" } }`.
   *
   * Per column because that is how it is settled: 03/04 is ambiguous on its own,
   * and a file can carry a birth date written one way and a release date written
   * the other. A single string for the whole import cannot express that, and
   * collapsing to one silently re-dates a column on resume.
   *
   * A missing file key or column key means "not answered", never a default.
   */
  dateFormat: Partial<Record<ImportFileKind, Record<string, string>>>;
  /** The size the plan was built with — the server advertises its own. */
  chunkSize: number;
  /** Keyed by upload slot, and the slot keys are the API's own
   *  `ImportFileKind` — "customers" and "loans", never "members". The record is
   *  `Record<string, …>`, so a second spelling costs nothing at compile time
   *  and everything at runtime: `resumableChunks(session, "customers", …)`
   *  would find no entry, return `[]`, and quietly re-upload a file that was
   *  already on the server — a resume that silently finds nothing, which is the
   *  exact failure this module exists to prevent. The server keys on the same
   *  word in the chunk route (`/files/{kind}/chunks/{index}`) and in the status
   *  payload's `files` map, so there is one vocabulary and this is it.
   *
   *  Keyed by slot rather than by filename because on resume the admin re-picks
   *  per slot; matching by name would break the moment a file is renamed, and
   *  would silently swap two files picked in the other order. */
  files: Partial<Record<ImportFileKind, ImportSessionFile>>;
  /** Epoch ms the session was opened. Drives expiry; stamped on first save. */
  startedAt: number;
}

/** A session on its way in: the timestamp and the version are this module's to
 *  stamp, so no caller can write a record that lies about its own shape. */
export type NewImportSession = Omit<ImportSession, "startedAt" | "version"> & {
  startedAt?: number;
};

/** Structural, so `window.localStorage` and a Map-backed test double both fit. */
export interface SessionStore {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

export interface SessionEnvironment {
  storage?: SessionStore | null;
  /** Injectable clock, so expiry is testable without waiting a day. */
  now?: number;
  ttlMs?: number;
}

// Reading localStorage can throw outright, so even reaching for the object is
// guarded. Same lesson as registration-key.ts, same shape.
function defaultStorage(): SessionStore | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function resolveStorage(env: SessionEnvironment): SessionStore | null {
  return env.storage === undefined ? defaultStorage() : env.storage;
}

function isFileRecord(value: unknown): value is ImportSessionFile {
  if (!value || typeof value !== "object") return false;
  const file = value as Record<string, unknown>;
  return (
    typeof file.name === "string" &&
    typeof file.size === "number" &&
    typeof file.lastModified === "number" &&
    typeof file.totalChunks === "number" &&
    Array.isArray(file.uploadedChunks) &&
    file.uploadedChunks.every((index) => typeof index === "number")
  );
}

/**
 * Whether a parsed blob is a session we can act on.
 *
 * Deliberately strict. This value survives across releases and browser
 * restarts, so it can be a shape from an older build, a half-written string, or
 * something a user pasted into devtools. A partially-valid session is worse
 * than none: `uploadedChunks` arriving as null crashes the resume on mount, and
 * a missing `productMap` imports every loan under the wrong product. Anything
 * that does not typecheck at runtime is dropped and the admin starts clean.
 */
function isRecordOf(
  value: unknown,
  valueIsValid: (entry: unknown) => boolean,
): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value as Record<string, unknown>).every(valueIsValid);
}

export function isImportSession(value: unknown): value is ImportSession {
  if (!value || typeof value !== "object") return false;
  const session = value as Record<string, unknown>;
  // The version first: a record from an older shape may satisfy every check
  // below and still MEAN something different.
  if (session.version !== IMPORT_SESSION_VERSION) return false;
  if (typeof session.sessionId !== "string" || session.sessionId === "") return false;
  if (typeof session.branchId !== "number") return false;
  if (!isRecordOf(session.hasHeaderRow, (entry) => typeof entry === "boolean")) return false;
  if (
    !isRecordOf(session.dateFormat, (perFile) =>
      isRecordOf(perFile, (format) => typeof format === "string"),
    )
  ) {
    return false;
  }
  if (typeof session.chunkSize !== "number") return false;
  if (typeof session.startedAt !== "number") return false;
  if (!session.productMap || typeof session.productMap !== "object") return false;
  if (
    !Object.values(session.productMap as Record<string, unknown>).every(
      (id) => typeof id === "number",
    )
  ) {
    return false;
  }
  if (!session.files || typeof session.files !== "object") return false;
  return Object.values(session.files as Record<string, unknown>).every(isFileRecord);
}

/**
 * Is the file the admin just picked the same file the session was opened with?
 *
 * A correctness guard, not a nicety. A `File` handle is not serialisable and
 * cannot survive a reload, so a resuming admin has to re-pick from the disk —
 * and nothing stops them picking a different one. Resuming a DIFFERENT file
 * into a half-uploaded session appends its bytes to the previous file's chunks,
 * and the server assembles a CSV that is the head of one file and the tail of
 * another. That does not fail loudly: it parses, into garbage rows, which get
 * imported as members and loans. All three fields must match or the resume is
 * refused and the upload starts over — which costs seconds on a 44-member file
 * and is the only safe answer.
 *
 * `lastModified` is what catches the case the other two miss: the same file,
 * edited in place to fix a typo, keeping its name and coincidentally its size.
 */
export function sameFile(
  stored: FileIdentity | null | undefined,
  picked: FileIdentity | null | undefined,
): boolean {
  if (!stored || !picked) return false;
  return (
    stored.name === picked.name &&
    stored.size === picked.size &&
    stored.lastModified === picked.lastModified
  );
}

/**
 * The chunk indices this resume is allowed to skip — or nothing at all.
 *
 * The ONLY supported way to read `uploadedChunks` back out of a stored session.
 * Reaching into `session.files[slot].uploadedChunks` directly is a bug, because
 * a landed index is meaningless on its own: it names a byte range, and it names
 * it relative to both the file it was cut from and the size it was cut with.
 * Two things invalidate the whole set, and skipping either check produces the
 * same corruption — a CSV assembled from the head of one file and the tail of
 * another, which parses cleanly into garbage rows and imports them:
 *
 *   1. A different file was re-picked. `sameFile` catches that.
 *   2. The same file, but the server re-advertised a different `chunk_size` on
 *      reattach. Nothing about the file changed, so `sameFile` passes happily
 *      while every stored index now points at the wrong bytes.
 *
 * Both live in one function on purpose. This started as a comment telling the
 * reattach flow to remember the second check, and a comment is not a guard: the
 * reader who needs it is precisely the reader who will not go looking for it.
 * Returning `[]` on any mismatch means the worst case is re-sending a file that
 * takes seconds, and there is no case where a stale index survives.
 *
 * `advertisedChunkSize` is taken raw, exactly as upload-init returned it, and
 * both sides are normalised through `resolveChunkSize` — so a server that sends
 * `"1048576"` as a string, or a value clamped to the same ceiling, still
 * compares equal to what the upload was actually planned with.
 */
export function resumableChunks(
  session: ImportSession,
  slot: ImportFileKind,
  picked: FileIdentity | null | undefined,
  advertisedChunkSize: unknown,
): number[] {
  const file = session.files[slot];
  if (!file || !sameFile(file, picked)) return [];
  if (resolveChunkSize(advertisedChunkSize) !== resolveChunkSize(session.chunkSize)) {
    return [];
  }
  return [...file.uploadedChunks];
}

/**
 * Persist the session. Stamps `startedAt` on the first save and preserves it
 * afterwards, so re-saving after every chunk records progress without quietly
 * extending the lifetime of a session the server is already counting down.
 */
export function saveImportSession(
  session: NewImportSession,
  env: SessionEnvironment = {},
): void {
  const storage = resolveStorage(env);
  if (!storage) return;
  const stamped: ImportSession = {
    ...session,
    version: IMPORT_SESSION_VERSION,
    startedAt: session.startedAt ?? env.now ?? Date.now(),
  };
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(stamped));
  } catch {
    // Full, blocked, or serialisation refused. The import in this tab still
    // works end to end; only the crash-recovery path is lost, and losing it
    // silently is better than failing an upload that would have succeeded.
  }
}

/**
 * The session to offer a resume for, or null.
 *
 * Null covers every unhappy case identically — no entry, unreadable store,
 * unparseable JSON, a shape from an older release, or expired — because the
 * caller's response to all of them is the same: start a fresh import. Expired
 * and malformed entries are deleted on the way out so they are not re-parsed on
 * every mount.
 */
export function loadImportSession(env: SessionEnvironment = {}): ImportSession | null {
  const storage = resolveStorage(env);
  if (!storage) return null;

  let raw: string | null = null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    clearImportSession(env);
    return null;
  }

  if (!isImportSession(parsed)) {
    clearImportSession(env);
    return null;
  }

  const now = env.now ?? Date.now();
  const ttl = env.ttlMs ?? IMPORT_SESSION_TTL_MS;
  if (now - parsed.startedAt > ttl) {
    clearImportSession(env);
    return null;
  }

  return parsed;
}

/** Forget the session — on completion, on cancel, and when the server has no
 *  record of it. */
export function clearImportSession(env: SessionEnvironment = {}): void {
  const storage = resolveStorage(env);
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // A store that cannot delete could not have persisted either.
  }
}

/**
 * Record one acknowledged chunk and persist immediately.
 *
 * Persisting after EVERY chunk is the whole mechanism: whatever is on disk when
 * the process dies is what the resume gets, so batching writes would lose
 * exactly the chunks the crash was closest to. Indices are de-duplicated and
 * kept ascending — a retried chunk can be acknowledged twice, and a progress
 * count derived from a list with duplicates in it reads above 100%.
 *
 * Returns the updated session so the caller can hold it in state; an unknown
 * slot is returned untouched rather than inventing a file entry.
 */
export function recordUploadedChunk(
  session: ImportSession,
  slot: ImportFileKind,
  index: number,
  env: SessionEnvironment = {},
): ImportSession {
  const file = session.files[slot];
  if (!file || file.uploadedChunks.includes(index)) return session;

  const updated: ImportSession = {
    ...session,
    files: {
      ...session.files,
      [slot]: {
        ...file,
        uploadedChunks: [...file.uploadedChunks, index].sort((a, b) => a - b),
      },
    },
  };
  saveImportSession(updated, env);
  return updated;
}
