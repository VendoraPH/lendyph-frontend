import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ACTION_LABELS,
  CATEGORY_RESTRICTION,
  DOCUMENT_CATEGORY_LABELS,
  SOCIAL_CATEGORY_LABELS,
  UPLOAD_CATEGORY_LABELS,
  workflowDoneMessage,
} from "./labels";

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

test("each workflow step's toast reads as a sentence", () => {
  assert.equal(workflowDoneMessage("submit_for_review", "for_review"), "Sent for review.");
  assert.equal(workflowDoneMessage("approve", "for_review"), "Step approved.");
  assert.equal(workflowDoneMessage("approve", "approved"), "Report approved.");
  assert.equal(workflowDoneMessage("return", "draft"), "Returned for changes.");
  assert.equal(workflowDoneMessage("mark_for_correction", "for_correction"), "Returned for correction.");
  assert.equal(workflowDoneMessage("refresh", "draft"), "Figures refreshed.");
  assert.equal(workflowDoneMessage("finalize", "finalized"), "Report finalized.");
  assert.equal(workflowDoneMessage("mark_submitted", "submitted"), "Filing with CDA recorded.");
  assert.equal(workflowDoneMessage("mark_accepted", "accepted"), "Marked accepted by CDA.");
  assert.equal(workflowDoneMessage("reopen", "draft"), "Report reopened.");
  assert.equal(workflowDoneMessage("set_stage", "draft"), "Stage changed.");
});

test("no workflow toast reads like a label with ': done'", () => {
  for (const action of Object.keys(ACTION_LABELS) as (keyof typeof ACTION_LABELS)[]) {
    const message = workflowDoneMessage(action, "draft");
    assert.doesNotMatch(message, /: done/);
    assert.match(message, /^[A-Z].*\.$/);
  }
});
