import { test } from "node:test";
import assert from "node:assert/strict";
import type { Permission } from "@/types";
import type { CdaReportRow } from "@/types/cda";
import { reportOptions, toUpload, uploadCategories } from "./document-form";

test("restricted categories are offered only with their view; proofs and exports never", () => {
  const none = uploadCategories(() => false).map((o) => o.value);
  for (const restricted of ["financial_statements", "audit_report", "performance_audit", "atir", "abr", "tax", "mediation"]) {
    assert.equal(none.includes(restricted), false, restricted);
  }
  assert.ok(none.includes("minutes"));
  const tax = uploadCategories((p: Permission) => p === "cda:view_tax").map((o) => o.value);
  assert.ok(tax.includes("atir") && tax.includes("abr") && tax.includes("tax"));
  assert.equal(tax.includes("mediation"), false);
  const all = uploadCategories(() => true).map((o) => o.value);
  assert.equal(all.includes("submission_proof") || all.includes("report_export"), false);
});

test("a document can belong only to a report the user may open", () => {
  const rows = [
    { id: 1, report_type: "capr", part: "annual", restricted: false },
    { id: 2, report_type: "mediation", part: "h1", restricted: true },
  ] as CdaReportRow[];
  assert.deepEqual(reportOptions(rows), [{ value: "1", label: "Cooperative Annual Progress Report (CAPR)" }]);
});

test("the upload sends the report by id and final as true or false", () => {
  assert.deepEqual(toUpload({ title: "Minutes", category: "minutes", report_id: "4", final: true, notes: null }), {
    title: "Minutes",
    category: "minutes",
    report_id: 4,
    expires_on: null,
    version_label: null,
    description: null,
    notes: null,
    final: true,
  });
});
