/**
 * The browser never works out a score, band, capacity or money figure: every
 * credit scoring screen shows the server's. This reads each screen's source
 * (code only: comments and string text are dropped, template `${}` parts are
 * kept) and fails on the tools a sum or a rounding would need. The self-tests
 * below prove each pattern fires.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

/** Field names that hold money, scores, capacity or weights. */
const FIELD = String.raw`(?:[\w$]+\??\.)*[\w$]*(?:score|weight|income|expense|payment|debt|capacity|ratio|amount|balance|points|peso|total)[\w$]*`;

const BANNED: { name: string; pattern: RegExp }[] = [
  { name: "a sum (.reduce)", pattern: /\.reduce\(/ },
  { name: "a Math call", pattern: /\bMath\.\w+\(/ },
  { name: "a rounding (toFixed/toPrecision)", pattern: /\.toFixed\(|\.toPrecision\(/ },
  { name: "a rounding formatter", pattern: /maximumFractionDigits/ },
  { name: "a browser weight or band rule", pattern: /sumWeights|isValidWeightTotal|riskLevelFromScore/ },
  { name: "an accumulator (+=, -=, ++, --)", pattern: /\+=|-=|\+\+|--/ },
  { name: "a forEach accumulator", pattern: /\.forEach\([\s\S]*?(?:[+\-*/]=|\+\+|--|=\s*[\w$.]+\s*[+\-*/])/ },
  { name: "arithmetic after a figure", pattern: new RegExp(String.raw`\b${FIELD}\s*[+\-*/%](?![=>/*])`, "i") },
  { name: "arithmetic before a figure", pattern: new RegExp(String.raw`(?<![<+\-*/])[+\-*/%]\s*${FIELD}\b`, "i") },
  { name: "a unary minus", pattern: /(?:^|[=(,:?[{}]|\breturn|=>)\s*-\s*[A-Za-z_$(]/m },
  { name: "a number read off a figure (Number/parseFloat)", pattern: new RegExp(String.raw`\bparseFloat\(|\bparseInt\(|\bNumber\(\s*${FIELD}`, "i") },
];

/**
 * The one place a ratio is drawn: the category bar's width, from the server's
 * own two points figures. It is a bar, never a shown figure.
 */
const ALLOWED: { file: string; code: string }[] = [
  {
    file: "src/app/(app)/credit-scoring/_components/score-breakdown-card.tsx",
    code: "(row.points_earned / row.points_possible) * 100",
  },
];

/** Code only: comments and string or template text dropped, `${}` parts kept. */
function codeOf(source: string): string {
  let out = "";
  let i = 0;
  const templateDepth: number[] = [];
  let braces = 0;
  while (i < source.length) {
    const c = source[i];
    const next = source[i + 1];
    if (c === "/" && next === "/") {
      while (i < source.length && source[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && next === "*") {
      const end = source.indexOf("*/", i + 2);
      i = end < 0 ? source.length : end + 2;
      out += " ";
      continue;
    }
    if (c === '"' || c === "'") {
      i++;
      while (i < source.length && source[i] !== c && source[i] !== "\n") i += source[i] === "\\" ? 2 : 1;
      i++;
      out += '""';
      continue;
    }
    if (c === "`" || (c === "}" && templateDepth.length > 0 && templateDepth[templateDepth.length - 1] === braces)) {
      if (c === "}") templateDepth.pop();
      i++;
      while (i < source.length && source[i] !== "`" && !(source[i] === "$" && source[i + 1] === "{")) {
        i += source[i] === "\\" ? 2 : 1;
      }
      if (source[i] === "$") {
        templateDepth.push(braces);
        i += 2;
        out += " ";
      } else {
        i++;
        out += '""';
      }
      continue;
    }
    if (c === "{") braces++;
    if (c === "}") braces--;
    out += c;
    i++;
  }
  return out;
}

function violations(source: string, file = ""): string[] {
  let code = codeOf(source);
  for (const allowed of ALLOWED) {
    if (file === allowed.file) code = code.split(allowed.code).join(" ");
  }
  return BANNED.filter(({ pattern }) => pattern.test(code)).map(({ name }) => name);
}

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(name) && !name.endsWith(".test.ts") ? [path] : [];
  });
}

const FILES = [
  ...sources(join(ROOT, "src/app/(app)/credit-scoring")),
  ...sources(join(ROOT, "src/lib/credit-scoring")),
  join(ROOT, "src/app/(app)/loans/[id]/_components/credit-assessment-card.tsx"),
  join(ROOT, "src/services/credit-scoring.service.ts"),
];

test("each pattern fires on the thing it bans", () => {
  const cases: [string, string][] = [
    ["rows.reduce((t, r) => t, 0)", "a sum (.reduce)"],
    ["Math.round(x)", "a Math call"],
    ["Math.max(a, b)", "a Math call"],
    ["value.toFixed(1)", "a rounding (toFixed/toPrecision)"],
    ["new Intl.NumberFormat('en', { maximumFractionDigits: 1 })", "a rounding formatter"],
    ["sumWeights(categories)", "a browser weight or band rule"],
    ["t += n;", "an accumulator (+=, -=, ++, --)"],
    ["t -= n;", "an accumulator (+=, -=, ++, --)"],
    ["rows.forEach((r) => { t = t + 1; })", "a forEach accumulator"],
    ["const d = c.monthly_income - c.household_expenses;", "arithmetic after a figure"],
    ["const x = row.score + 1;", "arithmetic after a figure"],
    ["const y = weight_percent * 2;", "arithmetic after a figure"],
    ["const z = 2 / c.debt_service_ratio;", "arithmetic before a figure"],
    ["const s = base + score;", "arithmetic before a figure"],
    ["const n = -delta;", "a unary minus"],
    ["return -value;", "a unary minus"],
    ["const n = parseFloat(x);", "a number read off a figure (Number/parseFloat)"],
    ["const n = Number(c.proposed_payment);", "a number read off a figure (Number/parseFloat)"],
    ["const t = `${a.amount - 1}`;", "arithmetic after a figure"],
  ];
  for (const [source, name] of cases) {
    assert.ok(violations(source).includes(name), `${name} did not fire on: ${source}`);
  }
});

test("comments, strings, template text and JSX tags don't fire", () => {
  const clean = [
    '// total - score * 2 / ratio',
    "/* score + 1 */",
    'import { ScoreCells } from "../_components/score-cells";',
    "const label = `${row.points_earned}/${row.points_possible} pts`;",
    "<ScoreCells row={row} /></TableRow>",
    'const t = "Score - total";',
    "margin={{ top: 8, left: -12 }}",
    "const sorted = rows.sort((a, b) => a.time - b.time || a.id - b.id);",
  ];
  for (const source of clean) assert.deepEqual(violations(source), [], source);
});

test("only the category bar width is allowed, and only in its own file", () => {
  const bar = "<Progress value={row.points_possible > 0 ? (row.points_earned / row.points_possible) * 100 : 0} />";
  assert.deepEqual(violations(bar, ALLOWED[0].file), []);
  assert.ok(violations(bar, "src/app/(app)/credit-scoring/page.tsx").length > 0);
});

test("the scan covers the screens, the helpers, the card and the service", () => {
  assert.ok(FILES.length > 20, `only ${FILES.length} files found`);
});

test("no credit scoring screen sums or rounds a figure", () => {
  const found: string[] = [];
  for (const file of FILES) {
    const relative = file.slice(ROOT.length + 1);
    for (const name of violations(readFileSync(file, "utf8"), relative)) found.push(`${relative}: ${name}`);
  }
  assert.deepEqual(found, []);
});
