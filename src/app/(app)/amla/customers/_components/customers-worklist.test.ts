import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./customers-worklist.tsx", import.meta.url), "utf8");

test("the worklist's branch filter follows the working branch through MB-FE2's shared hooks, as the other lists do", () => {
  assert.match(source, /useBranchFilter\(\)/);
  assert.match(source, /useBranchScopedFilters</);
  assert.doesNotMatch(source, /branch: ALL_BRANCHES/);
});

test("the applied filters, not a copy, key the read, so a header switch reads page 1 of the new branch once", () => {
  assert.match(source, /useMemo\(\(\) => once\(\(\) => amlaCddApi\.worklist\(toApi\(applied\)\)\), \[applied\]\)/);
});
