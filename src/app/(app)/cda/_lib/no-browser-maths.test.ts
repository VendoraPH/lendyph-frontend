import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// Every CDA figure is the server's (CDA design §0, §4, §10; product decision
// "the browser never calculates"): money, deadlines (`effective_deadline`,
// `days_remaining`), readiness and its breakdown, issues, PESOS scores and
// file links. The browser never adds, nets, rounds or derives one, never does
// date arithmetic, never exports a report itself and never builds a file
// link. This scans every CDA source, so a screen that lands later is checked
// too (modelled on the savings guard).
const SRC = join(process.cwd(), "src");
const ROOTS = ["app/(app)/cda", "services/cda.service.ts", "types/cda.ts"];

/** A name that holds money or a server figure on the CDA screens (an id doesn't). */
const FIGURE = String.raw`\w*(?:amount|balance|principal|interest|allowance|gap|expense|budget|cdf|total|asset|money|readiness|percent|score|weight|days_remaining|days|deadline|due)\w*(?<!Id|_id)`;

const FORBIDDEN: ReadonlyArray<{ name: string; pattern: RegExp }> = [
  { name: "reduce", pattern: /\.reduce\s*\(/ },
  { name: "a running total", pattern: /[+\-*/]=/ },
  { name: "rounding or clamping", pattern: /\.toFixed\s*\(|\bMath\.\w+/ },
  {
    name: "parsing a figure",
    pattern: new RegExp(String.raw`\b(?:parseFloat|parseInt|Number|toNumber)\s*\(\s*[\w.?]*?${FIGURE}\s*\)`, "i"),
  },
  { name: "arithmetic on a figure", pattern: new RegExp(String.raw`\b${FIGURE}\s+[-+*/]\s+[\w(]`, "i") },
  { name: "arithmetic with a figure", pattern: new RegExp(String.raw`[\w)]\s+[-+*/]\s+[\w.?]*\.${FIGURE}\b`, "i") },
  { name: "a mean or ratio over a list", pattern: /\/\s*[\w.?]+\.length\b/ },
  {
    name: "date arithmetic",
    pattern: /\bnew Date\s*\(|\.getTime\s*\(|\bDate\.(?:parse|now|UTC)\b|\b86_?400_?000\b|\.set(?:UTC)?(?:Date|Month|FullYear)\s*\(|\b(?:daysUntil|daysBetween|addDays|daysFromToday|differenceIn\w*)\b/,
  },
  { name: "a browser deadline or readiness helper", pattern: /\b(?:effectiveDeadline|deadlineState|defaultReportingYear|overallReadiness|clampPercent|countBySeverity)\b/ },
  { name: "a browser exporter", pattern: /\b(?:jspdf|exceljs|exportReportTo\w+|report-pdf|report-excel|report-docx|applyChrome)\b/ },
  { name: "a built file link", pattern: /\b(?:file_url|certificate_url|proof_url)\b|\/api\/files|\/storage\// },
  { name: "a raw key as a label", pattern: /_LABELS\[[^\]]+\]\s*\?\?/ },
  { name: "a dollar sign", pattern: /\$\s?\d|[("'`>]\$(?=[)"'`<\s\d])|\bUSD\b/ },
];

/** Lines allowed to match, each for a stated reason. */
const ALLOWED: ReadonlyArray<{ file: string; line: string; reason: string }> = [];

/** The comment-free code of a line; comments may describe what the server works out. */
function codeOf(line: string): string {
  const trimmed = line.trim();
  if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return "";
  return line.replace(/\s\/\/\s.*$/, "");
}

function findings(file: string, source: string): string[] {
  const found: string[] = [];
  source.split("\n").forEach((line, index) => {
    if (ALLOWED.some((a) => a.file === file && line.trim() === a.line)) return;
    const code = codeOf(line);
    for (const { name, pattern } of FORBIDDEN) {
      if (pattern.test(code)) found.push(`line ${index + 1}: ${name}`);
    }
  });
  return found;
}

function sources(path: string): string[] {
  if (!existsSync(path)) return [];
  if (!statSync(path).isDirectory()) return [path];
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const child = join(path, entry.name);
    if (entry.isDirectory()) return sources(child);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [child] : [];
  });
}

const FILES = ROOTS.flatMap((root) => sources(join(SRC, root)));

test("the CDA sources exist to be checked", () => {
  assert.ok(FILES.length >= 40, `checked ${FILES.length} files`);
  for (const root of ROOTS) assert.ok(existsSync(join(SRC, root)), root);
});

for (const path of FILES) {
  const file = relative(SRC, path);
  test(`${file} works out no money, deadline or readiness and builds no file link`, () => {
    assert.deepEqual(findings(file, readFileSync(path, "utf8")), []);
  });
}

test("#510's browser deadline, readiness and export helpers are not carried over", () => {
  for (const gone of ["deadline.ts", "readiness.ts", "report-document.ts"]) {
    assert.equal(existsSync(join(SRC, "app/(app)/cda/_lib", gone)), false, gone);
  }
});

test("every allowed line still exists, so the list can't go stale", () => {
  for (const allowed of ALLOWED) {
    const text = readFileSync(join(SRC, allowed.file), "utf8");
    assert.ok(text.split("\n").some((l) => l.trim() === allowed.line), `${allowed.file}: ${allowed.line}`);
  }
});

// ── The scan itself: each pattern fires on the line it exists to catch ──

const SEEDED: ReadonlyArray<[string, string]> = [
  ["reduce", "const critical = reports.reduce((n, r) => n + r.critical, 0);"],
  ["a running total", "total += row.amount;"],
  ["rounding or clamping", "const pct = Math.round(sum / reports.length);"],
  ["rounding or clamping", "const shown = amount.toFixed(2);"],
  ["parsing a figure", "const gap = Number(data.provision_gap);"],
  ["parsing a figure", "const n = parseFloat(program.actual_expense);"],
  ["arithmetic on a figure", "const gap = required_allowance - existing;"],
  ["arithmetic with a figure", "const left = 100 - report.readiness;"],
  ["a mean or ratio over a list", "const mean = sum / applicable.length;"],
  ["date arithmetic", "const days = Math.ceil((new Date(due).getTime() - Date.now()) / 86_400_000);"],
  ["date arithmetic", "due.setDate(due.getDate() + 120);"],
  ["a browser deadline or readiness helper", "const due = effectiveDeadline(period);"],
  ["a browser deadline or readiness helper", "const score = overallReadiness(reports);"],
  ["a browser exporter", 'const { exportReportToPdf } = await import("@/app/(app)/reports/_lib/report-pdf");'],
  ["a built file link", "<a href={r.certificate_url}>"],
  ["a built file link", "const url = `/api/files/documents/${id}`;"],
  ["a raw key as a label", "{STATUS_LABELS[r.status] ?? r.status}"],
  ["a dollar sign", "<span>$1,500.00</span>"],
];

for (const [name, line] of SEEDED) {
  test(`the scan catches ${name}: ${line}`, () => {
    assert.ok(findings("seeded.ts", line).some((f) => f.endsWith(name)), line);
  });
}

const CLEAN: readonly string[] = [
  "<TableCell>{cdaMoney(r.outstanding_principal)}</TableCell>",
  "<DeadlineBadge daysRemaining={report.days_remaining} />",
  "<ReadinessMeter value={report.readiness} critical={report.critical_count} />",
  "const url = signedUrl(item.url);",
  "onChange={(e) => setPreferred(Number(e.target.value))}",
  "{labelOf(SUBMISSION_METHOD_LABELS, row.method)}",
];

for (const line of CLEAN) {
  test(`the scan lets a clean line through: ${line}`, () => {
    assert.deepEqual(findings("seeded.ts", line), []);
  });
}
