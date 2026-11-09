import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { statementRangeError, statementRefusal } from "./statement-request";

function httpError(status: number, data: unknown) {
  return { response: { status, data } };
}

test("a From after To is refused in words before sending", () => {
  assert.equal(statementRangeError("2026-11-09", "2026-11-01"), "To must be on or after From.");
});

test("a range ending on or after its start is sent", () => {
  assert.equal(statementRangeError("2026-11-01", "2026-11-01"), null);
  assert.equal(statementRangeError("2026-01-01", "2026-11-09"), null);
});

test("a 422 reads as the server's own message", () => {
  const error = httpError(422, {
    message: "The to field must be a date after or equal to from.",
    errors: { to: ["The to field must be a date after or equal to from."] },
  });
  assert.equal(statementRefusal(error), "The to field must be a date after or equal to from.");
});

test("a 422 with no message still reads in words, never as a failure", () => {
  const message = statementRefusal(httpError(422, {}));
  assert.ok(message);
  assert.doesNotMatch(message, /something went wrong/i);
});

test("any other failure is not a refusal", () => {
  assert.equal(statementRefusal(httpError(500, { message: "Server Error" })), null);
  assert.equal(statementRefusal(httpError(403, { message: "Forbidden" })), null);
  assert.equal(statementRefusal(new Error("boom")), null);
});

const DIR = join(process.cwd(), "src/app/(app)/accounting/statements");
const read = (path: string) => readFileSync(join(DIR, path), "utf8");

test("the page refuses a From after To and doesn't mount the range statements", () => {
  const page = read("page.tsx");
  assert.match(page, /statementRangeError\(from, to\)/);
  assert.match(page, /rangeError \? \(/);
  assert.match(page, /role="alert"/);
});

test("every statement shows a 422 through the refusal panel, not the failure panel", () => {
  for (const report of [
    "balance-sheet-report.tsx",
    "income-statement-report.tsx",
    "cash-flow-report.tsx",
    "equity-changes-report.tsx",
  ]) {
    const source = read(`_components/${report}`);
    assert.match(source, /useStatementResource/, report);
    assert.match(source, /<StatementState/, report);
    assert.doesNotMatch(source, /<DataState/, report);
  }
});
