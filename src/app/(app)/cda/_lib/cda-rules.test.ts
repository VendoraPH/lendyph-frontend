import { describe, test } from "node:test";
import assert from "node:assert/strict";
import type { CdaField, CdaSection } from "@/types/cda";
import {
  ACTION_LABELS,
  NEEDS_REASON,
  REPORT_PAGES,
  REPORT_TYPE_LABELS,
  STATUS_META,
  UNKNOWN_LABEL,
  labelOf,
  reportName,
  statusMeta,
  trainingKeyLabel,
} from "./labels";
import { asSent, cdaMoney, cdaPercent } from "./money";
import { currentValue, fieldInputs, formatCell, formatFieldValue, fromInputText, missingReasons } from "./report-fields";
import { fromDraft, missingFields, toDraft, type RecordField } from "./record-form";
import { signedUrl } from "./safe-url";
import { parseYear, resolveYear } from "./year";

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

describe("report types and words (design §3 renames)", () => {
  test("the server's ten types, with ABR as the Annual Benefits Report", () => {
    assert.deepEqual(Object.keys(REPORT_TYPE_LABELS).sort(), [
      "abr",
      "atir",
      "capr",
      "financial_statements",
      "mediation",
      "officers_trainings",
      "performance_audit",
      "pesos",
      "social_audit",
      "sworn_statement",
    ]);
    assert.equal(REPORT_TYPE_LABELS.abr, "Annual Benefits Report (ABR)");
    assert.ok(!Object.values(REPORT_TYPE_LABELS).some((t) => /BIR/.test(t)));
  });

  test("mediation's halves read in words", () => {
    assert.equal(reportName("mediation", "h1"), "Mediation and Conciliation Report, First half (January–June)");
    assert.equal(reportName("mediation", "h2"), "Mediation and Conciliation Report, Second half (July–December)");
    assert.equal(reportName("capr", "annual"), "Cooperative Annual Progress Report (CAPR)");
  });

  test("restricted types need their view, matching the server's ReportTypes", () => {
    assert.equal(REPORT_PAGES.mediation.restriction, "cda:view_mediation");
    assert.equal(REPORT_PAGES.financial_statements.restriction, "cda:view_audit");
    assert.equal(REPORT_PAGES.performance_audit.restriction, "cda:view_audit");
    assert.equal(REPORT_PAGES.atir.restriction, "cda:view_tax");
    assert.equal(REPORT_PAGES.abr.restriction, "cda:view_tax");
    for (const t of ["capr", "social_audit", "pesos", "officers_trainings", "sworn_statement"] as const) {
      assert.equal(REPORT_PAGES[t].restriction, null, t);
    }
  });

  test("every server status and display status reads in words", () => {
    for (const s of ["draft", "for_review", "approved", "finalized", "submitted", "accepted", "for_correction", "not_applicable", "not_started", "returned", "validation_failed"]) {
      assert.ok(Object.hasOwn(STATUS_META, s), s);
      assert.doesNotMatch(STATUS_META[s as keyof typeof STATUS_META].label, /_/);
    }
    assert.equal(statusMeta("something_new").label, UNKNOWN_LABEL);
  });

  test("every workflow action reads in words, and the server's three need a reason", () => {
    for (const label of Object.values(ACTION_LABELS)) assert.doesNotMatch(label, /_/);
    assert.deepEqual([...NEEDS_REASON].sort(), ["mark_for_correction", "reopen", "return"]);
  });

  test("an unknown key reads Other, a missing one a dash, never the key", () => {
    assert.equal(labelOf({ a: "A" }, "b_c"), UNKNOWN_LABEL);
    assert.equal(labelOf({ a: "A" }, null), "—");
    assert.equal(trainingKeyLabel("basic_coop_course"), "Basic coop course");
  });
});

describe("money and figures as the server sends them", () => {
  test("₱ with two decimals, a negative in parentheses, a missing figure a dash", () => {
    assert.equal(cdaMoney("1500.5"), "₱1,500.50");
    assert.equal(cdaMoney("-400.00"), "(₱400.00)");
    assert.equal(cdaMoney("0.00"), "₱0.00");
    assert.equal(cdaMoney(null), "—");
  });

  test("percents and PESOS figures read as sent", () => {
    assert.equal(cdaPercent("12.50"), "12.50%");
    assert.equal(asSent("87.25"), "87.25");
    assert.equal(asSent(null), "—");
  });
});

describe("the report's PUT body", () => {
  test("only changed, editable fields go, keyed by field_key, values as typed", () => {
    const f = field({});
    const locked = field({ field_key: "membership.other", editable: false });
    const body = fieldInputs(sections(f, locked), {
      "membership.members_total": { value: "125" },
      "membership.other": { value: "9" },
    });
    assert.deepEqual(body, [{ field_key: "membership.members_total", value: "125" }]);
  });

  test("overriding a figure from the system carries its reason, and asks for one", () => {
    const f = field({ source_key: "members.count", editable: false, overridable: true, source: "Members" });
    const drafts = { "membership.members_total": { value: "130", override_reason: "" } };
    assert.deepEqual(missingReasons(sections(f), drafts), ["Reason for overriding Members"]);
    const body = fieldInputs(sections(f), { "membership.members_total": { value: "130", override_reason: " Late approvals " } });
    assert.deepEqual(body, [{ field_key: "membership.members_total", value: "130", override_reason: "Late approvals" }]);
  });

  test("reverting an override sends revert, never a value", () => {
    const f = field({ source_key: "members.count", editable: false, overridable: true, overridden: true });
    assert.deepEqual(fieldInputs(sections(f), { "membership.members_total": { revert: true } }), [
      { field_key: "membership.members_total", revert: true },
    ]);
    assert.deepEqual(missingReasons(sections(f), { "membership.members_total": { revert: true } }), []);
  });

  test("a draft shows in place of the stored value; blank input is null", () => {
    const f = field({});
    assert.equal(currentValue(f, { "membership.members_total": { value: "7" } }), "7");
    assert.equal(currentValue(f, {}), 120);
    assert.equal(fromInputText("  "), null);
    assert.equal(fromInputText("1500.50"), "1500.50");
  });

  test("values read in words by type", () => {
    assert.equal(formatFieldValue({ type: "money", options: null }, "-12.05"), "(₱12.05)");
    assert.equal(formatFieldValue({ type: "boolean", options: null }, true), "Yes");
    assert.equal(formatFieldValue({ type: "compliance", options: null }, "non_compliant"), "Not compliant");
    assert.equal(formatFieldValue({ type: "select", options: [{ value: "unmodified", label: "Unmodified" }] }, "unmodified"), "Unmodified");
    assert.equal(formatFieldValue({ type: "select", options: [] }, "raw_key"), "Other");
    assert.equal(formatCell("money", "2500.00"), "₱2,500.00");
    assert.equal(formatCell(undefined, null), "—");
  });
});

describe("register forms", () => {
  const fields: RecordField[] = [
    { key: "name", label: "Program", type: "text", required: true },
    { key: "actual_expense", label: "Actual expense", type: "money" },
    { key: "actual_beneficiaries", label: "Beneficiaries", type: "number" },
    { key: "is_mandatory", label: "Mandatory", type: "checkbox" },
  ];

  test("money goes as typed, a count as a whole number, a checkbox as true or false", () => {
    assert.deepEqual(fromDraft(fields, { name: " Feeding ", actual_expense: "1500.50", actual_beneficiaries: "40", is_mandatory: "1" }), {
      name: "Feeding",
      actual_expense: "1500.50",
      actual_beneficiaries: 40,
      is_mandatory: true,
    });
    assert.equal(fromDraft(fields, { actual_beneficiaries: "4.5" }).actual_beneficiaries, "4.5");
  });

  test("a record fills the form, defaults fill a new one, and required blanks are named", () => {
    assert.deepEqual(toDraft(fields, { name: "X", actual_expense: "10.00", actual_beneficiaries: 3, is_mandatory: true }), {
      name: "X",
      actual_expense: "10.00",
      actual_beneficiaries: "3",
      is_mandatory: "1",
    });
    assert.equal(toDraft(fields, null, { name: "Default" }).name, "Default");
    assert.deepEqual(missingFields(fields, { name: " " }), ["Program"]);
  });
});

describe("years and links come from the server", () => {
  test("the picked year when it is open, else the newest period, else none", () => {
    const periods = [{ year: 2026 }, { year: 2025 }];
    assert.equal(resolveYear(2025, periods), 2025);
    assert.equal(resolveYear(2019, periods), 2026);
    assert.equal(resolveYear(null, []), null);
  });

  test("a year to open is four digits", () => {
    assert.equal(parseYear(" 2026 "), 2026);
    assert.equal(parseYear("26"), null);
    assert.equal(parseYear("2026a"), null);
  });

  test("only an http(s) link the server sent opens", () => {
    assert.equal(signedUrl("https://api.example/api/files/documents/1?signature=x"), "https://api.example/api/files/documents/1?signature=x");
    assert.equal(signedUrl("javascript:alert(1)"), null);
    assert.equal(signedUrl(null), null);
  });
});
