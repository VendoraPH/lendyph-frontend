import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { centavosOrDash, clearingNeedsReview } from "./dashboard-figures";

test("a figure shows ₱ with two decimals, and zero shows ₱0.00", () => {
  assert.equal(centavosOrDash(150_050), "₱1,500.50");
  assert.equal(centavosOrDash(0), "₱0.00");
  assert.equal(centavosOrDash(-1_050), "-₱10.50");
});

test("a missing figure shows a dash", () => {
  assert.equal(centavosOrDash(null), "—");
  assert.equal(centavosOrDash(undefined), "—");
});

test("a decimal-cast string is read as the number it carries", () => {
  assert.equal(centavosOrDash("150050" as unknown as number), "₱1,500.50");
  assert.equal(centavosOrDash("" as unknown as number), "—");
  assert.equal(centavosOrDash("abc" as unknown as number), "—");
});

test("the 1180 badge follows the server's flag only, whatever the balance", () => {
  assert.equal(clearingNeedsReview(true), true);
  assert.equal(clearingNeedsReview(false), false);
  assert.equal(clearingNeedsReview(undefined), false);
  assert.equal(clearingNeedsReview(null), false);
});

test("the receivables card reads the flag, never the 1180 balance, for the badge", () => {
  const section = readFileSync(
    join(process.cwd(), "src/app/(app)/accounting/_components/dashboard/receivables-section.tsx"),
    "utf8",
  );
  assert.match(
    section,
    /badge=\{\s*clearingNeedsReview\(data\.adjustments_clearing_needs_review\) \?/,
  );
  // The balance appears once, as the card's figure, and is compared with nothing.
  assert.equal(section.match(/data\.adjustments_clearing\b(?!_needs_review)/g)?.length, 1);
  assert.match(section, /value=\{data\.adjustments_clearing\}/);
  assert.doesNotMatch(section, /adjustments_clearing\s*(?:[!=]==?|[<>]=?)/);
  assert.equal(section.match(/Needs review/g)?.length, 1);
});
