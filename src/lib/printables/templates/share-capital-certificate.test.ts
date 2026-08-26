import { test } from "node:test";
import assert from "node:assert/strict";
import { formatCurrency, formatValue } from "@/lib/report-format";
import { amountInWords } from "../amount-in-words";
import {
  buildShareCapitalCertificateDoc,
  toShareCapitalLedgerFallback,
} from "./share-capital-certificate";
import { BLANK_LINE, PRINT_PAGE_SIZE } from "./shared";
import {
  assertPrintableShape,
  chargeAmount,
  fieldValue,
  hasChargeLine,
  isBlankField,
  notes,
  prose,
  signatureLabels,
  tableBlock,
  titleBlock,
} from "./doc-assertions";

const NOW = new Date(2026, 7, 26);

/**
 * `GET /api/reports/share-capital-statement/{borrower}` — the primary source.
 *
 * `ReportService::shareCapitalStatement()` orders `->orderBy('date')
 * ->orderBy('id')` and accumulates as it maps, so entries arrive oldest-first
 * with a `running_balance` already on each one, under a `totals` block.
 */
const STATEMENT = {
  borrower: {
    id: 7,
    borrower_code: "MBR-0001",
    full_name: "Juana Dela Cruz",
  },
  date_from: null,
  date_to: "2026-08-26",
  opening_balance: 5000,
  entries: [
    { id: 1, date: "2026-01-15", reference: "SC-0001", description: "Monthly contribution", debit: 0, credit: 1000, running_balance: 6000, posted_by: "Carlo Uy" },
    { id: 2, date: "2026-02-15", reference: "SC-0002", description: "Monthly contribution", debit: 0, credit: 1000, running_balance: 7000, posted_by: "Carlo Uy" },
    { id: 3, date: "2026-03-10", reference: "SC-0003", description: "Partial withdrawal", debit: 500, credit: 0, running_balance: 6500, posted_by: "Carlo Uy" },
  ],
  totals: { entry_count: 3, credits: 2000, debits: 500, net_movement: 1500 },
  closing_balance: 6500,
  pledge: null,
  generated_at: "2026-08-26 09:15:00",
};

/**
 * `GET /api/share-capital/ledger?borrower_id=` — the paginated fallback, as the
 * endpoint actually answers it.
 *
 * Two properties the old fixture got wrong, and both of them mattered:
 *
 *  - `ShareCapitalLedgerController::index()` orders
 *    `->orderByDesc('date')->orderByDesc('id')`, so the newest entry is FIRST;
 *  - `ShareCapitalLedgerResource` sends `debit` and `credit` and no
 *    `running_balance` at all, so every balance has to be derived.
 *
 * Fixturing it oldest-first hid a reverse-cumulative balance in every row of a
 * document a member signs.
 */
const LEDGER_LIST = {
  data: [
    { id: 3, borrower_id: 7, borrower_name: "Juana Dela Cruz", borrower_code: "MBR-0001", date: "2026-03-10", description: "Partial withdrawal", reference: "SC-0003", debit: 500, credit: 0, created_at: "2026-03-10T02:15:00.000000Z" },
    { id: 2, borrower_id: 7, borrower_name: "Juana Dela Cruz", borrower_code: "MBR-0001", date: "2026-02-15", description: "Monthly contribution", reference: "SC-0002", debit: 0, credit: 1000, created_at: "2026-02-15T01:04:00.000000Z" },
    { id: 1, borrower_id: 7, borrower_name: "Juana Dela Cruz", borrower_code: "MBR-0001", date: "2026-01-15", description: "Monthly contribution", reference: "SC-0001", debit: 0, credit: 1000, created_at: "2026-01-15T01:02:00.000000Z" },
  ],
  links: { first: "…?page=1", last: "…?page=1", prev: null, next: null },
  meta: { current_page: 1, from: 1, last_page: 1, per_page: 100, to: 3, total: 3 },
};

/** One page of a longer ledger — 100 rows because that is the server's cap. */
function truncatedLedgerPage() {
  const data = Array.from({ length: 100 }, (_, i) => ({
    // Newest first, as the controller returns them: id 240 down to 141.
    id: 240 - i,
    borrower_id: 7,
    borrower_name: "Juana Dela Cruz",
    borrower_code: "MBR-0001",
    date: `2026-0${1 + Math.floor(i / 40)}-${String(28 - (i % 28)).padStart(2, "0")}`,
    description: "Monthly contribution",
    reference: `SC-${String(240 - i).padStart(4, "0")}`,
    debit: 0,
    credit: 100,
  }));
  return {
    data,
    meta: { current_page: 1, from: 1, last_page: 3, per_page: 100, to: 100, total: 240 },
  };
}

test("share capital: the certificate states the holding in figures and words", () => {
  const doc = buildShareCapitalCertificateDoc(STATEMENT, { now: NOW });
  assertPrintableShape(doc, "share_capital_certificate");

  assert.equal(titleBlock(doc).text, "Share Capital Certificate");
  assert.equal(titleBlock(doc).subtitle, "Statement of Member's Share Capital");
  assert.equal(doc.incomplete, undefined);
  assert.equal(fieldValue(doc, "Member"), "Juana Dela Cruz");
  assert.equal(fieldValue(doc, "Member No."), "MBR-0001");
  assert.equal(fieldValue(doc, "As of"), formatValue(NOW, "date"));
  assert.equal(fieldValue(doc, "Entries covered"), "3");

  const text = prose(doc);
  assert.match(text, /This is to certify that <strong>Juana Dela Cruz<\/strong>/);
  assert.ok(text.includes(formatCurrency(6500)));
  assert.ok(text.includes(amountInWords(6500)));
  assert.equal(fieldValue(doc, "Balance in words"), amountInWords(6500));
});

test("share capital: the ledger carries a running balance per entry", () => {
  const table = tableBlock(buildShareCapitalCertificateDoc(STATEMENT, { now: NOW }));

  assert.equal(table.rows.length, 3);
  assert.deepEqual(
    table.rows.map((r) => r.balance),
    [6000, 7000, 6500]
  );
  assert.equal(table.rows[2]?.debit, 500);
  assert.equal(table.rows[2]?.credit, 0);
  assert.equal(table.rows[0]?.particulars, "Monthly contribution");
  assert.equal(table.rows[0]?.reference, "SC-0001");
});

test("share capital: closing balance = opening + contributions − withdrawals", () => {
  const doc = buildShareCapitalCertificateDoc(STATEMENT, { now: NOW });

  assert.equal(chargeAmount(doc, "Opening Balance"), formatCurrency(5000));
  assert.equal(chargeAmount(doc, "Add: Contributions"), formatCurrency(2000));
  assert.equal(chargeAmount(doc, "Less: Withdrawals"), `(${formatCurrency(500)})`);
  assert.equal(
    chargeAmount(doc, "CLOSING SHARE CAPITAL BALANCE"),
    formatCurrency(5000 + 2000 - 500)
  );

  // The ledger's last running balance is the closing balance — the two views
  // of the same number must agree or the certificate contradicts its own table.
  const table = tableBlock(doc);
  assert.equal(table.totals?.balance, formatCurrency(6500));
  assert.equal(table.rows[table.rows.length - 1]?.balance, 6500);
});

test("share capital: a newest-first ledger is re-sorted before it is accumulated", () => {
  // The failure this pins: accumulating the controller's descending order from
  // an opening balance of zero gave 500 / 1500 / 2500 reading down the page —
  // a reverse-cumulative in every cell, under a footer total that was still
  // right, so the table looked plausible and no line reconciled.
  const doc = buildShareCapitalCertificateDoc(
    toShareCapitalLedgerFallback(LEDGER_LIST, PRINT_PAGE_SIZE),
    { now: NOW }
  );
  const table = tableBlock(doc);

  assert.deepEqual(
    table.rows.map((r) => r.date),
    ["2026-01-15", "2026-02-15", "2026-03-10"]
  );
  assert.deepEqual(
    table.rows.map((r) => r.balance),
    [1000, 2000, 1500]
  );

  // Every line reconciles with the one above it, and the last one with the
  // footer — which is the only reason a balance column may be printed at all.
  assert.equal(table.rows[table.rows.length - 1]?.balance, 1500);
  assert.equal(table.totals?.balance, formatCurrency(1500));
  assert.equal(
    chargeAmount(doc, "CLOSING SHARE CAPITAL BALANCE"),
    formatCurrency(1500)
  );
});

test("share capital: a whole fallback ledger still certifies", () => {
  const payload = toShareCapitalLedgerFallback(LEDGER_LIST, PRINT_PAGE_SIZE);
  assert.equal(payload.partial_ledger, false);

  const doc = buildShareCapitalCertificateDoc(payload, { now: NOW });
  assert.equal(doc.incomplete, undefined);
  assert.equal(fieldValue(doc, "Member"), "Juana Dela Cruz");
  assert.equal(fieldValue(doc, "Member No."), "MBR-0001");
  assert.equal(chargeAmount(doc, "Opening Balance"), formatCurrency(0));
  assert.match(prose(doc), /This is to certify that/);
  assert.deepEqual(signatureLabels(doc), ["Certified correct by", "Approved by"]);
});

test("share capital: a capped page is detected as partial, by meta or by count", () => {
  // The precise signal, when the paginator's meta survives the API client.
  assert.equal(
    toShareCapitalLedgerFallback(truncatedLedgerPage(), PRINT_PAGE_SIZE)
      .partial_ledger,
    true
  );

  // And the working one, because it usually does not: `api.get()` returns
  // `response.data.data`, so the rows arrive as a bare array with `meta`
  // already discarded. A full page is then assumed to have more behind it.
  const bareFullPage = truncatedLedgerPage().data;
  assert.equal(bareFullPage.length, PRINT_PAGE_SIZE);
  assert.equal(
    toShareCapitalLedgerFallback(bareFullPage, PRINT_PAGE_SIZE).partial_ledger,
    true
  );

  // A short page is whole either way.
  assert.equal(
    toShareCapitalLedgerFallback(LEDGER_LIST.data, PRINT_PAGE_SIZE)
      .partial_ledger,
    false
  );
  // Including an empty one: a member with no entries is a fact, not a failure.
  assert.equal(
    toShareCapitalLedgerFallback([], PRINT_PAGE_SIZE).partial_ledger,
    false
  );
});

test("share capital: a truncated ledger certifies nothing", () => {
  // 240 entries, 100 returned. Every figure derivable from those 100 is a
  // figure about 100 entries, not about the member — so the document stops
  // being a certificate rather than quietly certifying a short balance.
  const doc = buildShareCapitalCertificateDoc(
    toShareCapitalLedgerFallback(truncatedLedgerPage(), PRINT_PAGE_SIZE),
    { now: NOW }
  );
  assertPrintableShape(doc, "share_capital_certificate");

  assert.equal(doc.incomplete, true);
  assert.equal(
    titleBlock(doc).subtitle,
    "PARTIAL LEDGER EXTRACT — NOT A CERTIFICATION OF BALANCE"
  );

  // No certifying clause anywhere in the prose.
  assert.doesNotMatch(prose(doc), /This is to certify/);
  assert.match(prose(doc), /partial extract of the share capital ledger/);
  assert.match(prose(doc), /does <strong>not<\/strong> state the member's paid-up share capital/);
  assert.match(notes(doc), /No balance may be certified from it/);

  // No balance is stated: not as a column, not as a total, not in words.
  const table = tableBlock(doc);
  assert.ok(!table.columns.some((c) => c.key === "balance"));
  assert.equal(table.totals?.balance, undefined);
  assert.ok(!hasChargeLine(doc, "CLOSING SHARE CAPITAL BALANCE"));
  assert.ok(!hasChargeLine(doc, "Opening Balance"));
  assert.throws(() => fieldValue(doc, "Balance in words"));

  // What IS true of the rows shown is still stated, and labelled as such.
  assert.equal(
    chargeAmount(doc, "Contributions (entries shown)"),
    formatCurrency(100 * 100)
  );
  assert.equal(fieldValue(doc, "Ledger coverage"), "Partial — earlier entries not shown");
  assert.match(doc.footerNote ?? "", /not a Share Capital Certificate/);

  // And nobody countersigns it — "Certified correct by" is the signature that
  // would make an extract look like a certificate.
  assert.deepEqual(signatureLabels(doc), ["Prepared by", "Checked by"]);
});

test("share capital: a type/amount entry is read as well as debit/credit", () => {
  // The shape `ShareCapitalLedgerEntry` in src/types/share-capital.ts declares,
  // under the `period` alias for the totals block.
  const doc = buildShareCapitalCertificateDoc(
    {
      data: [
        { id: 1, borrower_name: "Pedro Santos", date: "2026-01-15", description: "Contribution", type: "credit", amount: 1200 },
        { id: 2, borrower_name: "Pedro Santos", date: "2026-02-15", description: "Withdrawal", type: "debit", amount: 200 },
      ],
      period: { credits: 1200, debits: 200 },
    },
    { now: NOW }
  );

  const table = tableBlock(doc);
  assert.deepEqual(
    table.rows.map((r) => [r.credit, r.debit, r.balance]),
    [
      [1200, 0, 1200],
      [0, 200, 1000],
    ]
  );
  assert.equal(
    chargeAmount(doc, "CLOSING SHARE CAPITAL BALANCE"),
    formatCurrency(1000)
  );
});

test("share capital: undated entries sort last instead of poisoning the order", () => {
  const doc = buildShareCapitalCertificateDoc(
    {
      entries: [
        { id: 9, date: null, description: "Unposted adjustment", debit: 0, credit: 50 },
        { id: 2, date: "2026-02-15", description: "Contribution", debit: 0, credit: 1000 },
        { id: 1, date: "2026-01-15", description: "Contribution", debit: 0, credit: 1000 },
      ],
    },
    { now: NOW }
  );

  const table = tableBlock(doc);
  assert.deepEqual(
    table.rows.map((r) => r.date),
    ["2026-01-15", "2026-02-15", null]
  );
  assert.deepEqual(
    table.rows.map((r) => r.balance),
    [1000, 2000, 2050]
  );
});

test("share capital: the certificate is qualified and countersigned", () => {
  const doc = buildShareCapitalCertificateDoc(STATEMENT, { now: NOW });

  assert.match(notes(doc), /Share capital is not a deposit and is not withdrawable on demand/);
  assert.match(notes(doc), /Cooperative Code of the Philippines/);
  assert.deepEqual(signatureLabels(doc), ["Certified correct by", "Approved by"]);
});

test("share capital: an unreadable member record certifies no balance", () => {
  // A certificate ASSERTS. Failing soft printed "certify that _____ holds
  // paid-up share capital of P0.00" over Bookkeeper and Treasurer sign-offs.
  const doc = buildShareCapitalCertificateDoc(null, { now: NOW });
  assertPrintableShape(doc, "share_capital_certificate");

  assert.equal(doc.incomplete, true);
  assert.doesNotMatch(prose(doc), /This is to certify/);
  assert.match(prose(doc), /could not be retrieved when this form/);
  assert.equal(
    titleBlock(doc).subtitle,
    "BLANK FORM — MEMBER RECORD UNAVAILABLE"
  );

  assert.ok(isBlankField(doc, "Member"));
  assert.ok(isBlankField(doc, "Member No."));
  assert.ok(isBlankField(doc, "Balance in words"));
  assert.equal(fieldValue(doc, "Entries covered"), "0");

  const table = tableBlock(doc);
  assert.equal(table.rows.length, 0);
  assert.equal(table.totals, undefined);
  assert.match(table.emptyText ?? "", /could not be retrieved/);

  // Every figure is a rule to be completed by hand, not a zero.
  assert.equal(chargeAmount(doc, "CLOSING SHARE CAPITAL BALANCE"), BLANK_LINE);
  assert.equal(chargeAmount(doc, "Opening Balance"), BLANK_LINE);
  assert.notEqual(
    chargeAmount(doc, "CLOSING SHARE CAPITAL BALANCE"),
    formatCurrency(0)
  );
  assert.deepEqual(signatureLabels(doc), ["Prepared by", "Checked by"]);
});

test("share capital: a member with no entries is certified at zero, not blanked", () => {
  // The statement answered; the member simply has no share capital yet. That
  // is a fact the cooperative can certify, and the distinction from an
  // unreachable endpoint is the whole point of the flag.
  const doc = buildShareCapitalCertificateDoc(
    {
      borrower: { id: 8, borrower_code: "MBR-0002", full_name: "Pedro Santos" },
      opening_balance: 0,
      entries: [],
      totals: { entry_count: 0, credits: 0, debits: 0 },
      closing_balance: 0,
    },
    { now: NOW }
  );

  assert.equal(doc.incomplete, undefined);
  assert.match(prose(doc), /This is to certify that <strong>Pedro Santos<\/strong>/);
  assert.equal(
    chargeAmount(doc, "CLOSING SHARE CAPITAL BALANCE"),
    formatCurrency(0)
  );
  assert.match(
    tableBlock(doc).emptyText ?? "",
    /No share capital entries have been recorded/
  );
});
