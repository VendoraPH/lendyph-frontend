import { test } from "node:test";
import assert from "node:assert/strict";
import { CATEGORY_RESTRICTION, DOCUMENT_CATEGORY_LABELS, SOCIAL_CATEGORY_LABELS, UPLOAD_CATEGORY_LABELS } from "./labels";

/** `DocumentCategories::LABELS` keys (backend B4), proofs and exports included. */
const SERVER_DOCUMENT_CATEGORIES = [
  "capr",
  "financial_statements",
  "audit_report",
  "management_representation",
  "management_responsibility",
  "fs_notes",
  "performance_audit",
  "social_audit",
  "pesos",
  "officers_trainings",
  "mediation",
  "sworn_statement",
  "atir",
  "abr",
  "tax",
  "minutes",
  "cda_correspondence",
  "certificates",
  "submission_proof",
  "report_export",
  "other",
];

/** `CdaSocialProgram::CATEGORIES` (backend B4). */
const SERVER_SOCIAL_CATEGORIES = [
  "member_education",
  "financial_literacy",
  "education",
  "health",
  "environment",
  "community",
  "youth",
  "livelihood",
  "disaster_response",
  "other",
];

test("every document category the server knows reads in words", () => {
  for (const key of SERVER_DOCUMENT_CATEGORIES) {
    const label = DOCUMENT_CATEGORY_LABELS[key];
    assert.ok(label && !label.includes("_"), key);
  }
  assert.equal(UPLOAD_CATEGORY_LABELS.cda_correspondence, "CDA Correspondence");
  assert.equal(UPLOAD_CATEGORY_LABELS.management_representation, "Management representation letter");
  assert.equal(UPLOAD_CATEGORY_LABELS.management_responsibility, "Statement of management responsibility");
  assert.equal(UPLOAD_CATEGORY_LABELS.fs_notes, "Notes to the financial statements");
});

test("the audited statements' supporting papers need cda:view_audit; CDA correspondence is open", () => {
  for (const key of ["management_representation", "management_responsibility", "fs_notes"]) {
    assert.equal(CATEGORY_RESTRICTION[key], "cda:view_audit", key);
  }
  assert.equal(CATEGORY_RESTRICTION.cda_correspondence, undefined);
});

test("every social program category reads in words, member education and financial literacy included", () => {
  assert.deepEqual(Object.keys(SOCIAL_CATEGORY_LABELS).sort(), [...SERVER_SOCIAL_CATEGORIES].sort());
  assert.equal(SOCIAL_CATEGORY_LABELS.member_education, "Member education");
  assert.equal(SOCIAL_CATEGORY_LABELS.financial_literacy, "Financial literacy");
});
