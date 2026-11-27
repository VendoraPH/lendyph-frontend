import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

// D6: a submitted loan goes "for approval". `for_review` is a status value and
// keeps its underscore, so it doesn't match here.
for (const path of ["src/app/(app)/loans/new/page.tsx", "src/app/(app)/loans/restructure/page.tsx"]) {
  test(`${path} never says "for review"`, () => {
    assert.doesNotMatch(source(path), /for review/i);
  });
}

test("a restructure's messages say it went for approval", () => {
  const page = source("src/app/(app)/loans/restructure/page.tsx");
  assert.match(page, /"Forwarded for approval\."/);
  assert.match(page, /could not be forwarded for approval\. Submit it manually/);
});

test("a new loan's warning says it could not go for approval", () => {
  assert.match(source("src/app/(app)/loans/new/page.tsx"), /could not be forwarded for approval\. Open the loan/);
});
