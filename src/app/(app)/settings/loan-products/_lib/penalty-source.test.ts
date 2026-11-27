import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { NEW_PRODUCT_PENALTY_LINE, penaltySourceLine } from "./penalty-source";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

test("a product in a configuration names it and links to Settings → Penalties", () => {
  assert.deepEqual(
    penaltySourceLine({ type: "configuration", config_id: 1, config_name: "Standard Loan Penalty", rate: null }),
    { text: "Penalty: Standard Loan Penalty (Settings → Penalties)", linked: true },
  );
});

test("a product with a fixed rate reads it as set before Penalties", () => {
  assert.deepEqual(penaltySourceLine({ type: "fixed_rate", config_id: null, config_name: null, rate: 3 }), {
    text: "Fixed 3% a month (set before Penalties)",
    linked: false,
  });
  assert.equal(
    penaltySourceLine({ type: "fixed_rate", config_id: null, config_name: null, rate: 1.125 }).text,
    "Fixed 1.125% a month (set before Penalties)",
  );
});

test("a product with neither reads No penalty", () => {
  assert.deepEqual(penaltySourceLine({ type: "none", config_id: null, config_name: null, rate: null }), {
    text: "No penalty",
    linked: false,
  });
  assert.equal(penaltySourceLine(undefined).linked, false);
  assert.match(NEW_PRODUCT_PENALTY_LINE, /Settings → Penalties/);
});

test("the link needs penalties:view", () => {
  assert.match(read("src/app/(app)/settings/loan-products/_components/penalty-source-line.tsx"), /linked && can\("penalties:view"\)/);
});

test("with the flag on the form hides the Penalty Rate input and shows the source; off, it's unchanged", () => {
  const page = read("src/app/(app)/settings/loan-products/page.tsx");
  assert.match(page, /env\.features\.penaltyConfigs \? \(\s*\/\/[^\n]*\n[^\n]*\n\s*<div className="space-y-2">\s*<p className="text-sm font-medium">Penalty<\/p>/);
  assert.match(page, /<PenaltySourceLine source=\{penaltySource\} isNew=\{!initialData\} \/>/);
  assert.match(page, /<PenaltySourceLine source=\{product\.penalty_source\} \/>/);
  assert.match(page, /id="penalty-rate"/);
  assert.match(page, /id="grace-period"/);
});
