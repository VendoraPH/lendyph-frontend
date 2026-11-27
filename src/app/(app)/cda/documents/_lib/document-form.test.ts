import { test } from "node:test";
import assert from "node:assert/strict";
import type { Permission } from "@/types";
import type { CdaReportRow } from "@/types/cda";
import { toFormData } from "@/services/cda.service";
import { attachCategories, attachDefaults, reportOptions, toUpload, uploadCategories, uploadFields } from "./document-form";

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

test("an upload attached to a register row sends its subject", () => {
  const upload = toUpload({ title: "Attendance sheet", category: "officers_trainings", report_id: null, final: false }, { type: "training", id: 7 });
  assert.equal(upload.subject_type, "training");
  assert.equal(upload.subject_id, 7);
  assert.equal(upload.report_id, null);
  const form = toFormData({ ...upload });
  assert.equal(form.get("subject_type"), "training");
  assert.equal(form.get("subject_id"), "7");
  assert.equal(form.get("report_id"), null);
});

test("an upload without a subject sends none", () => {
  const form = toFormData({ ...toUpload({ title: "Minutes", category: "minutes", report_id: null, final: false }) });
  assert.equal(form.get("subject_type"), null);
  assert.equal(form.get("subject_id"), null);
});

test("Attach starts on the register's own category; a training's certificate is added from the training", () => {
  assert.deepEqual(attachDefaults("training"), { category: "officers_trainings", final: "1" });
  assert.deepEqual(attachDefaults("program"), { category: "social_audit", final: "1" });
  assert.deepEqual(attachDefaults("case"), { category: "mediation", final: "1" });
  const all = uploadCategories(() => true);
  assert.equal(attachCategories(all, "training").some((c) => c.value === "certificates"), false);
  assert.ok(attachCategories(all, "program").some((c) => c.value === "certificates"));
  assert.ok(attachCategories(all, "case").some((c) => c.value === "cda_correspondence"));
});

test("the report picker says a CDA letter not linked to a report is open to every CDA user", () => {
  const report = uploadFields(uploadCategories(() => true), []).find((f) => f.key === "report_id");
  assert.ok(report);
  assert.match(report.help ?? "", /CDA Correspondence/);
  assert.match(report.help ?? "", /every CDA user/);
});
