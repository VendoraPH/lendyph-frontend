import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * An entry Data Import's share capital file brought over from the earlier
 * books is marked on the Subsidiary Ledger (finish run round 2, decision 13),
 * from the server's `is_imported`, never guessed from its description.
 */
test("the Subsidiary Ledger marks an imported entry, off the server's flag", () => {
  const page = readFileSync(join(process.cwd(), "src/app/(app)/share-capital/ledger/page.tsx"), "utf8");

  assert.match(page, /imported: raw\.is_imported === true/);
  assert.match(page, /\{entry\.imported \? \(\s*<Badge variant="outline"[^>]*>\s*Imported\s*<\/Badge>/);
  assert.doesNotMatch(page, /description\.includes\("imported"\)/i);
});
