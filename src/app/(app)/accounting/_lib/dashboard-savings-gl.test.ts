import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SAVINGS_GL_CONTROL_HREF, savingsGlBanner, signedPesos } from "./dashboard-savings-gl";

const BASE = { as_of: "2026-11-12" };

test("no banner while the books agree, savings isn't in use, or the server sends no flag", () => {
  assert.equal(
    savingsGlBanner({ ...BASE, savings_gl_differs: false, savings_gl_control: { as_of: "2026-11-12", difference: "0.00", differences: 0 } }),
    null,
  );
  assert.equal(savingsGlBanner({ ...BASE, savings_gl_differs: null, savings_gl_control: null }), null);
  assert.equal(savingsGlBanner({ ...BASE }), null);
});

test("a difference reads in pesos as the server sent it, never as centavos", () => {
  const banner = savingsGlBanner({
    ...BASE,
    savings_gl_differs: true,
    savings_gl_control: { as_of: "2026-11-12", difference: "123.45", differences: 1 },
  });
  assert.ok(banner);
  assert.equal(banner.message, "Savings records and the books differ by ₱123.45 as of Nov 12, 2026.");
  assert.equal(banner.detail, "1 line differs between the savings subledger and GL 2050 or 2060.");
});

test("a negative difference reads in parentheses, and several lines are counted in words", () => {
  const banner = savingsGlBanner({
    ...BASE,
    savings_gl_differs: true,
    savings_gl_control: { as_of: "2026-11-10", difference: "-1500.00", differences: 3 },
  });
  assert.ok(banner);
  assert.equal(banner.message, "Savings records and the books differ by (₱1,500.00) as of Nov 10, 2026.");
  assert.equal(banner.detail, "3 lines differ between the savings subledger and GL 2050 or 2060.");
});

test("the flag alone decides: a missing control block still warns, with a dash and the dashboard's date", () => {
  const banner = savingsGlBanner({ ...BASE, savings_gl_differs: true, savings_gl_control: null });
  assert.ok(banner);
  assert.equal(banner.message, "Savings records and the books differ by — as of Nov 12, 2026.");
  assert.equal(banner.detail, null);
});

test("signedPesos keeps two decimals and dashes what isn't a figure", () => {
  assert.equal(signedPesos("0.00"), "₱0.00");
  assert.equal(signedPesos("10.5"), "₱10.50");
  assert.equal(signedPesos(""), "—");
  assert.equal(signedPesos("abc"), "—");
  assert.equal(signedPesos(undefined), "—");
});

test("the banner links to the Savings GL Control report", () => {
  assert.equal(SAVINGS_GL_CONTROL_HREF, "/reports/savings_gl_control");
  const page = readFileSync(join(process.cwd(), "src/app/(app)/accounting/page.tsx"), "utf8");
  assert.match(page, /<SavingsGlBannerCard data=\{data\} \/>/);
});
