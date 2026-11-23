import test from "node:test";
import assert from "node:assert/strict";

import { collapsibleToggleLabel } from "./collapsible-label";

test("a section toggle is named by what it does to which section", () => {
  assert.equal(collapsibleToggleLabel("Loan Portfolio", true), "Collapse Loan Portfolio");
  assert.equal(collapsibleToggleLabel("Trends", false), "Expand Trends");
});

test("a title that isn't text leaves the name to the trigger's own content", () => {
  assert.equal(collapsibleToggleLabel(null, true), undefined);
  assert.equal(collapsibleToggleLabel(42, true), undefined);
});
