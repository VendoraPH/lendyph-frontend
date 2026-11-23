/**
 * The server records every AMLA report read in the AMLA log, so a report reads
 * only when Show is pressed: never on load, and never when the header's
 * working branch changes. An export is a file fetched with the sign-in and
 * saved, never a link opened.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const DIR = join(process.cwd(), "src/app/(app)/amla/_components");
const view = readFileSync(join(DIR, "compliance-report-view.tsx"), "utf8");
const exporter = readFileSync(join(DIR, "compliance-report-exports.tsx"), "utf8");

test("a report reads only on Show: nothing is applied before it, and the header's branch never applies", () => {
  assert.doesNotMatch(view, /useBranchScopedFilters/);
  assert.match(view, /useState<AmlaComplianceReportFilters \| null>\(null\)/);
  assert.match(view, /setApplied\(/);
  assert.match(view, /setRun\(/);
});

test("the read is made once, by a child keyed on the run counter, behind the not-yet-shown prompt", () => {
  assert.equal(view.match(/amlaReportApi\.report\(/g)?.length, 1);
  assert.match(view, /useState\(\(\) => once\(\(\) => amlaReportApi\.report\(/);
  assert.match(view, /applied === null \? \(?\s*<ReportNotShownYet[^]*?: \(?\s*<ComplianceReportRead key=\{run\}/);
  assert.doesNotMatch(view, /useMemo\(/);
});

test("before the first Show the page says what to do, and that each report opened is logged", () => {
  assert.match(view, /Pick the dates and press Show\./);
  assert.match(view, /Press Show to see today(?:'|&apos;)s figures\./);
  assert.match(view, /Each report you open is recorded in the AMLA log\./);
});

test("the export buttons need amla:export and a report on screen", () => {
  assert.match(view, /applied !== null && can\("amla:export"\) && <ComplianceReportExports /);
  assert.equal(view.match(/<ComplianceReportExports /g)?.length, 1);
});

test("an export is a file fetched with the sign-in and saved, never a link opened", () => {
  assert.match(exporter, /amlaReportApi\s*\.download\(/);
  assert.match(exporter, /saveBlob\(/);
  for (const source of [view, exporter]) assert.doesNotMatch(source, /window\.open|target="_blank"|location\.href/);
});

test("the export toasts are short labels, with no final period", () => {
  assert.match(exporter, /"Draft export saved"/);
  assert.match(exporter, /"Export saved"/);
  assert.doesNotMatch(exporter, /saved\."/);
});
