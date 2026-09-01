import { test } from "node:test";
import assert from "node:assert/strict";
import {
  categoryExample,
  categoryWordingNote,
  errorReportFilename,
} from "./import-errors-table";
import { todayISO } from "@/lib/format";
import { MAX_PER_PAGE } from "@/lib/paginate";

test("a category's example line comes from the key the API actually sends", () => {
  // `ErrorReportBuilder` emits `label` — the most common wording seen in the
  // group. The declared type names `sample_messages`, which no response
  // carries, so both are read and the real one wins.
  assert.equal(
    categoryExample({ category: "missing_field", count: 3, label: "Member name is blank" }),
    "Member name is blank",
  );
  assert.equal(
    categoryExample({
      category: "missing_field",
      count: 3,
      sample_messages: ["Member name is blank"],
    }),
    "Member name is blank",
  );
});

test("a category with no wording at all renders without one rather than showing 'undefined'", () => {
  assert.equal(categoryExample({ category: "unknown", count: 1 }), null);
  assert.equal(categoryExample({ category: "unknown", count: 1, label: "" }), null);
  assert.equal(
    categoryExample({ category: "unknown", count: 1, sample_messages: [""] }),
    null,
  );
});

test("the wording note appears only when there is more than one wording to note", () => {
  assert.equal(categoryWordingNote({ category: "c", count: 5, distinct_messages: 1 }), null);
  assert.equal(categoryWordingNote({ category: "c", count: 5 }), null);
  assert.equal(
    categoryWordingNote({ category: "c", count: 5, distinct_messages: 3 }),
    "3 different wordings",
  );
});

test("a truncated set of wordings says so rather than under-reporting", () => {
  assert.equal(
    categoryWordingNote({
      category: "c",
      count: 90,
      distinct_messages: 20,
      distinct_messages_truncated: true,
    }),
    "20+ different wordings",
  );
});

test("the downloaded report is dated in Manila time, never off a UTC instant", () => {
  // `toISOString()` still reads as yesterday until 08:00 here, which would file
  // the morning shift's report under the wrong day.
  const name = errorReportFilename(12);
  assert.equal(name, `import-errors-run-12-${todayISO()}.csv`);
  assert.match(name, /^import-errors-run-12-\d{4}-\d{2}-\d{2}\.csv$/);
});

test("the largest page this screen asks for is the server's own ceiling", () => {
  // Asking for more is not an error and not a warning — it is fewer rows in a
  // response shaped exactly like a complete one.
  assert.equal(MAX_PER_PAGE, 100);
});
