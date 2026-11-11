import { describe, test } from "node:test";
import assert from "node:assert/strict";
import type { CdaField, CdaOfficer, CdaReport, CdaReportRow, CdaSection, CdaSnapshotSummary } from "@/types/cda";
import type { Permission } from "@/types/rbac";
import { getErrorMessage } from "@/lib/api-error";
import {
  GAP_PERMISSIONS,
  checkWords,
  cleanEvidence,
  currentEvidence,
  deadlineRequest,
  evidenceEditable,
  officerIdOf,
  officerOptions,
  showsFor,
  snapshotStatus,
  withDeadline,
} from "./screen-gaps";
import { fieldInputs } from "./report-fields";
import { PROFILE_REP_FIELD, toProfile } from "../settings/_lib/settings-forms";

const holding =
  (...held: Permission[]) =>
  (p: Permission) =>
    held.includes(p);

function field(overrides: Partial<CdaField>): CdaField {
  return {
    key: "members_total",
    field_key: "membership.members_total",
    section_key: "membership",
    label: "Members",
    type: "number",
    value: 120,
    source: null,
    source_key: null,
    source_value: null,
    source_error: null,
    as_of: null,
    provisional: false,
    note: null,
    calculated: false,
    overridden: false,
    override_reason: null,
    editable: true,
    overridable: false,
    required: false,
    options: null,
    decimals: null,
    help: null,
    remarks: null,
    evidence: null,
    ...overrides,
  };
}

const sections = (...fields: CdaField[]): CdaSection[] => [
  { kind: "fields", key: "membership", title: "Membership", description: null, fields },
];

/** A 4xx as axios hands it over, with the server's words. */
const refusal = (status: number, message: string, errors?: Record<string, string[]>) => ({
  response: { status, data: { success: false, message, ...(errors ? { errors } : {}) } },
});

describe("who sees each new action (the permission its route needs)", () => {
  test("each action names the backend route's permission", () => {
    assert.deepEqual(GAP_PERMISSIONS, {
      deadline: "cda:settings",
      snapshots: "cda:view",
      evidence: "cda:prepare",
      responsibleOfficer: "cda:manage_social",
      authorisedRep: "cda:settings",
    });
  });

  test("the deadline override shows only with cda:settings", () => {
    assert.equal(showsFor("deadline", holding("cda:settings")), true);
    assert.equal(showsFor("deadline", holding("cda:view", "cda:prepare", "cda:approve", "cda:finalize")), false);
  });

  test("the snapshot list and its check show with cda:view", () => {
    assert.equal(showsFor("snapshots", holding("cda:view")), true);
    assert.equal(showsFor("snapshots", holding("cda:prepare")), false);
  });

  test("editing evidence needs cda:prepare; the register and profile pickers their own manage permission", () => {
    assert.equal(showsFor("evidence", holding("cda:prepare")), true);
    assert.equal(showsFor("evidence", holding("cda:view", "cda:settings")), false);
    assert.equal(showsFor("responsibleOfficer", holding("cda:manage_social")), true);
    assert.equal(showsFor("responsibleOfficer", holding("cda:manage_officers")), false);
    assert.equal(showsFor("authorisedRep", holding("cda:settings")), true);
    assert.equal(showsFor("authorisedRep", holding("cda:manage_officers")), false);
  });
});

describe("a report's own deadline (PATCH /cda/reports/{id}/deadline)", () => {
  test("setting one sends the date and the trimmed reference", () => {
    assert.deepEqual(deadlineRequest("2027-05-31", "  CDA letter 2027-04-02 "), {
      body: { override_on: "2027-05-31", reference: "CDA letter 2027-04-02" },
    });
  });

  test("a missing date or reference is named before anything is sent", () => {
    assert.deepEqual(deadlineRequest("", ""), { missing: ["New deadline", "Reference"] });
    assert.deepEqual(deadlineRequest("2027-05-31", "   "), { missing: ["Reference"] });
  });

  test("removing it sends null for both", () => {
    assert.deepEqual(deadlineRequest(null, "ignored"), { body: { override_on: null, reference: null } });
  });

  test("the screen shows the server's effective deadline and days remaining, copied, never worked out", () => {
    const report = { id: 4, effective_deadline: "2027-04-30", days_remaining: 170, due_override_on: null, due_override_reference: null, default_due_on: "2027-04-30", sections: [] } as unknown as CdaReport;
    const row = { effective_deadline: "2027-05-31", days_remaining: 201, due_override_on: "2027-05-31", due_override_reference: "CDA letter", default_due_on: "2027-04-30" } as CdaReportRow;
    const next = withDeadline(report, row);
    assert.equal(next.effective_deadline, "2027-05-31");
    assert.equal(next.days_remaining, 201);
    assert.equal(next.due_override_on, "2027-05-31");
    assert.equal(next.due_override_reference, "CDA letter");
    assert.equal(next.sections, report.sections);
  });

  test("a refusal shows the server's words", () => {
    const missingRef = refusal(422, "Give the reference for this report's own deadline.", {
      reference: ["Give the reference for this report's own deadline."],
    });
    assert.equal(getErrorMessage(missingRef, "Could not save the deadline"), "Give the reference for this report's own deadline.");
    const noPermission = refusal(403, "This needs the cda:settings permission.");
    assert.equal(getErrorMessage(noPermission, "Could not save the deadline"), "This needs the cda:settings permission.");
    const restricted = refusal(403, "Mediation and Conciliation Report is restricted: it needs the cda:view_mediation permission.");
    assert.match(getErrorMessage(restricted, "Could not save the deadline"), /is restricted/);
  });
});

describe("snapshot history (GET …/snapshots, POST …/snapshots/{version}/verify)", () => {
  const snapshot = (overrides: Partial<CdaSnapshotSummary>): CdaSnapshotSummary => ({
    id: 1,
    version: 1,
    checksum: "a".repeat(64),
    finalized_at: "2027-03-01T02:00:00Z",
    finalized_by: { id: 2, name: "Ana Cruz" },
    superseded_at: null,
    reopened_by: null,
    reopen_reason: null,
    ...overrides,
  });

  test("a version is current until a reopen supersedes it", () => {
    assert.deepEqual(snapshotStatus(snapshot({})), { label: "Current", tone: "success" });
    assert.deepEqual(snapshotStatus(snapshot({ superseded_at: "2027-03-05T02:00:00Z" })), { label: "Superseded", tone: "neutral" });
  });

  test("the check reads the server's checksum_matches in words", () => {
    assert.deepEqual(checkWords({ version: 2, checksum: "b", checksum_matches: true }), {
      label: "Checksum matches",
      tone: "success",
      detail: "Version 2 is exactly as it was finalized.",
    });
    assert.equal(checkWords({ version: 2, checksum: "b", checksum_matches: false }).tone, "danger");
    assert.match(checkWords({ version: 2, checksum: "b", checksum_matches: false }).detail, /doesn't match/);
  });

  test("a refused check shows the server's words", () => {
    assert.equal(getErrorMessage(refusal(404, "This report has no version 3."), "Could not check the version"), "This report has no version 3.");
    assert.equal(getErrorMessage(refusal(403, "This needs the cda:view permission."), "Could not check the version"), "This needs the cda:view permission.");
  });
});

describe("field evidence (PUT /cda/reports/{id} fields[].evidence)", () => {
  test("a field that takes a value or an override takes evidence; a fixed one stays read-only", () => {
    assert.equal(evidenceEditable(field({ editable: true })), true);
    assert.equal(evidenceEditable(field({ editable: false, overridable: true, source_key: "members.count" })), true);
    assert.equal(evidenceEditable(field({ editable: false, overridden: true, source_key: "members.count" })), true);
    assert.equal(evidenceEditable(field({ editable: false, calculated: true })), false);
    assert.equal(evidenceEditable(field({ editable: false, source_key: "loans.released" })), false);
  });

  test("the draft's evidence shows over the stored one", () => {
    const f = field({ evidence: [{ label: "Board resolution 12", note: null }] });
    assert.deepEqual(currentEvidence(f, {}), [{ label: "Board resolution 12", note: null }]);
    assert.deepEqual(currentEvidence(f, { [f.field_key]: { evidence: [] } }), []);
    assert.deepEqual(currentEvidence(field({ evidence: null }), {}), []);
  });

  test("entries are trimmed, blank ones dropped, a linked document kept, and an empty list is null", () => {
    assert.deepEqual(
      cleanEvidence([
        { label: "  Minutes, Mar 3 ", note: "" },
        { label: " ", note: "  " },
        { document_id: 7, label: "", note: "" },
      ]),
      [
        { label: "Minutes, Mar 3", note: null },
        { document_id: 7, label: null, note: null },
      ],
    );
    assert.equal(cleanEvidence([{ label: "", note: "" }]), null);
  });

  test("evidence goes in the PUT body for a field that takes it, never for a fixed field", () => {
    const manual = field({});
    const fixed = field({ field_key: "membership.loans", editable: false, source_key: "loans.released" });
    const drafts = {
      [manual.field_key]: { evidence: [{ label: " Ledger page 4 ", note: "Checked by the treasurer" }] },
      [fixed.field_key]: { evidence: [{ label: "Should not go", note: null }] },
    };
    assert.deepEqual(fieldInputs(sections(manual, fixed), drafts), [
      { field_key: manual.field_key, evidence: [{ label: "Ledger page 4", note: "Checked by the treasurer" }] },
    ]);
  });

  test("clearing every entry sends null; an override keeps its reason with the evidence", () => {
    const manual = field({ evidence: [{ label: "Old" }] });
    assert.deepEqual(fieldInputs(sections(manual), { [manual.field_key]: { evidence: [] } }), [
      { field_key: manual.field_key, evidence: null },
    ]);
    const sourced = field({ editable: false, overridable: true, source_key: "members.count" });
    assert.deepEqual(
      fieldInputs(sections(sourced), { [sourced.field_key]: { value: "130", override_reason: "Late list", evidence: [{ label: "Roster" }] } }),
      [{ field_key: sourced.field_key, value: "130", override_reason: "Late list", evidence: [{ label: "Roster", note: null }] }],
    );
  });

  test("a refused save shows the server's words", () => {
    const err = refusal(422, "A field takes up to 20 pieces of evidence.", {
      "fields.0.evidence": ["A field takes up to 20 pieces of evidence."],
    });
    assert.equal(getErrorMessage(err, "Could not save the report"), "A field takes up to 20 pieces of evidence.");
    const locked = refusal(409, "This report is for review, so it can't be changed. Return it to draft first.");
    assert.match(getErrorMessage(locked, "Could not save the report"), /Return it to draft first/);
  });
});

describe("officer pickers (social program responsible officer, profile authorised representative)", () => {
  const officer = (overrides: Partial<CdaOfficer>): CdaOfficer =>
    ({
      id: 3,
      name: "Maria Santos",
      position: "chairperson",
      position_label: "Chairperson",
      position_title: null,
      status: "active",
      ...overrides,
    }) as CdaOfficer;

  test("each officer reads by name and position, never an id", () => {
    assert.deepEqual(officerOptions([officer({}), officer({ id: 4, name: null, position_label: "Treasurer" })]), [
      { value: "3", label: "Maria Santos · Chairperson" },
      { value: "4", label: "Unnamed officer · Treasurer" },
    ]);
  });

  test("a position title wins over the position, and a former officer says so", () => {
    assert.deepEqual(officerOptions([officer({ position_title: "Board Chair", status: "resigned" })]), [
      { value: "3", label: "Maria Santos · Board Chair (Resigned)" },
    ]);
  });

  test("an officer already chosen but not in the list is kept, by the server's name", () => {
    assert.deepEqual(officerOptions([officer({})], [{ id: 9, name: "Jose Reyes" }, { id: 9, name: "Jose Reyes" }]), [
      { value: "3", label: "Maria Santos · Chairperson" },
      { value: "9", label: "Jose Reyes (not serving this year)" },
    ]);
    assert.equal(officerOptions([officer({})], [{ id: 3, name: "Maria Santos" }]).length, 1);
    assert.deepEqual(officerOptions([], [{ id: 5, name: null }], "no longer in the register"), [
      { value: "5", label: "The officer on file (no longer in the register)" },
    ]);
  });

  test("the chosen officer goes as its id, blank as null", () => {
    assert.equal(officerIdOf("12"), 12);
    assert.equal(officerIdOf(""), null);
    assert.equal(officerIdOf(null), null);
  });

  test("the profile sends the authorised representative only when the officer list is offered", () => {
    const base = toProfile({ cte_status: "none" });
    assert.equal("authorized_rep_officer_id" in base, false);
    const withRep = toProfile({ cte_status: "none", authorized_rep_officer_id: "5" }, [PROFILE_REP_FIELD]);
    assert.equal(withRep.authorized_rep_officer_id, 5);
    const cleared = toProfile({ cte_status: "none", authorized_rep_officer_id: "" }, [PROFILE_REP_FIELD]);
    assert.equal(cleared.authorized_rep_officer_id, null);
  });

  test("a refused pick shows the server's words", () => {
    const err = refusal(422, "Choose an officer from the register.", { responsible_officer_id: ["Choose an officer from the register."] });
    assert.equal(getErrorMessage(err, "Could not save the program"), "Choose an officer from the register.");
  });
});
