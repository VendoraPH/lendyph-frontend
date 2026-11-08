import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  PRINTABLE_TITLES,
  REPORT_TITLES,
  humanizeSegment,
  subPageTitle,
} from "./page-titles";
import { REPORT_CATALOG, SAVINGS_REPORTS } from "@/app/(app)/reports/_lib/report-catalog";
import { PRINTABLE_CATALOG } from "@/lib/printables/catalog";

describe("the title map covers both catalogs", () => {
  test("every report has a title, and the catalog shows that title", () => {
    for (const report of [...REPORT_CATALOG, ...SAVINGS_REPORTS]) {
      const title = REPORT_TITLES[report.id];
      assert.equal(typeof title, "string", `no title for report ${report.id}`);
      assert.notEqual(title.trim(), "", `empty title for report ${report.id}`);
      assert.equal(report.title, title);
    }
  });

  test("every report title belongs to a report in the catalog", () => {
    // The savings reports are catalogued only when their flag is on.
    const ids = new Set<string>([...REPORT_CATALOG, ...SAVINGS_REPORTS].map((r) => r.id));
    assert.deepEqual(
      Object.keys(REPORT_TITLES).filter((id) => !ids.has(id)),
      [],
    );
  });

  test("every printable has a title, and the catalog shows that title", () => {
    for (const printable of PRINTABLE_CATALOG) {
      const title = PRINTABLE_TITLES[printable.id];
      assert.equal(typeof title, "string", `no title for printable ${printable.id}`);
      assert.notEqual(title.trim(), "", `empty title for printable ${printable.id}`);
      assert.equal(printable.title, title);
    }
  });

  test("every printable title belongs to a printable in the catalog", () => {
    // The savings receipt prints from the transaction screens, not from the
    // subject picker, so it has a title (the tab's) but no catalog entry.
    const ids = new Set<string>([...PRINTABLE_CATALOG.map((p) => p.id), "savings_receipt"]);
    assert.deepEqual(
      Object.keys(PRINTABLE_TITLES).filter((id) => !ids.has(id)),
      [],
    );
  });
});

describe("subPageTitle (the breadcrumb's second part)", () => {
  test("credit scoring's member list reads its menu title, not the URL", () => {
    assert.equal(subPageTitle("credit-scoring", "borrowers"), "Member Scores");
  });

  test("every credit scoring page reads its menu title", () => {
    assert.equal(subPageTitle("credit-scoring", "assessment"), "Credit Assessment");
    assert.equal(subPageTitle("credit-scoring", "scorecard-configuration"), "Scorecard Configuration");
    assert.equal(subPageTitle("credit-scoring", "risk-monitoring"), "Risk Monitoring");
    assert.equal(subPageTitle("credit-scoring", "score-history"), "Score History");
    assert.equal(subPageTitle("credit-scoring", "settings"), "Settings");
  });

  test("Payment History and the Share Capital pages read their menu titles", () => {
    assert.equal(subPageTitle("payments", "history"), "Payment History");
    assert.equal(subPageTitle("share-capital", "ledger"), "Subsidiary Ledger");
    assert.equal(subPageTitle("share-capital", "pledges"), "Pledge Entry");
  });

  test("Auto-Credit reads its menu title", () => {
    assert.equal(subPageTitle("share-capital", "auto-credit"), "Auto-Credit");
  });

  test("the member report reads its menu title", () => {
    assert.equal(subPageTitle("reports", "borrower_report"), "Member Report");
  });

  test("a report shows its menu title, not its id", () => {
    assert.equal(subPageTitle("reports", "cash_flow"), "Cash Flow Statement");
    assert.equal(subPageTitle("reports", "performance"), "Officer / Branch Performance");
  });

  test("a printable shows its menu title", () => {
    assert.equal(subPageTitle("printables", "official_receipt"), "Official Receipt");
    assert.equal(subPageTitle("printables", "release_voucher"), "Loan Release Voucher");
  });

  test("a report or printable id is only looked up under its own section", () => {
    assert.equal(subPageTitle("loans", "cash_flow"), "Cash flow");
    assert.equal(subPageTitle("reports", "official_receipt"), "Official receipt");
  });

  test("an inherited object key is not a title", () => {
    assert.equal(subPageTitle("reports", "constructor"), "Constructor");
    assert.equal(subPageTitle("printables", "toString"), "ToString");
  });

  test("the fixed sub-pages keep their labels", () => {
    assert.equal(subPageTitle("loans", "new"), "New Application");
    assert.equal(subPageTitle("settings", "user-roles"), "Role and Permissions");
    assert.equal(subPageTitle("settings", "loan-products"), "Loan Products");
  });

  test("an unknown segment falls back to its words", () => {
    assert.equal(subPageTitle("reports", "some_new_report"), "Some new report");
    assert.equal(subPageTitle("printables", "data-template"), "Data template");
  });
});

describe("humanizeSegment", () => {
  test("capitalises and turns dashes and underscores into spaces", () => {
    assert.equal(humanizeSegment("cash_flow"), "Cash flow");
    assert.equal(humanizeSegment("share-capital"), "Share capital");
    assert.equal(humanizeSegment("a_b-c"), "A b c");
    assert.equal(humanizeSegment("dashboard"), "Dashboard");
    assert.equal(humanizeSegment(""), "");
  });
});

test("savings products are not loan products", () => {
  assert.equal(subPageTitle("savings", "products"), "Savings Products");
  assert.equal(subPageTitle("settings", "products"), "Loan Products");
  assert.equal(subPageTitle("savings", "deposits"), "Deposits");
});
