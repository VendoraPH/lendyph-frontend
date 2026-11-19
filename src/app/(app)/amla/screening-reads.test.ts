/**
 * The server logs every screening and order read, so each screen reads once
 * per user action: every such read goes through `once`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DIRS = ["screening/_components", "orders/_components"].map((d) => join(process.cwd(), "src/app/(app)/amla", d));

test("each screening and order read is a one-shot read", () => {
  for (const dir of DIRS) assert.ok(existsSync(dir), dir);
  const sources = DIRS.flatMap((dir) =>
    readdirSync(dir)
      .filter((name) => name.endsWith(".tsx"))
      .map((name) => [name, readFileSync(join(dir, name), "utf8")] as const),
  );
  for (const read of ["lists", "matches", "match", "orders", "order"]) {
    const callers = sources.filter(([, source]) => source.includes(`amlaScreeningApi.${read}(`));
    assert.ok(callers.length > 0, `${read} is read somewhere`);
    for (const [name, source] of callers) {
      const calls = source.match(new RegExp(`amlaScreeningApi\\.${read}\\(`, "g"))?.length ?? 0;
      const guarded = source.match(new RegExp(`once\\(\\(\\) => amlaScreeningApi\\.${read}\\(`, "g"))?.length ?? 0;
      assert.equal(guarded, calls, `${name}: every ${read} read goes through once()`);
    }
  }
});

test("a match decision takes the server's 2,000-character reason", () => {
  const source = readFileSync(join(DIRS[0], "match-detail.tsx"), "utf8");
  assert.equal(source.match(/maxLength: 2000/g)?.length, 2);
});

test("a refused upload's row errors stay in the card, not a toast that vanishes", () => {
  const source = readFileSync(join(DIRS[0], "watchlists-tab.tsx"), "utf8");
  assert.match(source, /amlaUploadErrors\(err\)/);
  assert.doesNotMatch(source, /notifyError\(err, "The list couldn't be uploaded\."\)/);
});
