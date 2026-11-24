import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { ALL_BRANCHES } from "@/lib/branch-filter";
import {
  AUDIT_BRANCH_NOTE,
  auditBranchFilterShown,
  auditExportParams,
  auditFiltersActive,
  auditListParams,
  type AuditFilters,
} from "./audit-query";

const none: AuditFilters = {
  search: "",
  module: "all",
  action: "all",
  dateFrom: null,
  dateTo: null,
  branch: ALL_BRANCHES,
};

describe("auditBranchFilterShown", () => {
  test("the Branch filter shows only with access to every branch", () => {
    assert.equal(auditBranchFilterShown(true), true);
    assert.equal(auditBranchFilterShown(false), false);
  });
});

describe("auditExportParams", () => {
  test("no filter sends nothing", () => {
    assert.deepEqual(auditExportParams(none, true), {});
  });

  test("each filter goes by the name the server reads", () => {
    assert.deepEqual(
      auditExportParams(
        { search: "loan", module: "loans", action: "approved", dateFrom: "2026-11-01", dateTo: "2026-11-24", branch: "4" },
        true,
      ),
      {
        search: "loan",
        module: "loans",
        action: "approved",
        date_from: "2026-11-01",
        date_to: "2026-11-24",
        branch_id: 4,
      },
    );
  });

  test("All branches sends no branch_id", () => {
    assert.deepEqual(auditExportParams({ ...none, branch: ALL_BRANCHES }, true), {});
  });

  test("without access to every branch no branch_id is ever sent", () => {
    assert.deepEqual(auditExportParams({ ...none, branch: "4" }, false), {});
  });
});

describe("auditListParams", () => {
  test("the list sends the export's filters, branch included, plus its page", () => {
    const filters = { ...none, module: "users", branch: "4" };
    assert.deepEqual(auditListParams(filters, true, 2, 25), {
      ...auditExportParams(filters, true),
      page: 2,
      per_page: 25,
    });
    assert.equal(auditListParams(filters, true, 2, 25).branch_id, 4);
  });
});

describe("auditFiltersActive", () => {
  test("nothing picked is no filter", () => {
    assert.equal(auditFiltersActive(none), false);
  });

  test("a picked branch counts like any other filter", () => {
    assert.equal(auditFiltersActive({ ...none, branch: "4" }), true);
    assert.equal(auditFiltersActive({ ...none, search: "x" }), true);
    assert.equal(auditFiltersActive({ ...none, dateTo: "2026-11-24" }), true);
  });
});

test("the branch note says older events carry no branch", () => {
  assert.equal(
    AUDIT_BRANCH_NOTE,
    "Events recorded before the audit trail kept a branch have none, so a branch filter leaves them out.",
  );
});
