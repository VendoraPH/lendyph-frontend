import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * The Loan Accounting screen shows the server's figures only: nothing on it
 * sums, divides or derives money. These are source checks over the page and
 * its components.
 */
const ROOT = join(process.cwd(), "src/app/(app)/accounting/loans");

function screenSources(): Array<{ file: string; code: string }> {
  const components = readdirSync(join(ROOT, "_components"))
    .filter((name) => name.endsWith(".tsx"))
    .map((name) => join("_components", name));
  return ["page.tsx", ...components].map((file) => ({
    file,
    code: readFileSync(join(ROOT, file), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, ""),
  }));
}

test("the screen has components to check", () => {
  assert.ok(screenSources().length > 1);
});

test("nothing on the screen reduces a list", () => {
  for (const { file, code } of screenSources()) {
    assert.equal(/\.reduce\(/.test(code), false, `${file} reduces a list`);
    assert.equal(/sumCentavos/.test(code), false, `${file} sums centavos`);
  }
});

test("nothing on the screen divides", () => {
  for (const { file, code } of screenSources()) {
    assert.equal(/[\w)\]]\s+\/\s+[\w(]/.test(code), false, `${file} divides`);
  }
});

test("the screen no longer builds the aging in the browser", () => {
  for (const { file, code } of screenSources()) {
    assert.equal(/buildAging|receivableAging/.test(code), false, `${file} builds the aging`);
  }
});
