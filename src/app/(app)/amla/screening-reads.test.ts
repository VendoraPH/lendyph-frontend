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
