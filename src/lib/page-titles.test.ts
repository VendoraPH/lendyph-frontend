import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  EDIT_LOAN_TITLE,
  PRINTABLE_TITLES,
  REPORT_TITLES,
  detailPageTitle,
  humanizeSegment,
  menuTitles,
  nestedPageTitle,
  subPageTitle,
} from "./page-titles";
import { SIDEBAR_NAV } from "@/constants/navigation";
import { REPORT_CATALOG } from "@/app/(app)/reports/_lib/report-catalog";
import { PRINTABLE_CATALOG } from "@/lib/printables/catalog";

describe("the title map covers both catalogs", () => {
  test("every report has a title, and the catalog shows that title", () => {
    for (const report of REPORT_CATALOG) {
      const title = REPORT_TITLES[report.id];
      assert.equal(typeof title, "string", `no title for report ${report.id}`);
      assert.notEqual(title.trim(), "", `empty title for report ${report.id}`);
      assert.equal(report.title, title);
    }
  });

  test("every report title belongs to a report in the catalog", () => {
    const ids = new Set<string>(REPORT_CATALOG.map((r) => r.id));
    assert.deepEqual(
      Object.keys(REPORT_TITLES).filter((id) => !ids.has(id)),
      [],
    );
  });

  test("every printable has a title, and the catalog shows that title", () => {
    for (const printable of PRINTABLE_CATALOG) {
      const title = (PRINTABLE_TITLES as Record<string, string>)[printable.id];
      assert.equal(typeof title, "string", `no title for printable ${printable.id}`);
      assert.notEqual(title.trim(), "", `empty title for printable ${printable.id}`);
      assert.equal(printable.title, title);
    }
  });

  test("every printable title belongs to a printable in the catalog", () => {
    const ids = new Set<string>(PRINTABLE_CATALOG.map((p) => p.id));
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

describe("the loan form's breadcrumb", () => {
  test("the edit page reads its own title, a new application the menu's", () => {
    assert.equal(EDIT_LOAN_TITLE, "Edit Loan Application");
    assert.equal(subPageTitle("loans", "new", { edit: "12" }), "Edit Loan Application");
    assert.equal(subPageTitle("loans", "new"), "New Application");
    assert.equal(subPageTitle("loans", "new", { edit: null }), "New Application");
  });

  test("a malformed edit id is a new application, as the page reads it", () => {
    for (const edit of ["", "abc", "0", "-3"]) {
      assert.equal(subPageTitle("loans", "new", { edit }), "New Application", edit);
    }
  });

  test("the edit id changes no other page's title", () => {
    assert.equal(subPageTitle("loans", "products", { edit: "12" }), "Loan Products");
  });

  test("the header passes the edit id and the page uses the same title", () => {
    const header = readFileSync(join(process.cwd(), "src/components/layout/header.tsx"), "utf8");
    assert.ok(header.includes('subPageTitle(firstSegment, subSegment, { edit: editParam, menuTitle })'));
    assert.ok(header.includes('useSearchParams().get("edit")'));
    assert.match(header, /<Suspense fallback=\{<Breadcrumb editParam=\{null\} \/>\}>/);
    const form = readFileSync(join(process.cwd(), "src/app/(app)/loans/new/page.tsx"), "utf8");
    assert.ok(form.includes("isEditMode ? EDIT_LOAN_TITLE"));
    assert.ok(!form.includes('"Edit Loan Application"'));
  });
});

describe("each section's new and edit pages", () => {
  test("a new page reads its own section's title", () => {
    assert.equal(subPageTitle("borrowers", "new"), "New Member");
    assert.equal(subPageTitle("collaterals", "new"), "New Collateral");
    assert.equal(subPageTitle("loans", "new"), "New Application");
  });

  test("a new page under another section is not called an application", () => {
    assert.equal(subPageTitle("payments", "new"), "New");
  });

  test("the member edit page reads Edit Member, a record's own page Detail", () => {
    assert.equal(detailPageTitle("borrowers", "edit"), "Edit Member");
    assert.equal(detailPageTitle("borrowers", undefined), "Detail");
    assert.equal(detailPageTitle("loans", undefined), "Detail");
    assert.equal(detailPageTitle("loans", "edit"), "Detail");
    assert.equal(detailPageTitle("borrowers", "constructor"), "Detail");
  });

  test("the header reads a record's page through detailPageTitle", () => {
    const header = readFileSync(join(process.cwd(), "src/components/layout/header.tsx"), "utf8");
    assert.ok(header.includes("detailPageTitle(firstSegment, segments[2])"));
  });
});

describe("pages the menu lists read the menu's title", () => {
  const menuTitle = menuTitles(SIDEBAR_NAV);

  test("an accounting page reads its menu title, not its route", () => {
    assert.equal(subPageTitle("accounting", "journals", { menuTitle }), "Journal Entries");
    assert.equal(subPageTitle("accounting", "expenses", { menuTitle }), "Expenses & Payables");
    assert.equal(subPageTitle("accounting", "cash-bank", { menuTitle }), "Cash & Bank");
    assert.equal(subPageTitle("settings", "gcash", { menuTitle }), "GCash");
  });

  test("a page's own title still wins, and an unlisted page reads its words", () => {
    assert.equal(subPageTitle("collaterals", "new", { menuTitle }), "New Collateral");
    assert.equal(subPageTitle("loans", "new", { menuTitle }), "New Application");
    assert.equal(subPageTitle("loans", "new", { edit: "12", menuTitle }), "Edit Loan Application");
    assert.equal(subPageTitle("borrowers", "registrations", { menuTitle }), "Registrations");
  });

  test("a section's own title wins over a page at the same route", () => {
    assert.equal(menuTitle("/loans"), "Loans");
    assert.equal(menuTitle("/accounting"), "Accounting");
    assert.equal(menuTitle("/accounting/journals"), "Journal Entries");
    assert.equal(menuTitle("/nowhere"), undefined);
  });

  test("the header reads the menu's titles", () => {
    const header = readFileSync(join(process.cwd(), "src/components/layout/header.tsx"), "utf8");
    assert.ok(header.includes("menuTitles(SIDEBAR_NAV)"));
  });
});

describe("nestedPageTitle (a page a level further down)", () => {
  const menuTitle = menuTitles(SIDEBAR_NAV);

  test("a nested page reads its own title, a record Detail", () => {
    assert.equal(nestedPageTitle("accounting", "journals", "new", menuTitle), "New Journal Entry");
    assert.equal(nestedPageTitle("accounting", "journals", "12", menuTitle), "Detail");
    assert.equal(nestedPageTitle("accounting", "reconciliation", "3", menuTitle), "Detail");
    assert.equal(nestedPageTitle("loans", "reminders", "history", menuTitle), "Message History");
  });

  test("any other nested page reads its words", () => {
    assert.equal(nestedPageTitle("loans", "reminders", "rules", menuTitle), "Rules");
    assert.equal(nestedPageTitle("accounting", "journals", "constructor"), "Constructor");
  });

  test("the header adds the nested part under a page, never under a record", () => {
    const header = readFileSync(join(process.cwd(), "src/components/layout/header.tsx"), "utf8");
    assert.ok(header.includes("nestedPageTitle(firstSegment, subSegment, segments[2], menuTitle)"));
    assert.ok(header.includes("!isId && segments.length > 2"));
  });
});

test("savings sub-pages read as savings, not loan, pages", () => {
  assert.equal(subPageTitle("savings", "products"), "Savings Products");
  assert.equal(subPageTitle("savings", "time-deposits"), "Time Deposits");
  assert.equal(subPageTitle("savings", "approvals"), "Savings Approvals");
  assert.equal(subPageTitle("savings", "interest"), "Savings Interest");
  assert.equal(subPageTitle("savings", "settings"), "Savings Settings");
  assert.equal(subPageTitle("savings", "transactions"), "Savings Transactions");
  assert.equal(subPageTitle("loans", "products"), "Loan Products");
});
