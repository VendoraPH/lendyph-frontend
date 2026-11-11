import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CdaField, CdaSection } from "@/types/cda";
import { carriedDrafts, draftsAfterReload, draftsForReport } from "./report-fields";
import { reportWorkspaceKey } from "./report-keys";

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

const members = field({});
const officers = field({ key: "officers", field_key: "governance.officers", label: "Officers", value: 9, source_key: "cda_officers", editable: false, overridable: true });
const trainings = field({ key: "trainings", field_key: "governance.trainings", label: "Trainings", value: 4, source_key: "cda_trainings", editable: false, overridable: false, overridden: true });

describe("unsaved report edits across a reload after a register write", () => {
  test("edits on fields the reloaded report still lets change are kept, under the reloaded figures", () => {
    const drafts = {
      "membership.members_total": { value: "130", remarks: "Two late approvals" },
      "governance.officers": { value: "11", override_reason: "Two officers elected in December" },
      "governance.trainings": { revert: true },
    };
    const reloaded = sections(field({ value: 121 }), { ...officers, value: 10 }, trainings);
    assert.deepEqual(carriedDrafts(reloaded, drafts), drafts);
  });

  test("edits on a field that is gone or can no longer change are dropped, never sent", () => {
    const drafts = {
      "membership.members_total": { value: "130" },
      "governance.officers": { value: "11", override_reason: "Elected" },
      "governance.trainings": { revert: true },
      "membership.removed": { value: "3" },
    };
    const reloaded = sections(
      field({ editable: false }),
      { ...officers, overridable: false },
      { ...trainings, overridden: false },
    );
    assert.deepEqual(carriedDrafts(reloaded, drafts), {});
  });

  test("a remark is kept on a field that still takes one", () => {
    const drafts = { "governance.trainings": { remarks: "Seminar in March" } };
    assert.deepEqual(carriedDrafts(sections(trainings), drafts), drafts);
    assert.deepEqual(carriedDrafts(sections({ ...trainings, overridden: false }), drafts), {});
  });

  test("edits belong to their report: another report starts clean", () => {
    const state = { reportId: 5, values: { "membership.members_total": { value: "130" } } };
    assert.deepEqual(draftsForReport(state, { id: 5, sections: sections(members) }), state.values);
    assert.deepEqual(draftsForReport(state, { id: 6, sections: sections(members) }), {});
  });

  test("a register write keeps the edits; any other reload (a 409) starts from the server's report", () => {
    const state = { reportId: 5, values: { "membership.members_total": { value: "130" } } };
    assert.equal(draftsAfterReload(state, "register"), state);
    assert.deepEqual(draftsAfterReload(state, "conflict"), { reportId: 5, values: {} });
  });
});

const read = (path: string) => readFileSync(join(process.cwd(), "src/app/(app)/cda", path), "utf8");

describe("the report page reloads the report in place", () => {
  test("a register write no longer remounts the report, which dropped the edits", () => {
    const workspace = read("_components/report-page.tsx").match(/<ReportWorkspace[^>]*>/)?.[0] ?? "";
    assert.ok(workspace.length > 0);
    assert.match(workspace, /key=\{reportWorkspaceKey\(ctx\.year\)\}/);
    assert.match(workspace, /registerVersion=\{/);
    assert.doesNotMatch(workspace, /key=\{[^}]*version/i);
  });

  test("the report and the page's register never share a key (React's duplicate-key warning)", () => {
    for (const year of [2025, 2026]) {
      assert.notEqual(reportWorkspaceKey(year), String(year));
      assert.equal(reportWorkspaceKey(year), reportWorkspaceKey(year));
    }
    assert.notEqual(reportWorkspaceKey(2025), reportWorkspaceKey(2026));
    // Each page's own child beside the report is keyed by the plain year.
    for (const page of ["officers/page.tsx", "social-audit/page.tsx", "pesos/page.tsx"]) {
      const keys = [...read(page).matchAll(/key=\{([^}]+)\}/g)].map((m) => m[1].trim());
      assert.ok(keys.length > 0, page);
      for (const key of keys) assert.equal(key, "ctx.year", page);
    }
  });
});

describe("workflow steps wait for a reload, as Save does", () => {
  test("the workspace hands its reload state to the workflow buttons", () => {
    const workspace = read("_components/report-workspace.tsx");
    assert.match(workspace.match(/<WorkflowActions[^>]*>/)?.[0] ?? "", /reloading=\{reloading\}/);
    const actions = read("_components/workflow-actions.tsx");
    assert.match(actions, /disabled=\{busy !== null \|\| reloading\}/);
  });
});
