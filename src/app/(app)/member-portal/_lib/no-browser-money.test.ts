import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// The staff portal screens show the server's money as sent (portal design §0,
// "the browser never calculates balances"): no adding, netting, rounding or
// parsing of a money figure, and every key the server sends reads through an
// explicit word map, never as the key itself. Modelled on the savings guard;
// it scans every staff portal source, so a screen that lands later is checked
// too. The member side has its own guard (src/lib/portal/).
const SRC = join(process.cwd(), "src");
const ROOTS = [
  "app/(app)/member-portal",
  "app/(app)/settings/member-portal",
  "app/(app)/borrowers/[id]/_components/portal-access-card.tsx",
  "app/(app)/borrowers/[id]/_components/portal-code-dialog.tsx",
  "app/(app)/borrowers/[id]/_components/portal-communications.tsx",
  "app/(app)/borrowers/[id]/_components/portal-share-control.tsx",
  "app/(app)/borrowers/[id]/_components/disable-portal-dialog.tsx",
  "services/portal-admin.service.ts",
];

/** A name that holds money on these screens (an id, such as `account_id`, doesn't). */
const MONEY = String.raw`\w*(?:amount|balance|principal|interest|payout|deposit|withdrawal|debit|credit|total|hold|withdrawable|available)\w*(?<!Id|_id)`;

const FORBIDDEN: ReadonlyArray<{ name: string; pattern: RegExp }> = [
  { name: "reduce", pattern: /\.reduce\s*\(/ },
  { name: "a running total", pattern: /[+\-*/]=/ },
  { name: "rounding", pattern: /\.toFixed\s*\(|\bMath\.(?:round|floor|ceil|max|min|trunc)\b/ },
  {
    name: "parsing a money figure",
    pattern: new RegExp(String.raw`\b(?:parseFloat|parseInt|Number|toNumber)\s*\(\s*[\w.?]*?${MONEY}\s*\)`, "i"),
  },
  { name: "arithmetic on a money figure", pattern: new RegExp(String.raw`\b${MONEY}\s+[-+*/]\s+[\w(]`, "i") },
  { name: "arithmetic with a money figure", pattern: new RegExp(String.raw`[\w)]\s+[-+*/]\s+[\w.?]*\.${MONEY}\b`, "i") },
  { name: "a raw key as a label", pattern: /_LABELS\[[^\]]+\]\s*\?\?|\bhumanize\w*\(|\.replace\(\s*\/_\/g/ },
  { name: "a dollar sign", pattern: /\$\s?\d|[("'`>]\$(?=[)"'`<\s\d])|\bUSD\b/ },
  { name: "the withdrawable fallback", pattern: /available_balance\s*-|maintaining_balance\s*[-+]/ },
  {
    // A server key rendered as it is ({r.status}): words come from a map.
    // An attribute (key={r.status}) or a template part (${r.status}) isn't shown.
    name: "a bare key in JSX",
    pattern: /(?<![=$\w])\{\s*[\w?.]+\.(?:status|type|state|kind|audience|\w*reason)\s*\}/,
  },
];

/** The comment-free code of a line; comments may describe what the server adds up. */
function codeOf(line: string): string {
  const trimmed = line.trim();
  if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return "";
  return line.replace(/\s\/\/\s.*$/, "");
}

function findings(source: string): string[] {
  const found: string[] = [];
  source.split("\n").forEach((line, index) => {
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

test("the staff portal sources exist to be checked", () => {
  for (const root of ROOTS) assert.ok(existsSync(join(SRC, root)), root);
  assert.ok(FILES.length >= 25, `checked ${FILES.length} files`);
});

for (const path of FILES) {
  const file = relative(SRC, path);
  test(`${file} works out no money and shows no raw key`, () => {
    assert.deepEqual(findings(readFileSync(path, "utf8")), []);
  });
}

test("no staff portal screen shows a raw API path", () => {
  for (const path of FILES.filter((p) => p.endsWith(".tsx"))) {
    const text = readFileSync(path, "utf8");
    assert.doesNotMatch(text, /["'`>]\s*\/?(?:api\/)?portal-admin\//, relative(SRC, path));
  }
});

// ── The scan itself: each pattern fires on the line it exists to catch ──

const SEEDED: ReadonlyArray<[string, string]> = [
  ["reduce", "const total = rows.reduce((t, r) => t + r.amount, 0);"],
  ["a running total", "total += row.amount;"],
  ["rounding", "const shown = amount.toFixed(2);"],
  ["parsing a money figure", "const n = parseFloat(request.amount);"],
  ["parsing a money figure", "const n = Number(hold.amount);"],
  ["arithmetic on a money figure", "const left = amount - hold;"],
  ["arithmetic with a money figure", "const left = 100 - request.amount;"],
  ["a raw key as a label", "{REQUEST_STATUS_LABELS[r.status] ?? r.status}"],
  ["a raw key as a label", "{humanize(r.type)}"],
  ["a raw key as a label", "r.status.replace(/_/g, \" \")"],
  ["a dollar sign", "<span>$1,500.00</span>"],
  ["the withdrawable fallback", "const w = available_balance - maintaining_balance;"],
  ["a bare key in JSX", "<TableCell>{r.status}</TableCell>"],
  ["a bare key in JSX", "<span>{card.disabled_reason}</span>"],
  ["a bare key in JSX", "{a.audience}"],
  ["a bare key in JSX", "<Badge>{ request.type }</Badge>"],
  ["a bare key in JSX", "<p>{row.kind}</p>"],
  ["a bare key in JSX", "<dd>{card.state}</dd>"],
];

for (const [name, line] of SEEDED) {
  test(`the scan catches ${name}: ${line}`, () => {
    assert.ok(findings(line).some((f) => f.endsWith(name)), line);
  });
}

const CLEAN: readonly string[] = [
  "{r.amount === null ? \"—\" : formatCurrency(r.amount)}",
  "{labelOf(REQUEST_STATUS_LABELS, r.status)}",
  "const n = Number(form.numbers[f.key].trim());",
  'className="text-right tabular-nums"',
  "<Link href={`/savings/accounts/${d.account_id}`}>",
  "<TabsTrigger key={r.status} value={r.status}>",
  "{labelOf(REQUEST_STATUS_LABELS, r.status)}",
  "const text = `${r.status}`;",
  "<li key={`${row.kind}-${i}`}>",
];

for (const line of CLEAN) {
  test(`the scan lets a clean line through: ${line}`, () => {
    assert.deepEqual(findings(line), []);
  });
}
