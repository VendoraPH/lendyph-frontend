import { test } from "node:test";
import assert from "node:assert/strict";
import {
  IMPORT_CHUNK_SIZE,
  MAX_IMPORT_CHUNK_SIZE,
  missingChunks,
  planChunks,
  resolveChunkSize,
  type ChunkPlan,
} from "./import-chunks";

const KIB = 1024;
const CHUNK = IMPORT_CHUNK_SIZE;

// The whole-body limit at hop 1, the frontend vhost the browser actually posts
// to: `client_max_body_size 25M`, set explicitly on 2026-08-29. Probed after
// the fix — 12 MB accepted, 26 MB refused.
const FIRST_HOP_BODY_LIMIT = 25 * 1024 * KIB;
const PROBED_LARGEST_ACCEPTED = 12 * 1024 * KIB;

// What hop 1 was before that: unset, therefore nginx's built-in default. The
// wall this module was briefly sized against, kept because the arithmetic
// against it is the reason the constant is measured rather than estimated.
const OLD_FIRST_HOP_DEFAULT = 1024 * KIB;

// PHP's `upload_max_filesize`, which bounds the file PART rather than the whole
// body — the nearest wall on the path now, and what the ceiling tracks.
const PHP_PER_PART_LIMIT = 12 * 1024 * KIB;

// Multipart framing — boundary, part headers, session_id and chunk_index —
// measured in Chrome at 410 B by serialising the real FormData. Allowed 4x that
// here so this stays a guard rather than a restatement of one measurement.
// It counts against the whole-body limits and NOT against the per-part one.
const FRAMING_ALLOWANCE = 4 * 410;

// The uplink the timeout side of the derivation assumes: ~256 kbit/s = 32 KB/s.
const SLOW_UPLINK_BYTES_PER_SEC = 32 * KIB;
const AXIOS_TIMEOUT_SEC = 60;

/** Every byte covered exactly once, in order, with no gap and no overlap. */
function assertTiles(plan: ChunkPlan): void {
  let cursor = 0;
  plan.chunks.forEach((chunk, i) => {
    assert.equal(chunk.index, i, "indices are dense and 0-based");
    assert.equal(chunk.start, cursor, `chunk ${i} starts where ${i - 1} ended`);
    assert.equal(chunk.size, chunk.end - chunk.start, "size matches the range");
    assert.ok(chunk.size > 0, "no zero-length chunk is ever emitted");
    assert.ok(chunk.size <= plan.chunkSize, "no chunk exceeds the chunk size");
    cursor = chunk.end;
  });
  assert.equal(cursor, plan.totalBytes, "the last chunk ends at the last byte");
  assert.equal(plan.totalChunks, plan.chunks.length);
}

// --- the constant -------------------------------------------------------------

test("the chunk size is 512 KiB", () => {
  assert.equal(IMPORT_CHUNK_SIZE, 512 * KIB);
});

// No size cap binds at 512 KiB any more — hop 1 went from an unset 1 MiB
// default to a deliberate 25M — so this is a sanity floor, not the reason for
// the number. It still pins the arithmetic that was wrong before: against the
// OLD 1 MiB hop, a 1 MiB chunk was 410 B over and would have 413'd forever.
test("a chunk plus multipart framing clears every whole-body limit on the path", () => {
  assert.ok(
    IMPORT_CHUNK_SIZE + FRAMING_ALLOWANCE <= FIRST_HOP_BODY_LIMIT,
    `${IMPORT_CHUNK_SIZE} B + framing exceeds the ${FIRST_HOP_BODY_LIMIT} B first hop`
  );
  assert.ok(IMPORT_CHUNK_SIZE < PROBED_LARGEST_ACCEPTED, "measured as accepted");
  // The old hop was 1 MiB and a 1 MiB chunk missed it by 410 B — over the wall,
  // not near it. Kept as arithmetic because it is why this number was wrong.
  assert.ok(OLD_FIRST_HOP_DEFAULT + 410 > OLD_FIRST_HOP_DEFAULT);
  assert.ok(IMPORT_CHUNK_SIZE + 410 < OLD_FIRST_HOP_DEFAULT, "and 512 KiB cleared even that");
});

// This IS the reason for 512 KiB now, together with retry cost: the link, not
// any cap. Raising the default because the ceiling went up would trade the
// requirement — surviving a bad link — for throughput on files that do not exist.
test("a chunk transfers well inside the axios timeout on a bad rural uplink", () => {
  const seconds = IMPORT_CHUNK_SIZE / SLOW_UPLINK_BYTES_PER_SEC;
  assert.ok(seconds <= 16, `${seconds}s at 32 KB/s`);
  assert.ok(seconds < AXIOS_TIMEOUT_SEC * 0.3);
  // And the default stays well below what the caps alone would now permit.
  assert.ok(IMPORT_CHUNK_SIZE < MAX_IMPORT_CHUNK_SIZE / 4, "deliberately not maxed out");
});

// The clamp must name the NEAREST wall. That rule has held through three
// revisions and only the wall has moved: 12 MiB, then 768 KiB while hop 1 was
// an unset 1 MiB default, then 12 MiB again now hop 1 is a deliberate 25M.
test("the ceiling is PHP's per-part cap, the nearest wall on the path", () => {
  assert.equal(MAX_IMPORT_CHUNK_SIZE, 12 * 1024 * KIB);
  assert.equal(MAX_IMPORT_CHUNK_SIZE, PHP_PER_PART_LIMIT);
  // The per-part limit does not count framing; the whole-body ones do, and even
  // the ceiling plus framing clears those.
  assert.ok(MAX_IMPORT_CHUNK_SIZE + FRAMING_ALLOWANCE < FIRST_HOP_BODY_LIMIT);
  assert.ok(MAX_IMPORT_CHUNK_SIZE <= PROBED_LARGEST_ACCEPTED, "measured as accepted");
  // Still leaves the server room to name something above our default.
  assert.ok(MAX_IMPORT_CHUNK_SIZE > IMPORT_CHUNK_SIZE);
});

// --- the server's advertised size ---------------------------------------------

test("the server's own chunk_size wins over our default", () => {
  assert.equal(resolveChunkSize(256 * KIB), 256 * KIB);
  assert.equal(planChunks({ size: 1024 * KIB }, 256 * KIB).totalChunks, 4);
  // Including sizes above our default, which the raised hop 1 now permits.
  assert.equal(resolveChunkSize(640 * KIB), 640 * KIB);
  assert.equal(resolveChunkSize(4 * 1024 * KIB), 4 * 1024 * KIB);
});

test("an advertised size above PHP's per-part cap is clamped, not obeyed", () => {
  assert.equal(resolveChunkSize(20 * 1024 * KIB), MAX_IMPORT_CHUNK_SIZE);
  assert.equal(resolveChunkSize(Number.MAX_SAFE_INTEGER), MAX_IMPORT_CHUNK_SIZE);
  // Exactly at the cap is honoured: PHP rejects above it, not at it.
  assert.equal(resolveChunkSize(PHP_PER_PART_LIMIT), PHP_PER_PART_LIMIT);
  assert.ok(resolveChunkSize(Number.MAX_SAFE_INTEGER) < FIRST_HOP_BODY_LIMIT);
});

test("junk off the wire falls back to the default instead of breaking the plan", () => {
  for (const advertised of [
    undefined,
    null,
    0,
    -1,
    1.5,
    NaN,
    Infinity,
    "524288",
    {},
    [],
  ]) {
    assert.equal(resolveChunkSize(advertised), IMPORT_CHUNK_SIZE, String(advertised));
  }
  // And the same gate applies through planChunks, so there is one place to trust.
  assert.equal(planChunks({ size: 10 }, 0).chunkSize, IMPORT_CHUNK_SIZE);
  assert.equal(planChunks({ size: 10 }).chunkSize, IMPORT_CHUNK_SIZE);
});

// --- plans --------------------------------------------------------------------

test("an exact multiple divides evenly, with no empty tail chunk", () => {
  const plan = planChunks({ size: 3 * CHUNK });
  assert.equal(plan.totalChunks, 3);
  assert.deepEqual(
    plan.chunks.map((c) => c.size),
    [CHUNK, CHUNK, CHUNK]
  );
  assert.deepEqual(plan.chunks[2], {
    index: 2,
    start: 2 * CHUNK,
    end: 3 * CHUNK,
    size: CHUNK,
  });
  assertTiles(plan);
});

test("a remainder becomes a short final chunk", () => {
  const plan = planChunks({ size: 2 * CHUNK + 500 });
  assert.equal(plan.totalChunks, 3);
  assert.deepEqual(
    plan.chunks.map((c) => c.size),
    [CHUNK, CHUNK, 500]
  );
  assert.equal(plan.chunks[2].end, plan.totalBytes);
  assertTiles(plan);
});

// The real case: 44 members is roughly 6 KB of CSV. Chunking is for the flaky
// link, not the file size, so the ordinary import is a single chunk.
test("a file smaller than one chunk is a single chunk covering all of it", () => {
  const plan = planChunks({ size: 6 * KIB });
  assert.equal(plan.totalChunks, 1);
  assert.deepEqual(plan.chunks[0], { index: 0, start: 0, end: 6144, size: 6144 });
  assertTiles(plan);
});

test("a file exactly one chunk long is one chunk, not two", () => {
  const plan = planChunks({ size: CHUNK });
  assert.equal(plan.totalChunks, 1);
  assert.equal(plan.chunks[0].size, CHUNK);
  assertTiles(plan);
});

// PHP reports an empty multipart part as UPLOAD_ERR_NO_FILE, so a synthesised
// zero-length chunk would reach the API as "no file was uploaded" and the admin
// would be told the wrong thing. Zero bytes plans to zero chunks.
test("a 0-byte file plans to nothing at all, not to one empty chunk", () => {
  const plan = planChunks({ size: 0 });
  assert.equal(plan.totalChunks, 0);
  assert.deepEqual(plan.chunks, []);
  assert.equal(plan.totalBytes, 0);
  assert.deepEqual(missingChunks(plan, []), []);
});

test("a nonsense file size yields an empty plan rather than an endless loop", () => {
  for (const size of [-1, NaN, Infinity]) {
    const plan = planChunks({ size });
    assert.equal(plan.totalChunks, 0, String(size));
    assert.equal(plan.totalBytes, 0);
  }
});

test("plans tile the file for a spread of awkward sizes", () => {
  for (const size of [1, 2, 1023, CHUNK - 1, CHUNK + 1, 5 * CHUNK - 7, 7_654_321]) {
    const plan = planChunks({ size });
    assert.equal(plan.totalChunks, Math.ceil(size / CHUNK), `chunk count for ${size}`);
    assertTiles(plan);
  }
});

test("no chunk in any plan could ever exceed a limit on the path", () => {
  for (const advertised of [undefined, 1024, 256 * KIB, 12 * 1024 * KIB, 1e9]) {
    const plan = planChunks({ size: 40 * 1024 * KIB }, advertised);
    for (const chunk of plan.chunks) {
      assert.ok(chunk.size <= PHP_PER_PART_LIMIT, `${chunk.size} B part would 413`);
      assert.ok(
        chunk.size + FRAMING_ALLOWANCE < FIRST_HOP_BODY_LIMIT,
        `${chunk.size} B body would 413`
      );
    }
  }
});

// --- what is left to send -----------------------------------------------------

const FIVE = planChunks({ size: 5 * CHUNK });

test("nothing landed means send everything", () => {
  assert.equal(FIVE.totalChunks, 5);
  assert.deepEqual(missingChunks(FIVE, []), [0, 1, 2, 3, 4]);
});

test("a partial upload sends only the gap", () => {
  assert.deepEqual(missingChunks(FIVE, [0, 1, 2]), [3, 4]);
  assert.deepEqual(missingChunks(FIVE, [0, 2, 4]), [1, 3]);
});

test("the landed set is unordered off the wire and the gap still comes back sorted", () => {
  assert.deepEqual(missingChunks(FIVE, [4, 0, 2]), [1, 3]);
  assert.deepEqual(missingChunks(FIVE, [3, 1]), [0, 2, 4]);
});

test("duplicates in the landed set do not resend anything", () => {
  assert.deepEqual(missingChunks(FIVE, [1, 1, 1, 0]), [2, 3, 4]);
});

test("a complete landed set means the upload is done", () => {
  assert.deepEqual(missingChunks(FIVE, [0, 1, 2, 3, 4]), []);
});

// A superset means the landed set was cut from a different file or a different
// chunk size. Reconciling it here would paper over exactly what resumableChunks
// exists to refuse, so the extra indices are simply ignored.
test("indices past the end of the plan are ignored, not reconciled", () => {
  assert.deepEqual(missingChunks(FIVE, [0, 1, 2, 3, 4, 5, 6, 99]), []);
  assert.deepEqual(missingChunks(FIVE, [7, 8]), [0, 1, 2, 3, 4]);
  assert.deepEqual(missingChunks(FIVE, [-1, 0, 1.5]), [1, 2, 3, 4]);
});

test("a Set is accepted as-is, since that is how a landed set is usually held", () => {
  assert.deepEqual(missingChunks(FIVE, new Set([0, 1])), [2, 3, 4]);
});

test("the resume loop terminates: sending the gap leaves no gap", () => {
  const landed = [0, 3];
  const remaining = missingChunks(FIVE, landed);
  assert.deepEqual(remaining, [1, 2, 4]);
  assert.deepEqual(missingChunks(FIVE, [...landed, ...remaining]), []);
});
