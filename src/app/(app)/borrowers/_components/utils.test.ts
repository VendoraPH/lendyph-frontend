import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  memberStatusLabel,
  paymentReferenceCell,
  registrationSubmittedAt,
  reviewerLabel,
  sentencesMessage,
  statusInWords,
} from "./utils";

test("reviewerLabel prefers the relation's full_name when the API sends one", () => {
  assert.equal(
    reviewerLabel({
      rejected_by: 7,
      rejected_by_user: { full_name: "Rosario Dela Peña", name: "rosario" },
    }),
    "Rosario Dela Peña",
  );
});

test("reviewerLabel falls back to the relation's name", () => {
  assert.equal(
    reviewerLabel({ rejected_by: 7, rejected_by_user: { name: "rosario" } }),
    "rosario",
  );
});

test("reviewerLabel degrades to the bare id BorrowerResource actually sends", () => {
  // The resource returns `'rejected_by' => $this->rejected_by` and never loads
  // the rejectedByUser relation, so this is the production path today.
  assert.equal(reviewerLabel({ rejected_by: 7 }), "Reviewer #7");
  assert.equal(
    reviewerLabel({ rejected_by: 7, rejected_by_user: null }),
    "Reviewer #7",
  );
});

test("reviewerLabel treats user id 0 as a reviewer, not as missing", () => {
  // `if (source.rejected_by)` would swallow this one and blame nobody.
  assert.equal(reviewerLabel({ rejected_by: 0 }), "Reviewer #0");
});

test("reviewerLabel returns null when no reviewer was recorded", () => {
  assert.equal(reviewerLabel({}), null);
  assert.equal(reviewerLabel({ rejected_by: null }), null);
  assert.equal(
    reviewerLabel({ rejected_by: undefined, rejected_by_user: undefined }),
    null,
  );
});

test("reviewerLabel ignores an empty-string name rather than rendering blank", () => {
  assert.equal(
    reviewerLabel({ rejected_by: 4, rejected_by_user: { full_name: "", name: "" } }),
    "Reviewer #4",
  );
});

test("memberStatusLabel capitalises every member status", () => {
  assert.equal(memberStatusLabel("active"), "Active");
  assert.equal(memberStatusLabel("inactive"), "Inactive");
  assert.equal(memberStatusLabel("blacklisted"), "Blacklisted");
  assert.equal(memberStatusLabel("pending"), "Pending");
  assert.equal(memberStatusLabel("rejected"), "Rejected");
});

test("statusInWords capitalises payment and schedule statuses", () => {
  assert.equal(statusInWords("completed"), "Completed");
  assert.equal(statusInWords("voided"), "Voided");
  assert.equal(statusInWords("paid"), "Paid");
  assert.equal(statusInWords("past_due"), "Past Due");
});

test("statusInWords reads a dash when there is no status", () => {
  assert.equal(statusInWords(null), "—");
  assert.equal(statusInWords(""), "—");
});

test("sentencesMessage shows full sentences as they are, with one full stop", () => {
  assert.equal(sentencesMessage(["Enter the ID number for ID 1."]), "Enter the ID number for ID 1.");
  assert.equal(
    sentencesMessage(["Select an ID type for ID 2.", "Upload the front of ID 2."]),
    "Select an ID type for ID 2. Upload the front of ID 2.",
  );
});

test("the ID checks never go through the field-name wording", () => {
  const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
  for (const path of [
    "src/app/(app)/borrowers/[id]/edit/page.tsx",
    "src/app/(app)/borrowers/new/page.tsx",
    "src/app/(app)/borrowers/registrations/[id]/page.tsx",
  ]) {
    const source = read(path);
    assert.doesNotMatch(source, /notifyValidation\((idCheck|idErrors)/, path);
    assert.match(source, /toast\.error\(sentencesMessage\(/, path);
  }
});

test("a registration was submitted when its record was created", () => {
  assert.equal(registrationSubmittedAt({ created_at: "2026-11-01T02:00:00Z" }), "2026-11-01T02:00:00Z");
  assert.equal(registrationSubmittedAt({ created_at: null }), null);
  assert.equal(registrationSubmittedAt({}), null);
});

test("a payment's reference is its reference number, never the collector", () => {
  assert.equal(paymentReferenceCell({ reference_number: "GC-123" }), "GC-123");
  assert.equal(paymentReferenceCell({ reference_number: null }), "—");
  assert.equal(paymentReferenceCell({ reference_number: "  " }), "—");
  const tab = readFileSync(
    join(process.cwd(), "src/app/(app)/borrowers/[id]/_components/payments-tab.tsx"),
    "utf8",
  );
  assert.doesNotMatch(tab, /reference_number \|\| payment\.collected_by/);
});

test("the edit form's Civil Status names its options, so it reads Single, not single", () => {
  const page = readFileSync(join(process.cwd(), "src/app/(app)/borrowers/[id]/edit/page.tsx"), "utf8");
  assert.match(page, /items=\{CIVIL_STATUS_OPTIONS\}/);
});
