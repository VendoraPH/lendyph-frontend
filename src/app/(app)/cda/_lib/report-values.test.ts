import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { collectEdits, formatFieldValue, missingRequired, parseInput } from "./report-values";
import { cdaReportToDocument } from "./report-document";
import type { CdaField, CdaReport, CdaSection } from "@/types/cda";

const field = (over: Partial<CdaField>): CdaField => ({
  key: "f",
  label: "Field",
  type: "text",
  value: null,
  source: null,
  editable: true,
  required: false,
  ...over,
});

const sections: CdaSection[] = [
  {
    kind: "fields",
    key: "general",
    title: "General",
    fields: [
      field({ key: "members", label: "Members", type: "number", value: 120, source: "Members", editable: false }),
      field({ key: "manager", label: "General manager", required: true }),
      field({ key: "notes", label: "Notes" }),
    ],
  },
  {
    kind: "table",
    key: "loans",
    title: "Loans",
    columns: [{ key: "balance", label: "Balance", format: "money" }],
    rows: [{ balance: 1500 }],
  },
];

describe("report values", () => {
  test("formats by type", () => {
    assert.equal(formatFieldValue(field({ type: "boolean", value: true })), "Yes");
    assert.equal(formatFieldValue(field({ type: "compliance", value: "partial" })), "Partially compliant");
    assert.equal(
      formatFieldValue(field({ type: "select", value: "a", options: [{ value: "a", label: "Alpha" }] })),
      "Alpha",
    );
    assert.match(formatFieldValue(field({ type: "money", value: 1500 })), /1,500\.00/);
  });

  test("empty input is null, not zero", () => {
    assert.equal(parseInput("money", ""), null);
    assert.equal(parseInput("money", "12.5"), 12.5);
    assert.equal(parseInput("number", "abc"), null);
    assert.equal(parseInput("text", "x"), "x");
  });

  test("required editable fields that are blank are named; drafts fill them", () => {
    assert.deepEqual(missingRequired(sections, {}), ["General manager"]);
    assert.deepEqual(missingRequired(sections, { "general.manager": { value: "Ana" } }), []);
    assert.deepEqual(missingRequired(sections, { "general.manager": { value: "  " } }), ["General manager"]);
  });

  test("only edited, editable fields go on the wire", () => {
    const edits = collectEdits(sections, {
      "general.manager": { value: "Ana" },
      "general.members": { value: 999 },
    });
    assert.deepEqual(edits.fields, [
      { section_key: "general", field_key: "manager", value: "Ana", remarks: undefined },
    ]);
  });
});

describe("cdaReportToDocument", () => {
  const report: CdaReport = {
    id: 1,
    type: "capr",
    year: 2025,
    status: "draft",
    readiness: 62.4,
    locked: false,
    template: { id: 3, name: "CAPR", version: "2025.1" },
    sections,
    issues: [{ id: "x", severity: "critical", message: "Missing TIN", report_type: "capr" }],
    snapshot_checksum: null,
    finalized_at: null,
    updated_at: null,
    history: [],
  };

  test("carries every section as formatted text and flags open criticals", () => {
    const doc = cdaReportToDocument(report, "2026-11-07T00:00:00Z");
    assert.equal(doc.reportId, "cda_report");
    assert.equal(doc.meta.title, "CAPR — FY 2025");
    assert.equal(doc.sections.length, 4);
    const table = doc.sections[2];
    assert.equal(table.kind, "table");
    if (table.kind === "table") assert.match(String(table.rows[0].balance), /1,500\.00/);
    const note = doc.sections[3];
    assert.equal(note.kind, "note");
  });
});
