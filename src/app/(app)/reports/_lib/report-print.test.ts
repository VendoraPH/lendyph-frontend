import { test } from "node:test";
import assert from "node:assert/strict";
import { REPORT_PRINT_CLASS, REPORT_PRINT_CSS } from "./report-print";

// Finding 16: Print used to print one page of the app screen.
test("printing shows only the report sheet, and the screen never does", () => {
  assert.match(REPORT_PRINT_CSS, new RegExp(`^\\.${REPORT_PRINT_CLASS} \\{ display: none; \\}`, "m"));
  assert.match(REPORT_PRINT_CSS, new RegExp(`@media print \\{[\\s\\S]*body > :not\\(\\.${REPORT_PRINT_CLASS}\\) \\{ display: none !important; \\}`));
});

test("nothing clips the sheet to one page, and a total prints once", () => {
  assert.match(REPORT_PRINT_CSS, /html, body \{[^}]*height: auto !important;[^}]*overflow: visible !important;/);
  assert.match(REPORT_PRINT_CSS, /\.overflow-x-auto[^{]*\{ overflow: visible !important; \}/);
  assert.match(REPORT_PRINT_CSS, /thead \{ display: table-header-group; \}/);
  assert.match(REPORT_PRINT_CSS, /tfoot \{ display: table-row-group; \}/);
  assert.match(REPORT_PRINT_CSS, /@page \{ size: A4 landscape;/);
});
