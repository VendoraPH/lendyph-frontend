import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_QUEUE_STATUS, fileLine, reviewActions, verifyPayload } from "./document-review";
import type { DocumentStatus } from "@/types/loan-origination";

const doc = (status: DocumentStatus, uploaded = true) => ({ status, uploaded_at: uploaded ? "2026-11-20T02:00:00Z" : null });

test("review actions follow the server's moves for each document status", () => {
  assert.deepEqual(reviewActions(doc("uploaded")), ["verify", "replace", "reject"]);
  assert.deepEqual(reviewActions(doc("pending_verification")), ["verify", "replace", "reject"]);
  // A verified file can still be rejected or asked for again; a rejected one asked for again.
  assert.deepEqual(reviewActions(doc("verified")), ["replace", "reject"]);
  assert.deepEqual(reviewActions(doc("rejected")), ["replace"]);
  assert.deepEqual(reviewActions(doc("replacement_requested")), []);
  // No file, nothing to review.
  assert.deepEqual(reviewActions(doc("uploaded", false)), []);
});

test("the queue opens on files waiting for a decision: uploads land as Uploaded", () => {
  assert.equal(DEFAULT_QUEUE_STATUS, "uploaded");
});

test("verifying an ID sends its type, its name for Others and its number", () => {
  assert.deepEqual(verifyPayload(true, { notes: "", idType: "passport", customTypeName: "ignored", idNumber: " P1234567A " }), {
    body: { id_type: "passport", id_number: "P1234567A" },
    problem: null,
  });
  assert.deepEqual(verifyPayload(true, { notes: " Clear photo ", idType: "others", customTypeName: " Barangay ID ", idNumber: "BRGY-99" }), {
    body: { notes: "Clear photo", id_type: "others", custom_type_name: "Barangay ID", id_number: "BRGY-99" },
    problem: null,
  });
});

test("an ID can't be verified without its type and number, in the server's words", () => {
  assert.equal(verifyPayload(true, { notes: "", idType: "", customTypeName: "", idNumber: "123" }).problem, "Choose the ID type.");
  assert.equal(verifyPayload(true, { notes: "", idType: "others", customTypeName: " ", idNumber: "123" }).problem, "Enter the ID type's name.");
  assert.equal(verifyPayload(true, { notes: "", idType: "sss", customTypeName: "", idNumber: "  " }).problem, "Enter the ID number.");
  assert.equal(verifyPayload(true, { notes: "", idType: "library_card", customTypeName: "", idNumber: "1" }).problem, "Choose the ID type from the list.");
});

test("any other document is verified with its optional notes only", () => {
  assert.deepEqual(verifyPayload(false, { notes: "", idType: "passport", customTypeName: "", idNumber: "X" }), { body: {}, problem: null });
  assert.deepEqual(verifyPayload(false, { notes: " ok ", idType: "", customTypeName: "", idNumber: "" }), { body: { notes: "ok" }, problem: null });
});

test("a file staff may not open still reads as uploaded, with its name hidden", () => {
  assert.deepEqual(fileLine({ file_name: "payslip.pdf", uploaded_at: "2026-11-20T02:00:00Z" }), { text: "payslip.pdf", hidden: false });
  assert.deepEqual(fileLine({ file_name: null, uploaded_at: "2026-11-20T02:00:00Z" }), { text: "File name hidden", hidden: true });
  assert.deepEqual(fileLine({ file_name: null, uploaded_at: null }), { text: "Not uploaded", hidden: false });
});
