/**
 * Scorecard Configuration, read from source: factor ranges are edited (no
 * read-only list), the server's 422 messages land on their factor, the save
 * names the new version, and only credit_scoring:settings reaches it.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(process.cwd(), "src/app/(app)/credit-scoring/scorecard-configuration");
const page = readFileSync(join(dir, "page.tsx"), "utf8");
const editor = readFileSync(join(dir, "_components/factor-ranges-editor.tsx"), "utf8");
const readOnly = readFileSync(join(dir, "_components/read-only-rules.tsx"), "utf8");

test("only credit_scoring:settings reaches the screen", () => {
  assert.match(page, /<RouteGuard permission="credit_scoring:settings" pageName="Scorecard Configuration">/);
});

test("factor ranges are edited; the read-only factor list is gone", () => {
  assert.match(page, /<FactorRangesEditor/);
  assert.doesNotMatch(page, /FactorRulesList/);
  assert.doesNotMatch(readOnly, /FactorRulesList/);
});

test("the server's factor messages go to their factor, and the save names the new version", () => {
  assert.match(page, /factors: factorRangeErrors\(err, config\.factor_rules\)/);
  assert.match(page, /Saved as scorecard v\$\{after\.version\}/);
});

test("each range shows the rule in words and the factor's own unit", () => {
  assert.match(editor, /FACTOR_RULE_LABELS\[rule\.rule\]/);
  assert.match(editor, /\{rule\.unit\}/);
  assert.match(editor, /ruleOrderNote\(rule\.rule\)/);
  assert.match(editor, /Any other value/);
  assert.match(editor, /A defaulted or written-off loan/);
  assert.doesNotMatch(editor, /\{rule\.rule\}/);
});
