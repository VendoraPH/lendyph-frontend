import { test } from "node:test";
import assert from "node:assert/strict";
import type { CdaReadinessBreakdown } from "@/types/cda";
import { readinessSummary } from "./readiness-text";

const counted = { passed: 7, total: 9, by_component: {}, by_section: {}, failed: [] } as CdaReadinessBreakdown;
const uncounted = { by_component: {}, by_section: {}, failed: [] } as unknown as CdaReadinessBreakdown;

test("the server's counts read as 'N of M checks pass.'", () => {
  assert.equal(readinessSummary(counted, { applicable: true, not_applicable_reason: null }), "7 of 9 checks pass.");
});

test("zero checks still reads as counts", () => {
  const none = { ...counted, passed: 0, total: 0 };
  assert.equal(readinessSummary(none, { applicable: true, not_applicable_reason: null }), "0 of 0 checks pass.");
});

test("a report that doesn't apply gives the server's reason, never ' of  checks pass.'", () => {
  // Flag 23: ATIR and ABR without a CTE arrive with no counts.
  const reason = "Applies only to a cooperative holding a valid Certificate of Tax Exemption (CTE) for the period.";
  assert.equal(
    readinessSummary(uncounted, { applicable: false, not_applicable_reason: reason }),
    `Not applicable. ${reason}`,
  );
});

test("missing counts with no reason read 'Not applicable.'", () => {
  assert.equal(readinessSummary(uncounted, { applicable: false, not_applicable_reason: null }), "Not applicable.");
  assert.equal(readinessSummary(uncounted, { applicable: true, not_applicable_reason: null }), "Not applicable.");
});
