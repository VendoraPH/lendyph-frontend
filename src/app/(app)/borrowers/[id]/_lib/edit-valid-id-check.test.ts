import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { validateValidIds } from "@/lib/valid-id";

const page = readFileSync(
  join(process.cwd(), "src/app/(app)/borrowers/[id]/edit/page.tsx"),
  "utf8",
);

test("a new ID with no number is refused in the browser, with a clear message", () => {
  const { errors } = validateValidIds(
    [
      {
        type: "passport",
        custom_type_name: "",
        id_number: " ",
        front_file: { name: "f.png" } as File,
        back_file: null,
      },
    ],
    { requireAtLeastOne: false },
  );
  assert.deepEqual(errors.map((e) => e.message), ["Enter the ID number for ID 1."]);
});

test("the edit page checks its IDs before saving anything", () => {
  const check = page.indexOf("validateValidIds(validIds, { requireAtLeastOne: false })");
  assert.ok(check > -1, "the page runs the shared check");
  assert.ok(check < page.indexOf("borrowerService.update(borrowerId"), "before the first write");
});

test("no ID is dropped without a word, and a failed upload never prints the raw type", () => {
  assert.match(page, /validIds\.filter\(\(v\) => !isBlankValidId\(v\)\)/);
  assert.doesNotMatch(page, /upload the \$\{entry\.type\} ID/);
});
