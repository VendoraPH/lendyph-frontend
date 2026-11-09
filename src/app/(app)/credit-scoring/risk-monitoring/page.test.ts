/** Risk monitoring, read from source: a null count reads a dash. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const page = readFileSync(join(process.cwd(), "src/app/(app)/credit-scoring/risk-monitoring/page.tsx"), "utf8");

test("the new hard flags count reads a dash when the server sends null", () => {
  assert.match(page, /value=\{countOrDash\(data\.summary\.new_hard_flags_30d\)\}/);
  assert.doesNotMatch(page, /String\(data\.summary\./);
});
