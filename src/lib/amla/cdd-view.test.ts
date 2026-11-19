import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDate, formatDateTime } from "@/lib/format";
import type { AmlaCddProfile, AmlaCddRow, AmlaProfileChange, AmlaRiskAssessment } from "@/types/amla-cdd";
import {
  AMLA_CDD_STATUS_OPTIONS,
  AMLA_RISK_LEVEL_OPTIONS,
  amlaAssessBody,
  amlaCddStatusTone,
  amlaCompletenessLines,
  amlaFactorRows,
  amlaIdDocumentOptions,
  amlaIdVerificationBody,
  amlaProfileBody,
  amlaProfileChangeRow,
  amlaProfileDraft,
  amlaReviewBody,
  amlaReviewLines,
  amlaRiskSummary,
  amlaWorklistRow,
} from "./cdd-view";

const ana = { id: 7, name: "Ana Cruz" };

test("the CDD statuses read in the server's words, in its order", () => {
  assert.deepEqual(AMLA_CDD_STATUS_OPTIONS, [
    { value: "not_started", label: "Not Started" },
    { value: "pending_verification", label: "Pending Verification" },
    { value: "verified", label: "Verified" },
    { value: "additional_info_required", label: "Additional Information Required" },
    { value: "edd_required", label: "Enhanced Due Diligence Required" },
    { value: "review_overdue", label: "Review Overdue" },
  ]);
});

test("a status's badge says how urgent it is, and an unknown one stays plain", () => {
  assert.equal(amlaCddStatusTone("review_overdue"), "destructive");
  assert.equal(amlaCddStatusTone("edd_required"), "destructive");
  assert.equal(amlaCddStatusTone("additional_info_required"), "secondary");
  assert.equal(amlaCddStatusTone("pending_verification"), "secondary");
  assert.equal(amlaCddStatusTone("verified"), "default");
  assert.equal(amlaCddStatusTone("not_started"), "outline");
  assert.equal(amlaCddStatusTone("something_new"), "outline");
});

const ROW: AmlaCddRow = {
  type: "member",
  id: 7,
  name: "Juan Dela Cruz",
  code: "BRW-000007",
  branch: { id: 1, name: "Main" },
  is_imported: true,
  cdd_status: "additional_info_required",
  cdd_status_words: "Additional Information Required",
  risk_level: "medium",
  risk_level_words: "Medium",
  next_review_on: "2027-11-20",
  missing_count: 3,
};

test("a worklist row reads in words, from the server's figures", () => {
  assert.deepEqual(amlaWorklistRow(ROW), {
    key: "member-7",
    href: "/amla/customers/members/7",
    name: "Juan Dela Cruz",
    code: "BRW-000007",
    type: "Member",
    branch: "Main",
    imported: true,
    status: "Additional Information Required",
    tone: "secondary",
    risk: "Medium",
    nextReview: formatDate("2027-11-20"),
    missing: "3 items missing",
  });
});

test("a walk-in, a subject not yet assessed or reviewed, and a complete one read as such", () => {
  const walkIn = amlaWorklistRow({ ...ROW, type: "walk_in", id: 4, code: null, branch: null, is_imported: false, risk_level: null, risk_level_words: null, next_review_on: null, missing_count: 1 });
  assert.equal(walkIn.href, "/amla/customers/walk-ins/4");
  assert.equal(walkIn.type, "Walk-in");
  assert.equal(walkIn.code, "—");
  assert.equal(walkIn.branch, "Head office");
  assert.equal(walkIn.risk, "Not assessed yet");
  assert.equal(walkIn.nextReview, "Not set");
  assert.equal(walkIn.missing, "1 item missing");
  assert.equal(amlaWorklistRow({ ...ROW, missing_count: 0 }).missing, "Complete");
  assert.equal(amlaWorklistRow({ ...ROW, branch: null }).branch, "No branch");
});

test("the completeness check lists what is missing, expired and expiring, in the server's words", () => {
  assert.deepEqual(
    amlaCompletenessLines({
      complete: false,
      missing: [{ key: "nationality", words: "The nationality is missing" }],
      expired: [{ key: "id_expired", words: "The verified ID expired on January 2, 2026" }],
      expiring_soon: [],
    }),
    { complete: null, items: ["The nationality is missing", "The verified ID expired on January 2, 2026"] },
  );
  assert.deepEqual(amlaCompletenessLines({ complete: true, missing: [], expired: [], expiring_soon: [{ key: "id_expiring", words: "The verified ID expires on December 1, 2026" }] }), {
    complete: "Everything CDD needs is on file.",
    items: ["The verified ID expires on December 1, 2026"],
  });
});

const ASSESSMENT: AmlaRiskAssessment = {
  id: 3,
  level: "high",
  level_words: "High",
  computed_level: "medium",
  computed_level_words: "Medium",
  score: 45,
  overridden: true,
  override_carried: false,
  override_reason: "Adverse media seen by the branch.",
  factors: [
    { key: "customer_type", label: "Customer type", value: "member", value_words: "Member", points: 0 },
    { key: "pep", label: "Politically exposed person", value: "pep", value_words: "PEP", points: 30 },
    { key: "watchlist", label: "Watchlist findings", value: "not_available", value_words: "Data not available yet", points: 0 },
  ],
  trigger: "override",
  trigger_words: "Level overridden",
  rule_version: 1,
  rules_to_verify: true,
  assessed_by: ana,
  assessed_at: "2026-11-20T02:00:00Z",
};

test("every factor lists its value and points, and factors with no data say so", () => {
  assert.deepEqual(amlaFactorRows(ASSESSMENT), [
    { key: "customer_type", label: "Customer type", value: "Member", points: "0 points", notAvailable: false },
    { key: "pep", label: "Politically exposed person", value: "PEP", points: "30 points", notAvailable: false },
    { key: "watchlist", label: "Watchlist findings", value: "Data not available yet", points: "—", notAvailable: true },
  ]);
  assert.equal(amlaFactorRows({ ...ASSESSMENT, factors: [{ ...ASSESSMENT.factors[0], points: 1 }] })[0].points, "1 point");
});

test("the risk summary says the level, the score, the override and its reason, and the rules' version", () => {
  assert.deepEqual(amlaRiskSummary(ASSESSMENT), {
    level: "High",
    score: "Score 45",
    override: "Overridden from Medium. Reason: Adverse media seen by the branch.",
    rules: "Rules version 1, still to verify",
    assessed: `Level overridden by Ana Cruz, ${formatDateTime("2026-11-20T02:00:00Z")}`,
  });
  const plain = amlaRiskSummary({ ...ASSESSMENT, level: "medium", level_words: "Medium", overridden: false, override_reason: null, rules_to_verify: false, assessed_by: null, trigger_words: "Profile changed" });
  assert.equal(plain.override, null);
  assert.equal(plain.rules, "Rules version 1");
  assert.equal(plain.assessed, `Profile changed by the system, ${formatDateTime("2026-11-20T02:00:00Z")}`);
  const carried = amlaRiskSummary({ ...ASSESSMENT, override_carried: true });
  assert.equal(carried.override, "Overridden from Medium, carried from the last assessment. Reason: Adverse media seen by the branch.");
});

test("the override levels read in words", () => {
  assert.deepEqual(AMLA_RISK_LEVEL_OPTIONS, [
    { value: "low", label: "Low" },
    { value: "medium", label: "Medium" },
    { value: "high", label: "High" },
  ]);
});

test("assessing now sends nothing; an override sends its level and its reason", () => {
  assert.deepEqual(amlaAssessBody({ level: "", reason: "" }), { body: {} });
  assert.deepEqual(amlaAssessBody({ level: "high", reason: "  Adverse media  " }), {
    body: { override_level: "high", override_reason: "Adverse media" },
  });
});

test("an override needs a reason, at most 1,000 characters, and a reason needs a level", () => {
  assert.deepEqual(amlaAssessBody({ level: "high", reason: " " }), { error: "Give the reason for the override." });
  assert.deepEqual(amlaAssessBody({ level: "high", reason: "x".repeat(1001) }), { error: "Keep the reason to 1,000 characters." });
  assert.deepEqual(amlaAssessBody({ level: "", reason: "Because" }), { error: "Pick the level to override to, or clear the reason." });
});

const PROFILE: AmlaCddProfile = {
  exists: true,
  id: 5,
  nationality: "PH",
  occupation: "Teacher",
  source_of_funds: "salary",
  source_of_funds_words: "Salary",
  source_of_funds_other: null,
  purpose: "Loans and savings",
  expected_monthly_amount: "15000.00",
  expected_monthly_amount_words: "₱15,000.00",
  expected_monthly_count: 4,
  pep_status: "not_pep",
  pep_status_words: "Not a politically exposed person",
  pep_details: null,
  adverse_info: false,
  adverse_info_note: null,
  last_review_on: null,
  next_review_on: null,
  edd_required: false,
  edd_required_since: null,
  edd_completed: false,
  updated_at: "2026-11-20T02:00:00Z",
};

test("the profile form starts from the answers on file", () => {
  assert.deepEqual(amlaProfileDraft(PROFILE), {
    nationality: "PH",
    occupation: "Teacher",
    source_of_funds: "salary",
    source_of_funds_other: "",
    purpose: "Loans and savings",
    expected_monthly_amount: "15000.00",
    expected_monthly_count: "4",
    pep_status: "not_pep",
    pep_details: "",
    adverse_info: "no",
    adverse_info_note: "",
  });
  assert.equal(amlaProfileDraft({ ...PROFILE, adverse_info: null }).adverse_info, "");
});

test("an unchanged save sends nothing and says so", () => {
  const draft = amlaProfileDraft(PROFILE);
  draft.occupation = " Teacher ";
  assert.deepEqual(amlaProfileBody(PROFILE, draft), { unchanged: "Nothing changed, so nothing was saved." });
});

test("only the changed answers are sent, trimmed, with a cleared answer sent as empty", () => {
  const draft = amlaProfileDraft(PROFILE);
  draft.nationality = " us ";
  draft.expected_monthly_amount = "20000.5";
  draft.expected_monthly_count = "";
  draft.adverse_info = "yes";
  draft.adverse_info_note = " Local news ";
  assert.deepEqual(amlaProfileBody(PROFILE, draft), {
    body: {
      nationality: "US",
      expected_monthly_amount: "20000.5",
      expected_monthly_count: null,
      adverse_info: true,
      adverse_info_note: "Local news",
    },
  });
});

test("the profile form says what is wrong, in words", () => {
  const draft = () => amlaProfileDraft(PROFILE);
  assert.deepEqual(amlaProfileBody(PROFILE, { ...draft(), nationality: "PHL" }), {
    error: "The nationality is a two-letter country code, such as PH.",
  });
  assert.deepEqual(amlaProfileBody(PROFILE, { ...draft(), expected_monthly_amount: "15,000" }), {
    error: "The expected monthly amount is in pesos with up to two decimals, such as 15000.00.",
  });
  assert.deepEqual(amlaProfileBody(PROFILE, { ...draft(), expected_monthly_count: "4.5" }), {
    error: "The expected number of transactions a month is a whole number.",
  });
  assert.deepEqual(amlaProfileBody(PROFILE, { ...draft(), source_of_funds: "other", source_of_funds_other: " " }), {
    error: "Say what the other source of funds is.",
  });
});

test("the other source's description is sent with the source, and cleared when the source changes", () => {
  const other = { ...PROFILE, source_of_funds: "other", source_of_funds_other: "Rental income" };
  const draft = amlaProfileDraft(other);
  draft.source_of_funds = "business";
  assert.deepEqual(amlaProfileBody(other, draft), { body: { source_of_funds: "business", source_of_funds_other: null } });
  const toOther = amlaProfileDraft(PROFILE);
  toOther.source_of_funds = "other";
  toOther.source_of_funds_other = "Rental income";
  assert.deepEqual(amlaProfileBody(PROFILE, toOther), { body: { source_of_funds: "other", source_of_funds_other: "Rental income" } });
});

test("a member's valid IDs read by type and last four only, never the whole number", () => {
  const options = amlaIdDocumentOptions([
    { id: 10, type: "valid_id", label: "drivers_license", id_number: "N01-23-456789", side: "front" },
    { id: 11, type: "valid_id", label: "others", custom_type_name: "Barangay ID", id_number: "BRGY 55 21" },
    { id: 12, type: "valid_id", label: "others", custom_type_name: "ID 1234", id_number: "778899" },
    { id: 13, type: "photo", label: null, id_number: null },
    { id: 14, type: "valid_id", label: "passport", id_number: null },
    { id: 15, type: "valid_id", label: "something_else", id_number: "AB12" },
  ]);
  assert.deepEqual(options, [
    { value: "10", label: "Driver's License ****6789 (front)" },
    { value: "11", label: "Barangay ID ****5521" },
    { value: "12", label: "Others ****8899" },
    { value: "15", label: "Others ****AB12" },
  ]);
  assert.ok(options.every((o) => !o.label.includes("456789")));
});

test("an ID check needs a method and a result; a member's needs one of their IDs", () => {
  const form = { documentId: "10", method: "original_seen", result: "verified", expiresOn: "2030-01-31", notes: " Seen at the branch " };
  assert.deepEqual(amlaIdVerificationBody("member", form), {
    body: { document_id: 10, method: "original_seen", result: "verified", expires_on: "2030-01-31", notes: "Seen at the branch" },
  });
  assert.deepEqual(amlaIdVerificationBody("walk_in", { ...form, documentId: "", expiresOn: "", notes: "" }), {
    body: { method: "original_seen", result: "verified" },
  });
  assert.deepEqual(amlaIdVerificationBody("member", { ...form, documentId: "" }), { error: "Pick one of the member's own valid IDs." });
  assert.deepEqual(amlaIdVerificationBody("member", { ...form, method: "" }), { error: "Pick how the ID was checked." });
  assert.deepEqual(amlaIdVerificationBody("member", { ...form, result: "" }), { error: "Pick the result." });
});

test("a photocopy alone never verifies an ID, as the server rules", () => {
  assert.deepEqual(amlaIdVerificationBody("member", { documentId: "10", method: "copy_only", result: "verified", expiresOn: "", notes: "" }), {
    error: "A photocopy or scan alone never verifies an ID. Record it as could not be verified, or check the original.",
  });
});

test("a review needs a kind and an outcome, and an EDD review needs notes", () => {
  assert.deepEqual(amlaReviewBody({ kind: "periodic", outcome: "no_change", notes: "" }), { body: { kind: "periodic", outcome: "no_change" } });
  assert.deepEqual(amlaReviewBody({ kind: "edd", outcome: "updated", notes: " Source of wealth checked " }), {
    body: { kind: "edd", outcome: "updated", notes: "Source of wealth checked" },
  });
  assert.deepEqual(amlaReviewBody({ kind: "edd", outcome: "updated", notes: "" }), { error: "An enhanced due diligence review needs notes." });
  assert.deepEqual(amlaReviewBody({ kind: "", outcome: "updated", notes: "" }), { error: "Pick the kind of review." });
  assert.deepEqual(amlaReviewBody({ kind: "periodic", outcome: "", notes: "" }), { error: "Pick the outcome." });
});

test("the review lines give the next and last review dates from the server, and EDD's state", () => {
  assert.deepEqual(amlaReviewLines({ ...PROFILE, last_review_on: "2026-11-20", next_review_on: "2028-11-20" }), {
    next: `Next review ${formatDate("2028-11-20")}`,
    last: `Last reviewed ${formatDate("2026-11-20")}`,
    edd: null,
  });
  const fresh = amlaReviewLines(PROFILE);
  assert.equal(fresh.next, "No review scheduled yet");
  assert.equal(fresh.last, "Not reviewed yet");
  assert.equal(amlaReviewLines({ ...PROFILE, edd_required: true }).edd, "Enhanced due diligence is required and not yet done.");
  assert.equal(amlaReviewLines({ ...PROFILE, edd_required: true, edd_completed: true }).edd, "Enhanced due diligence is done.");
});

test("a profile change lists the fields it changed, in words, never their values", () => {
  const change: AmlaProfileChange = {
    id: 1,
    fields: ["nationality", "expected_monthly_centavos", "pep_details", "mystery"],
    changes: { pep_details: { old: null, new: "Mayor of Example City" } },
    changed_by: ana,
    changed_at: "2026-11-20T02:00:00Z",
  };
  const row = amlaProfileChangeRow(change);
  assert.deepEqual(row, {
    id: 1,
    fields: "Nationality, Expected monthly amount, PEP details, Another answer",
    who: "Ana Cruz",
    when: formatDateTime("2026-11-20T02:00:00Z"),
  });
  assert.doesNotMatch(JSON.stringify(row), /Mayor/);
});
