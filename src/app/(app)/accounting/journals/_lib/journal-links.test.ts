import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { journalHref } from "./journal-register";

const read = (path: string) =>
  readFileSync(join(process.cwd(), "src/app/(app)/accounting", path), "utf8");

test("journalHref opens the journal's own page", () => {
  assert.equal(journalHref(42), "/accounting/journals/42");
});

// The dashboard's recent journals and the general ledger's rows link each
// journal number to its journal page.
const LINKED: ReadonlyArray<{ file: string; id: string; number: string }> = [
  { file: "page.tsx", id: "journal.id", number: "journal.journal_no" },
  { file: "general-ledger/page.tsx", id: "row.journal_id", number: "row.journal_no" },
];

for (const { file, id, number } of LINKED) {
  test(`${file} links the journal number to its journal page`, () => {
    const source = read(file);
    const link = new RegExp(
      String.raw`<Link\s[^>]*href=\{journalHref\(${id.replace(".", "\\.")}\)\}[^>]*>\s*\{${number.replace(".", "\\.")}\}\s*</Link>`,
    );
    assert.match(source, link);
    assert.match(source, /import \{[^}]*\bjournalHref\b[^}]*\} from "[^"]*journals\/_lib\/journal-register"/);
  });
}
