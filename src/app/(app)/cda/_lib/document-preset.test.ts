import { test } from "node:test";
import assert from "node:assert/strict";
import type { CdaIssue } from "@/types/cda";
import { blockingDocumentIssue, documentPreset } from "./document-preset";

const issue = (overrides: Partial<CdaIssue>): CdaIssue => ({
  id: "rule:signed_capr_uploaded",
  rule_id: "signed_capr_uploaded",
  severity: "critical",
  category: "compliance_document",
  component: "documents",
  message: "The signed CAPR (final copy) hasn't been uploaded.",
  section_key: null,
  field_key: null,
  fix_href: null,
  stage: "submit",
  ...overrides,
});

// As the seeded CAPR template words it (database/cda-templates/capr.json).
const CAPR = {
  rules: [
    { id: "members_total", type: "required" },
    { id: "signed_capr_uploaded", type: "document", document_category: "capr", stage: "submit", final: true },
  ],
  documents: [{ key: "audited_fs", category: "financial_statements", label: "Audited FS", stage: "submit" }],
};

test("a document rule's blocker presets its category and a final copy", () => {
  assert.deepEqual(documentPreset([issue({})], CAPR), { category: "capr", final: true });
});

test("a listed document's blocker presets the listed category", () => {
  assert.deepEqual(documentPreset([issue({ id: "document:audited_fs", rule_id: null })], CAPR), {
    category: "financial_statements",
    final: true,
  });
});

test("without the template's words the category is left for the user, the final switch still on", () => {
  assert.deepEqual(documentPreset([issue({})], null), { category: null, final: true });
  assert.deepEqual(documentPreset([issue({ id: "rule:unknown" })], CAPR), { category: null, final: true });
});

test("the Critical filing blocker is the one preset, ahead of warnings and other issues", () => {
  const picked = blockingDocumentIssue([
    issue({ id: "rule:members_total", category: "missing_required_data", component: "fields" }),
    issue({ id: "document:minutes", severity: "warning" }),
    issue({ id: "document:audited_fs", stage: "approve" }),
    issue({ id: "rule:signed_capr_uploaded" }),
  ]);
  assert.equal(picked?.id, "rule:signed_capr_uploaded");
  assert.equal(blockingDocumentIssue([issue({ category: "loan_data", component: "fields" })]), null);
});
