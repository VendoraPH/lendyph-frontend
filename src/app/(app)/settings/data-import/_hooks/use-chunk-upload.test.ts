import { test } from "node:test";
import assert from "node:assert/strict";
import {
  chunkFailureAction,
  errorBodyOf,
  httpStatusOf,
  inFlightBytesFor,
  isTimeoutError,
  isTransientDigestFailure,
  landedChunksFrom,
  MAX_CHUNK_ATTEMPTS,
  resumeVerdict,
  retryDelayMs,
  RETRY_MAX_MS,
  toHex,
  wholeFilePercent,
  type ServerFileBlock,
} from "./use-chunk-upload";
import type { ImportSession } from "@/lib/import-session";
import { IMPORT_CHUNK_SIZE } from "@/lib/import-chunks";

/** An axios-shaped rejection: status and body under `response`. */
function httpError(status: number, data: Record<string, unknown> = {}) {
  return { response: { status, data } };
}

/** A timeout: no `response` at all, and the code on the error itself. */
const timeout = { code: "ECONNABORTED", message: "timeout of 60000ms exceeded" };
const offline = { message: "Network Error" };

function block(overrides: Partial<ServerFileBlock> = {}): ServerFileBlock {
  return {
    chunk_size: IMPORT_CHUNK_SIZE,
    total_chunks: 5,
    received_chunks: 0,
    missing_chunks: [0, 1, 2, 3, 4],
    missing_chunk_count: 5,
    missing_chunks_truncated: false,
    assembled: false,
    counts: {
      total: 0,
      imported: 0,
      matched_existing: 0,
      already_imported: 0,
      skipped: 0,
      failed: 0,
    },
    staging: {
      delimiter: null,
      encoding_note: null,
      header_skipped: false,
      record_count: null,
      column_count: null,
    },
    ...overrides,
  };
}

function session(overrides: Partial<ImportSession> = {}): ImportSession {
  return {
    version: 2,
    sessionId: "42",
    branchId: 1,
    productMap: {},
    hasHeaderRow: { customers: true, loans: false },
    dateFormat: { customers: { birth_date: "dd/MM/yyyy" } },
    chunkSize: IMPORT_CHUNK_SIZE,
    files: {},
    startedAt: 1_700_000_000_000,
    ...overrides,
  };
}

/* ── reading a thrown value ─────────────────────────────────────────── */

test("a request that never answered has no status, so offline and timeout are distinguishable", () => {
  assert.equal(httpStatusOf(httpError(409)), 409);
  assert.equal(httpStatusOf(timeout), null);
  assert.equal(httpStatusOf(offline), null);
  assert.equal(httpStatusOf(null), null);
  assert.equal(httpStatusOf("boom"), null);
});

test("a timeout is recognised from the code on the error, never from a response", () => {
  assert.equal(isTimeoutError(timeout), true);
  assert.equal(isTimeoutError({ code: "etimedout" }), true);
  assert.equal(isTimeoutError(offline), false);
  assert.equal(isTimeoutError(httpError(504)), false);
});

test("a missing body reads as empty rather than throwing", () => {
  assert.deepEqual(errorBodyOf(offline), {});
  assert.deepEqual(errorBodyOf(httpError(422, { a: 1 })), { a: 1 });
});

/* ── what to do about a failure ─────────────────────────────────────── */

test("a timeout re-queries what landed before spending another request", () => {
  // The 60 s timeout means the request LEFT the device; the chunk may well be
  // stored. Retrying blind spends a whole chunk on a link that already stalled.
  assert.equal(chunkFailureAction(timeout), "refresh-then-retry");
});

test("a genuine network drop is retried without a round trip first", () => {
  assert.equal(chunkFailureAction(offline), "retry");
});

test("408 and 429 are retried; every other 4xx stops", () => {
  assert.equal(chunkFailureAction(httpError(408)), "retry");
  assert.equal(chunkFailureAction(httpError(429)), "retry");

  for (const status of [400, 401, 403, 404, 409, 413, 415]) {
    assert.equal(chunkFailureAction(httpError(status)), "stop", `status ${status}`);
  }
});

test("5xx is retried — the server may simply have been restarted", () => {
  for (const status of [500, 502, 503, 504]) {
    assert.equal(chunkFailureAction(httpError(status)), "retry", `status ${status}`);
  }
});

test("the two 422s from the chunk endpoint are told apart", () => {
  // "the wire ate a byte" — its own message says to send the chunk again.
  const corrupted = httpError(422, {
    message: "Chunk 3 did not survive the upload…",
    declared_sha256: "a".repeat(64),
    received_sha256: "b".repeat(64),
  });
  assert.equal(isTransientDigestFailure(corrupted), true);
  assert.equal(chunkFailureAction(corrupted), "retry");

  // "the chunk is the wrong size" — the same bytes produce the same refusal
  // forever, so retrying is a loop.
  const wrongSize = httpError(422, {
    message: "Chunk 3 is 1024 bytes; this file's chunk 3 must be exactly 524288 bytes.",
    expected_size_bytes: 524_288,
    received_size_bytes: 1024,
    chunk_size: 524_288,
  });
  assert.equal(isTransientDigestFailure(wrongSize), false);
  assert.equal(chunkFailureAction(wrongSize), "stop");
});

test("a 409 stops — it means a different file was resumed into this session", () => {
  const differentFile = httpError(409, {
    message: "Chunk 0 was already received with a different digest…",
    stored_sha256: "a".repeat(64),
    received_sha256: "b".repeat(64),
  });
  // Carries a digest pair, but the status decides: this is not corruption.
  assert.equal(chunkFailureAction(differentFile), "stop");
});

/* ── backoff ────────────────────────────────────────────────────────── */

test("backoff doubles and then stops growing", () => {
  assert.equal(retryDelayMs(1), 1_000);
  assert.equal(retryDelayMs(2), 2_000);
  assert.equal(retryDelayMs(3), 4_000);
  assert.equal(retryDelayMs(4), 8_000);
  assert.equal(retryDelayMs(5), RETRY_MAX_MS);
  assert.equal(retryDelayMs(50), RETRY_MAX_MS);
  // A nonsensical attempt number must not produce a negative or NaN wait.
  assert.equal(retryDelayMs(0), 1_000);
});

test("the whole retry ladder for one chunk stays inside a minute of waiting", () => {
  let total = 0;
  for (let attempt = 1; attempt < MAX_CHUNK_ATTEMPTS; attempt += 1) {
    total += retryDelayMs(attempt);
  }
  assert.ok(total <= 60_000, `waited ${total}ms between attempts`);
});

/* ── progress arithmetic ────────────────────────────────────────────── */

test("in-flight bytes never exceed the chunk, even though the body is bigger than it", () => {
  const chunk = 512 * 1024;
  // ~410 B of multipart framing plus a 64-char digest field ride along, so
  // `loaded` overshoots the slice and would push a one-chunk file past 100%.
  const bodyBytes = chunk + 410 + 80;
  assert.equal(inFlightBytesFor(chunk, bodyBytes, bodyBytes), chunk);
  assert.equal(inFlightBytesFor(chunk, bodyBytes), chunk);
  assert.equal(inFlightBytesFor(chunk, bodyBytes / 2, bodyBytes), chunk / 2);
  assert.equal(inFlightBytesFor(chunk, 0, bodyBytes), 0);
});

test("a whole-file percentage counts what is acknowledged plus what is on the wire", () => {
  assert.equal(wholeFilePercent(0, 0, 1000), 0);
  assert.equal(wholeFilePercent(500, 0, 1000), 50);
  assert.equal(wholeFilePercent(500, 250, 1000), 75);
  assert.equal(wholeFilePercent(1000, 0, 1000), 100);
  // Never past 100, and never NaN on an empty file.
  assert.equal(wholeFilePercent(1200, 500, 1000), 100);
  assert.equal(wholeFilePercent(0, 0, 0), 0);
});

/* ── the landed set ─────────────────────────────────────────────────── */

test("a fresh run has nothing landed", () => {
  assert.deepEqual(landedChunksFrom(block(), 5), []);
});

test("the gap between the missing list and the plan is what has landed", () => {
  const partial = block({
    received_chunks: 3,
    missing_chunks: [1, 4],
    missing_chunk_count: 2,
  });
  assert.deepEqual(landedChunksFrom(partial, 5), [0, 2, 3]);
});

test("an assembled file has everything, because its chunk rows are deleted", () => {
  // The server reports no missing chunks for an assembled file. Deriving the
  // landed set naively would be right here by accident; it is stated instead.
  const done = block({
    assembled: true,
    received_chunks: 5,
    missing_chunks: [],
    missing_chunk_count: 0,
  });
  assert.deepEqual(landedChunksFrom(done, 5), [0, 1, 2, 3, 4]);
});

test("a truncated missing list claims nothing rather than claiming too much", () => {
  // The list is capped at 500. Past the cap, "absent from the list" stops
  // meaning "landed", and skipping a chunk that was never sent only surfaces
  // as a failed assemble at the very end.
  const truncated = block({
    total_chunks: 1000,
    received_chunks: 400,
    missing_chunks: Array.from({ length: 500 }, (_, i) => i),
    missing_chunk_count: 600,
    missing_chunks_truncated: true,
  });
  assert.deepEqual(landedChunksFrom(truncated, 1000), []);
});

test("a missing list that disagrees with its own count is not trusted", () => {
  // Not truncated, but the list is shorter than the exact count beside it —
  // the two cannot both be right, so neither is used.
  const inconsistent = block({
    received_chunks: 1,
    missing_chunks: [1],
    missing_chunk_count: 4,
  });
  assert.deepEqual(landedChunksFrom(inconsistent, 5), []);
});

test("an absent file block landed nothing", () => {
  assert.deepEqual(landedChunksFrom(undefined, 5), []);
});

/* ── the resume guard ───────────────────────────────────────────────── */

const picked = { name: "members.csv", size: 2_000, lastModified: 1_700_000_000_000 };

test("with nothing picked, the admin is told what already landed and asked for that file", () => {
  const verdict = resumeVerdict({
    picked: null,
    block: block({ received_chunks: 3, original_filename: "members.csv" }),
    session: null,
    slot: "customers",
    advertisedChunkSize: IMPORT_CHUNK_SIZE,
  });
  assert.equal(verdict.kind, "needs-file");
  assert.match(verdict.reason, /3 of 5/);
  assert.match(verdict.reason, /members\.csv/);
});

test("a different file re-picked into a half-uploaded run is refused, and says why", () => {
  // Splicing two exports produces a CSV that still parses — into rows belonging
  // to nobody, which then import as real members and loans.
  const verdict = resumeVerdict({
    picked: { ...picked, name: "members-final.csv" },
    block: block({ received_chunks: 3 }),
    session: session({
      files: {
        customers: { ...picked, totalChunks: 5, uploadedChunks: [0, 1, 2] },
      },
    }),
    slot: "customers",
    advertisedChunkSize: IMPORT_CHUNK_SIZE,
  });
  assert.equal(verdict.kind, "refuse");
  assert.match(verdict.reason, /members\.csv/);
  assert.match(verdict.reason, /different file/);
});

test("the same file edited in place is refused too — size and name alone are not enough", () => {
  const verdict = resumeVerdict({
    picked: { ...picked, lastModified: picked.lastModified + 60_000 },
    block: block({ received_chunks: 3 }),
    session: session({
      files: { customers: { ...picked, totalChunks: 5, uploadedChunks: [0, 1, 2] } },
    }),
    slot: "customers",
    advertisedChunkSize: IMPORT_CHUNK_SIZE,
  });
  assert.equal(verdict.kind, "refuse");
});

test("the same file goes ahead", () => {
  const verdict = resumeVerdict({
    picked,
    block: block({ received_chunks: 3 }),
    session: session({
      files: { customers: { ...picked, totalChunks: 5, uploadedChunks: [0, 1, 2] } },
    }),
    slot: "customers",
    advertisedChunkSize: IMPORT_CHUNK_SIZE,
  });
  assert.equal(verdict.kind, "go");
});

test("a server that re-advertises a different chunk size invalidates the resume", () => {
  // Nothing about the file changed, so `sameFile` passes happily while every
  // stored index now points at the wrong bytes.
  const verdict = resumeVerdict({
    picked,
    block: block({ received_chunks: 3, chunk_size: 256 * 1024 }),
    session: session({
      chunkSize: IMPORT_CHUNK_SIZE,
      files: { customers: { ...picked, totalChunks: 5, uploadedChunks: [0, 1, 2] } },
    }),
    slot: "customers",
    advertisedChunkSize: IMPORT_CHUNK_SIZE,
  });
  assert.equal(verdict.kind, "refuse");
  assert.match(verdict.reason, /size of the pieces/);
});

test("with localStorage gone, the server's own record of the file is the guard", () => {
  // The session is the strongest check and it is the one that does not survive
  // a cleared browser. Name and size still do.
  const wrongFile = resumeVerdict({
    picked: { ...picked, name: "loans.csv" },
    block: block({
      received_chunks: 2,
      original_filename: "members.csv",
      size_bytes: 2_000,
    }),
    session: null,
    slot: "customers",
    advertisedChunkSize: IMPORT_CHUNK_SIZE,
  });
  assert.equal(wrongFile.kind, "refuse");

  const wrongSize = resumeVerdict({
    picked: { ...picked, size: 9_999 },
    block: block({
      received_chunks: 2,
      original_filename: "members.csv",
      size_bytes: 2_000,
    }),
    session: null,
    slot: "customers",
    advertisedChunkSize: IMPORT_CHUNK_SIZE,
  });
  assert.equal(wrongSize.kind, "refuse");

  const rightFile = resumeVerdict({
    picked,
    block: block({
      received_chunks: 2,
      original_filename: "members.csv",
      size_bytes: 2_000,
    }),
    session: null,
    slot: "customers",
    advertisedChunkSize: IMPORT_CHUNK_SIZE,
  });
  assert.equal(rightFile.kind, "go");
});

test("a run with nothing received yet has nothing to contradict", () => {
  // Only the per-chunk digest check on the server can catch a wrong pick here,
  // and it does: a 409 on the first chunk.
  const verdict = resumeVerdict({
    picked,
    block: block({ received_chunks: 0, original_filename: "something-else.csv" }),
    session: null,
    slot: "customers",
    advertisedChunkSize: IMPORT_CHUNK_SIZE,
  });
  assert.equal(verdict.kind, "go");
});

/* ── digests ────────────────────────────────────────────────────────── */

test("digests are lowercase hex, zero-padded, as hash_file() produces them", () => {
  assert.equal(toHex(new Uint8Array([0, 1, 15, 16, 255])), "00010f10ff");
  assert.equal(toHex(new Uint8Array()), "");
  assert.match(toHex(new Uint8Array(32).fill(171)), /^[0-9a-f]{64}$/);
});
