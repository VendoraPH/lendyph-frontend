import { test } from "node:test";
import assert from "node:assert/strict";
import { applyChrome, buildReference } from "./report-chrome";
import type { ReportDocument } from "./types";

/**
 * Chrome is what turns a data dump into a document: who ran it, under whose
 * logo, against which branch, and under what reference. It is applied after
 * the build, so these tests assert the merge rather than any payload mapping.
 */

function baseDoc(): ReportDocument {
  return {
    reportId: "aging_report",
    meta: {
      title: "Aging Report",
      generatedAt: "Aug 6, 2026, 9:15 AM",
      org: "Lendyph — Cooperative Lending",
    },
    sections: [{ kind: "note", text: "Total overdue: ₱451,861.50" }],
  };
}

test("chrome lands in meta where the preview and every export read it", () => {
  const doc = applyChrome(baseDoc(), {
    logoUrl: "https://api.example.test/storage/logo.png",
    logoData: "data:image/png;base64,AAAA",
    preparedBy: "A. Maputol",
    branchLabel: "Main",
    reference: "AGE-20260806-0915",
  });

  assert.equal(doc.meta.logoUrl, "https://api.example.test/storage/logo.png");
  assert.equal(doc.meta.logoData, "data:image/png;base64,AAAA");
  assert.equal(doc.meta.preparedBy, "A. Maputol");
  assert.equal(doc.meta.branchLabel, "Main");
  assert.equal(doc.meta.reference, "AGE-20260806-0915");
});

test("a report generated before branding resolves keeps a null logo", () => {
  const doc = applyChrome(baseDoc(), { preparedBy: "A. Maputol" });

  assert.equal(doc.meta.logoUrl, null);
  assert.equal(doc.meta.logoData, null);
  assert.equal(doc.meta.branchLabel, null);
});

test("a reference is minted when the caller supplies none", () => {
  const doc = applyChrome(baseDoc(), {});
  assert.match(doc.meta.reference!, /^AGE-\d{8}-\d{4}$/);
});

test("the reference is stamped from local calendar parts, not UTC", () => {
  // 00:30 on Aug 7 in Manila is still Aug 6 in UTC. Formatting off the ISO
  // string would date this report a day early.
  const at = new Date(2026, 7, 7, 0, 30);
  assert.equal(buildReference("statement_of_account", at), "SOA-20260807-0030");
});

test("every report id has its own reference prefix", () => {
  const at = new Date(2026, 7, 6, 9, 15);
  assert.equal(buildReference("daily_collection", at), "DCR-20260806-0915");
  assert.equal(buildReference("subsidiary_ledger", at), "SLG-20260806-0915");
});

test("the sign-off block closes the document", () => {
  const doc = applyChrome(baseDoc(), {});
  const last = doc.sections[doc.sections.length - 1];

  assert.equal(last.kind, "signatures");
  assert.deepEqual(
    last.kind === "signatures" ? last.roles : [],
    ["Prepared by", "Checked by", "Approved by"]
  );
});

test("regenerating does not stack a second sign-off block", () => {
  const once = applyChrome(baseDoc(), {});
  const twice = applyChrome(once, {});

  assert.equal(twice.sections.filter((s) => s.kind === "signatures").length, 1);
});

test("applying chrome leaves the built document untouched", () => {
  const original = baseDoc();
  applyChrome(original, { preparedBy: "A. Maputol" });

  assert.equal(original.sections.length, 1);
  assert.equal(original.meta.preparedBy, undefined);
});
