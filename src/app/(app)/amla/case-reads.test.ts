/**
 * The server logs every view of a case, a report and the deadlines, so each
 * screen reads once per user action (a Show, a page, an open): every read goes
 * through `once`. An STR's narrative shows on its own page only, never in a list.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DIR = join(process.cwd(), "src/app/(app)/amla/_components");
const sources = readdirSync(DIR)
  .filter((name) => name.endsWith(".tsx"))
  .map((name) => [name, readFileSync(join(DIR, name), "utf8")] as const);

test("each case and filing read is a one-shot read", () => {
  for (const read of ["cases", "case", "reports", "report", "deadlines"]) {
    const callers = sources.filter(([, source]) => source.includes(`amlaCaseApi.${read}(`));
    assert.ok(callers.length > 0, `${read} is read somewhere`);
    for (const [name, source] of callers) {
      const calls = source.match(new RegExp(`amlaCaseApi\\.${read}\\(`, "g"))?.length ?? 0;
      const guarded = source.match(new RegExp(`once\\(\\(\\) => amlaCaseApi\\.${read}\\(`, "g"))?.length ?? 0;
      assert.equal(guarded, calls, `${name}: every ${read} read goes through once()`);
    }
  }
});

test("the lists never touch an STR's narrative", () => {
  for (const name of ["cases-list.tsx", "filings-list.tsx", "submissions-register.tsx"]) {
    const path = join(DIR, name);
    assert.ok(existsSync(path), name);
    assert.doesNotMatch(readFileSync(path, "utf8"), /narrative/i, name);
  }
});

test("the narrative shows only on the filing's own page, behind its key", () => {
  const readers = sources.filter(([, source]) => /\.narrative\b/.test(source)).map(([name]) => name);
  assert.deepEqual(readers, ["filing-detail.tsx"]);
  const [, detail] = sources.find(([name]) => name === "filing-detail.tsx") ?? [];
  assert.match(detail ?? "", /actions\.narrative && report\.narrative/);
});

test("Audit & Compliance History reuses Settings → AMLA's log viewer instead of forking it", () => {
  const page = readFileSync(join(process.cwd(), "src/app/(app)/amla/history/page.tsx"), "utf8");
  assert.match(page, /AmlaLogTab/);
  assert.doesNotMatch(page, /amlaApi\.log\(/);
});
