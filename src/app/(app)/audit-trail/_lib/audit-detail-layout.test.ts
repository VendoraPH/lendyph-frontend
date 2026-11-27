import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { AUDIT_DETAIL_CELL, AUDIT_DETAIL_ACTION_BADGE } from "./audit-detail-layout";

// The Audit Detail drawer's Action badge sits in a two-column grid beside the
// Module. A long label ("Remembered sign-ins shortened") kept the Badge's
// one-line, fit-content shape and ran over the Module (finish run round 7,
// BC15). The cell may shrink and the badge wraps inside it, at any width.

const PAGE = resolve(process.cwd(), "src", "app", "(app)", "audit-trail", "page.tsx");

test("a detail cell can shrink below its content, so its column holds", () => {
  assert.match(AUDIT_DETAIL_CELL, /\bmin-w-0\b/);
});

test("the action badge wraps within its column instead of overflowing", () => {
  for (const cls of ["h-auto", "max-w-full", "whitespace-normal", "break-words", "text-left"]) {
    assert.match(AUDIT_DETAIL_ACTION_BADGE, new RegExp(`(^|\\s)${cls}(\\s|$)`), cls);
  }
});

test("the drawer uses both", () => {
  const page = readFileSync(join(PAGE), "utf8");
  assert.match(page, /AUDIT_DETAIL_ACTION_BADGE/);
  assert.match(page, /AUDIT_DETAIL_CELL/);
});
