import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

/**
 * A drain stops at 2,000 records, and nobody can pick a person who isn't on the
 * list. These screens hold no logic of their own to test, so the guard is that
 * the drain stays gone.
 */
describe("member and loan pickers search the server", () => {
  for (const path of [
    "src/components/common/subject-picker.tsx",
    "src/app/(app)/collaterals/_components/collateral-form.tsx",
    "src/app/(app)/credit-scoring/assessment/page.tsx",
    "src/app/(app)/gcash/_lib/load-party-lists.ts",
  ]) {
    test(`${path} doesn't drain members`, () => {
      assert.doesNotMatch(read(path), /borrowerService\s*\.listAll/);
    });
  }

  test("the shared picker doesn't drain loans", () => {
    assert.doesNotMatch(
      read("src/components/common/subject-picker.tsx"),
      /loanService\s*\.listAll/,
    );
  });
});
