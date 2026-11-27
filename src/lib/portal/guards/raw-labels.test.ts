import { test } from "node:test";
import assert from "node:assert/strict";
import { codeOf, memberSources } from "./sources";

// Every stored key a member sees reads through `labelOf` and an explicit map
// with a safe "Other" (lib/portal/labels.ts). Nothing guesses words from a
// key, and no key is printed as it is stored.

/** Fields that hold a stored key, never words. */
const KEY_FIELDS =
  "status|display_status|type|kind|category|method|outcome|frequency|interest_method|interest_rate_frequency|term_unit|maturity_instruction|member_type|actor|to_status|from_status|civil_status";

const FORBIDDEN: ReadonlyArray<{ name: string; pattern: RegExp }> = [
  { name: "humanize()", pattern: /\bhumani[sz]e\s*\(/ },
  { name: "words guessed from a key", pattern: /\.replace(?:All)?\s*\(\s*(?:\/_\/g?|["']_["'])/ },
  { name: "a raw key as a fallback", pattern: /\]\s*\?\?\s*[\w.?]+\.(?:status|type|kind|category|method)\b/ },
  { name: "a raw key printed", pattern: new RegExp(String.raw`(?<![=$])\{\s*[\w.?]+\.(?:${KEY_FIELDS})\s*\}`) },
  {
    name: "a label map read without labelOf",
    pattern: /\b(?!TONE_CLASS\b|ICONS\b|PORTAL_ENDPOINTS\b|SESSION_END_WORDS\b|CODE_WORDS\b|E\b)[A-Z][A-Z_]{2,}\[[^\]]+\](?!\s*=)/,
  },
];

export function labelFindings(source: string): string[] {
  const found: string[] = [];
  source.split("\n").forEach((line, index) => {
    const code = codeOf(line);
    for (const { name, pattern } of FORBIDDEN) if (pattern.test(code)) found.push(`line ${index + 1}: ${name}`);
  });
  return found;
}

const FILES = memberSources().filter((s) => s.file !== "lib/portal/labels.ts");

for (const { file, text } of FILES) {
  test(`${file} shows no raw key`, () => {
    assert.deepEqual(labelFindings(text), []);
  });
}

const SEEDED: ReadonlyArray<[string, string]> = [
  ["humanize()", "{humanize(row.status)}"],
  ["words guessed from a key", 'const words = key.replace(/_/g, " ");'],
  ["words guessed from a key", 'const words = key.replaceAll("_", " ");'],
  ["a raw key as a fallback", "{REQUEST_STATUS[row.status] ?? row.status}"],
  ["a raw key printed", "<td>{loan.display_status}</td>"],
  ["a raw key printed", "<span>{ row.type }</span>"],
  ["a label map read without labelOf", "<span>{LOAN_STATUS[loan.display_status]}</span>"],
];

for (const [name, line] of SEEDED) {
  test(`the scan catches ${name}: ${line}`, () => {
    assert.ok(labelFindings(line).some((f) => f.endsWith(name)), line);
  });
}

for (const line of [
  "{labelOf(LOAN_STATUS, loan.display_status)}",
  "<StatusPill value={row.status} labels={REQUEST_STATUS} />",
  "TONE_CLASS[toneOf(tones, value)]",
  "const Icon = ICONS[item.icon];",
]) {
  test(`the scan lets a clean line through: ${line}`, () => {
    assert.deepEqual(labelFindings(line), []);
  });
}
