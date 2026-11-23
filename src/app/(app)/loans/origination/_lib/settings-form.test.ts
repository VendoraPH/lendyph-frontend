import { test } from "node:test";
import assert from "node:assert/strict";
import { documentTypeKey, settingsPayload, settingsProblems } from "./settings-form";
import type { OriginationSettings } from "@/types/loan-origination";

const settings: OriginationSettings = {
  general: {
    online_applications_enabled: true,
    require_approved_member: true,
    default_branch_id: null,
    reference_format: "OA-YYYY-NNNNNN",
    draft_expiration_days: 30,
    estimated_minutes: 15,
  },
  products: [],
  assessment: {
    max_dti: 40,
    min_coverage: 1.25,
    min_remaining_income: 0,
    income_recognition: { employed: 100 },
    require_verified_income: false,
    min_employment_years: null,
    missing_information_rule: "provisional",
    product_overrides: [],
  },
  documents: {
    accepted_file_types: ["jpg", "png", "pdf"],
    max_upload_mb: 10,
    retention_days: 365,
    types: [
      { type: "government_id", label: "Government ID", description: null, required: true },
      { type: "", label: "Payslip (latest)", description: null, required: false },
    ],
  },
  notifications: {
    application_confirmation: true,
    incomplete_reminder: false,
    incomplete_reminder_after_days: 3,
    document_request: true,
    status_change: true,
    decision: true,
  },
  rules_version: 2,
  server: { enabled: true, public_url: null, public_url_problem: "Not set.", pdf_check: "PDFs are checked", scanner: "ClamAV" },
  updated_by: { id: 1, name: "Admin" },
  updated_at: "2026-11-20T00:00:00Z",
};

test("a save sends the five editable sections only, never what the server reports", () => {
  const payload = settingsPayload(settings);
  assert.deepEqual(Object.keys(payload).sort(), ["assessment", "documents", "general", "notifications", "products"]);
  assert.equal(payload.general.require_approved_member, true);
});

test("the approved-member setting goes out as the toggle reads, off included", () => {
  const off = settingsPayload({ ...settings, general: { ...settings.general, require_approved_member: false } });
  assert.equal(off.general.require_approved_member, false);
});

test("a saved document type keeps its key; a new one gets a key from its name when saved", () => {
  const types = settingsPayload(settings).documents.types;
  assert.equal(types[0].type, "government_id");
  assert.equal(types[1].type, "payslip_latest");
  assert.equal(documentTypeKey("Latest Payslip / ITR"), "latest_payslip_itr");
});

test("a key reading 'valid ID' is the server's to refuse, in its own words", () => {
  const named = { ...settings, documents: { ...settings.documents, types: [{ type: "", label: "Valid ID", description: null, required: false }] } };
  assert.equal(settingsPayload(named).documents.types[0].type, "valid_id");
  assert.deepEqual(settingsProblems(named), []);
});

test("a document type with no name is caught before saving", () => {
  const unnamed = { ...settings, documents: { ...settings.documents, types: [{ type: "", label: "  ", description: null, required: false }] } };
  assert.deepEqual(settingsProblems(unnamed), ["Give each document type a name."]);
  assert.deepEqual(settingsProblems(settings), []);
});
