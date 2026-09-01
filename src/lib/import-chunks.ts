/**
 * Cutting an import CSV into pieces small enough to survive the network it has
 * to cross.
 *
 * The admin migrating a co-operative's book uploads a membership CSV and a loan
 * CSV. Those files are TINY — the co-op this was built for has 44 members, so
 * both files together are a few tens of kilobytes. Chunking them is not about
 * size. It is about the link: this is the same co-op whose members were told
 * "no internet connection" while they were demonstrably online, on rural mobile
 * data that stalls for tens of seconds at a time. A single POST that dies at
 * 90% has to start again from zero; a chunked one only loses the chunk that was
 * in flight.
 *
 * So the unit of work here is a byte range, not a file. The plan is pure
 * arithmetic over `file.size` — deliberately no `Blob` handling, no fetch, no
 * state — which is what makes both halves of the resume story testable:
 * `planChunks` says what the whole upload is, `missingChunks` says what is left
 * after the server tells us what it already has.
 *
 * Slicing is the caller's one line: `file.slice(chunk.start, chunk.end)`.
 */

/**
 * How many bytes go in one request. 512 KiB.
 *
 * The chain a chunk crosses, in request order, with the ceiling each hop puts
 * on the WHOLE multipart body — not on the file part alone:
 *
 *   1. frontend nginx (binhs-coop.lendyph.com)     25 M
 *        The browser posts HERE, not to the API vhost: it goes to the frontend
 *        host, which proxies to Next, which rewrites to the API.
 *        Set explicitly on 2026-08-29, on all five frontend vhosts, to match
 *        the API vhosts. Before that it was UNSET, and an unset
 *        `client_max_body_size` is not "no limit" — it is nginx's built-in
 *        default of 1 MiB. That is worth keeping written down here because it
 *        appeared in no config file, and it had been silently 413-ing every
 *        scanned-PDF valid ID this co-operative tried to upload while Laravel
 *        was configured to accept PDFs up to 10 MB. A limit nobody set is
 *        harder to find than a limit set wrong.
 *   2. Next proxy `proxyClientMaxBodySize`        25 mb    next.config.ts
 *   3. API nginx `client_max_body_size`           25 M
 *   4. PHP-FPM, pool.d/lendyph.conf
 *        `post_max_size`                          25 M     whole request
 *        `upload_max_filesize`                    12 M     per uploaded PART
 *                                                          (12 MiB, PHP shorthand)
 *
 * And the limits on time rather than size:
 *        axios timeout                            60 s     NEXT_PUBLIC_API_TIMEOUT
 *                                                          default, src/config/env.ts
 *        Next `proxyTimeout`                      90 s     next.config.ts
 *
 * Hop 1 has been probed with real multipart bodies, before and after the fix,
 * because it is the hop that was wrong and reading configs is how it was missed:
 *
 *      unset (1 MiB default)        after `client_max_body_size 25M`
 *        512 KB -> 405                 900 KB -> 405
 *        900 KB -> 405                1100 KB -> 405
 *       1100 KB -> 413                   5 MB -> 405
 *       2048 KB -> 413                  12 MB -> 405
 *                                       26 MB -> 413  (correctly, at 25M)
 *
 * (405 means the request reached the app and was answered; 413 means nginx
 * refused it at the door.)
 *
 * WHAT BINDS, AND WHAT DOES NOT. No size cap binds at 512 KiB any more — the
 * nearest wall is now PHP's 12 MiB per-part limit, twenty-four times larger,
 * and the 60 s timeout would allow roughly 2 MiB. **512 KiB is a deliberate
 * choice, not a constraint**, and it should not be raised just because the
 * ceiling was:
 *
 *   - The requirement is surviving a bad link, not throughput. At ~256 kbit/s
 *     (32 KB/s), an ordinary bad afternoon in the province, 512 KiB is ~16 s
 *     against the 60 s timeout; 1 MiB is ~33 s. A chunk lost to a stall costs
 *     half as much to resend, and on a link that stalls, retry cost is the
 *     thing that decides whether the upload ever finishes.
 *   - The files are tiny. A 44-member co-op's membership CSV is a few hundred
 *     KB, so at 512 KiB it is usually ONE chunk and the question is moot. A
 *     larger default buys fewer round trips only on files that do not exist.
 *
 * The framing is measured, not estimated, because that is what made the
 * arithmetic honest the last time this number was wrong. Building the real
 * FormData in Chrome (`session_id` + `chunk_index` + the file part) and reading
 * the serialised request: 410 B of boundary and headers. Against the old unset
 * 1 MiB hop that was the whole story — a 1 MiB chunk was 1,048,986 B on the
 * wire, 410 B OVER the 1,048,576 limit, so every chunk would have 413'd
 * forever, and it would have looked exactly like the flaky connection this
 * feature exists to survive. Against a 25 M hop it is noise.
 *
 * Note which limits count that framing and which do not: `client_max_body_size`
 * and `post_max_size` bound the whole body and include it; `upload_max_filesize`
 * bounds the file part alone and does not.
 *
 * Unlike MAX_PER_PAGE in @/lib/paginate this is a default rather than the
 * contract: the upload-init response advertises the server's own `chunk_size`.
 * Pass it through `resolveChunkSize` and hand the result to `planChunks`.
 */
export const IMPORT_CHUNK_SIZE = 512 * 1024;

/**
 * The largest chunk we will honour from the server's advertised `chunk_size`.
 *
 * The rule this constant follows, through three revisions now: a clamp must
 * name the NEAREST wall on the path, because its whole job is refusing a size
 * that would 413 on every request, and a clamp that permits a guaranteed 413 is
 * worse than no clamp at all. It was 12 MiB; it went to 768 KiB while hop 1 was
 * an unset `client_max_body_size` inheriting nginx's 1 MiB default; it is 12
 * MiB again now that hop 1 is a deliberate 25 M and PHP's per-part limit is
 * once more the nearest wall.
 *
 * `upload_max_filesize = 12M` in pool.d/lendyph.conf, PHP shorthand, so 12 MiB
 * exactly. Sitting on the boundary is correct rather than tight: the limit
 * applies to the file part alone, so the 410 B of multipart framing is not
 * counted against it, and the whole body (12 MiB + framing) is bounded by
 * `post_max_size 25M` with room to spare. The clamp only bites above 12 MiB,
 * and a server advertising more than the PHP that must receive it will accept
 * is stating something it cannot honour.
 */
export const MAX_IMPORT_CHUNK_SIZE = 12 * 1024 * 1024;

/** One request's worth of file: `[start, end)`, as `Blob.slice` wants it. */
export interface ChunkRange {
  /** 0-based, and the index the server acknowledges in its landed set. */
  index: number;
  /** First byte, inclusive. */
  start: number;
  /** Last byte, EXCLUSIVE — pass straight to `file.slice(start, end)`. */
  end: number;
  /** `end - start`. The tail chunk is smaller than `chunkSize`. */
  size: number;
}

export interface ChunkPlan {
  /** The size actually used, after resolution — not necessarily what was asked. */
  chunkSize: number;
  /** The file's size in bytes, as the plan understood it. */
  totalBytes: number;
  /** `chunks.length`, kept alongside for the progress denominator. */
  totalChunks: number;
  chunks: ChunkRange[];
}

/**
 * The chunk size to plan with, given whatever the server advertised.
 *
 * `upload-init` returns `chunk_size` and it arrives as untyped JSON, so it can
 * be missing, null, a string, 0, or larger than PHP will accept. Anything that
 * is not a positive integer falls back to IMPORT_CHUNK_SIZE.
 *
 * Only the ceiling is clamped, and the asymmetry is deliberate: a server that
 * names a SMALLER chunk than ours is honoured, because a small chunk is merely
 * slow and it may well know something we do not, while a chunk above
 * MAX_IMPORT_CHUNK_SIZE cannot be accepted by the PHP that has to receive it.
 * Being slow is a cost; being impossible is a bug.
 */
export function resolveChunkSize(advertised: unknown): number {
  if (
    typeof advertised !== "number" ||
    !Number.isInteger(advertised) ||
    advertised <= 0
  ) {
    return IMPORT_CHUNK_SIZE;
  }
  return Math.min(advertised, MAX_IMPORT_CHUNK_SIZE);
}

/** Only the size is needed, so a `File` fits without dragging in a DOM. */
export interface SizedFile {
  size: number;
}

/**
 * The full upload, as byte ranges.
 *
 * A 0-byte file plans to ZERO chunks, not to one empty chunk. That is the
 * honest arithmetic (`ceil(0 / n) === 0`) and it is also the safe answer: PHP
 * reports an empty multipart part as `UPLOAD_ERR_NO_FILE`, so a synthesised
 * zero-length chunk would reach the API as "no file was uploaded" rather than
 * as "the file is empty", and the admin would be told the wrong thing. An empty
 * CSV is a pre-check failure, and the caller should never get this far with one
 * — but if it does, it gets an empty plan it can recognise rather than a
 * request that lies.
 */
export function planChunks(file: SizedFile, chunkSize?: number): ChunkPlan {
  const size = resolveChunkSize(chunkSize);
  // A NaN or negative size would otherwise produce a NaN chunk count and a
  // loop that never ends. Nothing to send is the only sane reading.
  const totalBytes =
    Number.isFinite(file.size) && file.size > 0 ? Math.floor(file.size) : 0;

  const chunks: ChunkRange[] = [];
  for (let start = 0; start < totalBytes; start += size) {
    const end = Math.min(start + size, totalBytes);
    chunks.push({ index: chunks.length, start, end, size: end - start });
  }

  return { chunkSize: size, totalBytes, totalChunks: chunks.length, chunks };
}

/**
 * What still has to be sent, given the chunks the server says it already holds.
 *
 * This is the whole resume: on reattach the client asks upload-status for the
 * landed set and sends only the gap, so a connection that dropped at chunk 3 of
 * 5 costs two requests rather than five. A plain set difference, in ascending
 * order, so the caller can send sequentially and report progress honestly.
 *
 * `landed` is taken as it comes off the wire: unordered, possibly duplicated,
 * and possibly a superset (indices past the end of this plan). Anything outside
 * `[0, totalChunks)` is ignored rather than trusted — a chunk index only means
 * something relative to the file and the chunk size it was cut with, so a
 * superset says that relationship has already broken and there is nothing here
 * worth reconciling.
 *
 * On a RESUME the landed set must come from `resumableChunks` in
 * @/lib/import-session, never straight out of the stored session: that is the
 * function that refuses a re-picked different file and a server that changed
 * its advertised `chunk_size`, either of which turns a stored index into a
 * pointer at the wrong bytes. Passing this a set it has not vetted is how a
 * corrupt CSV gets assembled from two different files.
 */
export function missingChunks(
  plan: ChunkPlan,
  landed: Iterable<number>,
): number[] {
  const have = new Set(landed);
  const missing: number[] = [];
  for (let index = 0; index < plan.totalChunks; index += 1) {
    if (!have.has(index)) missing.push(index);
  }
  return missing;
}
