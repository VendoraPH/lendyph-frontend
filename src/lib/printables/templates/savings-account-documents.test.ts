/**
 * The four documents printed from a savings account, each rendered from a
 * fixture shaped like the catalog's payload (`{account, member, product,
 * settings, quote, closing}`), and from nothing (a failed read).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderPrintable } from "../print-render";
import {
  allFields,
  assertPrintableShape,
  chargeAmount,
  fieldValue,
  isBlankField,
  notes,
  prose,
  signatureLabels,
  titleBlock,
} from "./doc-assertions";
import { buildSavingsAgreementDoc, rateLines } from "./savings-agreement";
import { buildSavingsClosureFormDoc } from "./savings-closure-form";
import { buildSavingsDormancyNoticeDoc } from "./savings-dormancy-notice";
import { buildSavingsOpeningFormDoc } from "./savings-opening-form";

const ORG = { name: "Binhs Multi-Purpose Cooperative", logoUrl: null };

const ACCOUNT = {
  id: 9,
  account_number: "SAV-2026-00009",
  borrower_id: 7,
  borrower_name: "Juana Dela Cruz",
  borrower_code: "MBR-0001",
  branch_id: 1,
  branch_name: "Main",
  product: { id: 1, code: "RS", name: "Regular Savings", kind: "regular" },
  status: "active",
  balance: "4600.00",
  opened_on: "2026-09-01",
  last_member_activity_on: "2026-10-31",
  dormant_since: null,
  closed_on: null,
  close_reason: null,
  account_officer: { id: 4, name: "Kim Cruz" },
  source_of_funds: "other",
  source_of_funds_label: "Other: Rental income",
  beneficiary: { name: "Pedro Dela Cruz", relationship: "Son", contact_number: null },
};

const MEMBER = {
  id: 7,
  full_name: "Juana Dela Cruz",
  borrower_code: "MBR-0001",
  birthdate: "1980-04-02",
  contact_number: "09171234567",
  email: "juana@example.test",
  address: "12 Rizal St, Quezon City",
};

const PRODUCT = {
  id: 1,
  name: "Regular Savings",
  kind: "regular",
  interest_crediting: "quarterly",
  minimum_opening_balance: "500.00",
  maintaining_balance: "300.00",
  minimum_adb_for_interest: "1000.00",
  max_balance: null,
  min_deposit: "100.00",
  max_deposit: null,
  min_withdrawal: null,
  max_withdrawal: "50000.00",
  free_withdrawals_per_month: 2,
  excess_withdrawal_fee: "15.00",
  allow_deposits: true,
  allow_withdrawals: true,
  current_rates: [
    { annual_rate: "2.0000", term_days: null, effective_from: "2026-01-01", min_balance: null },
    { annual_rate: "2.1250", term_days: null, effective_from: "2026-01-01", min_balance: "50000.00" },
  ],
};

const SETTINGS = { dormancy_months: 24, current_tax_rates: { member: "0.0000", non_member: "20.0000" } };

// ── Opening form ──

test("the opening form prints the account, the depositor from the member record, and the beneficiary", () => {
  const doc = buildSavingsOpeningFormDoc({ account: ACCOUNT, member: MEMBER, product: PRODUCT }, { org: ORG });
  assertPrintableShape(doc, "savings_opening_form");
  assert.equal(titleBlock(doc).subtitle, "Account No. SAV-2026-00009");
  assert.equal(fieldValue(doc, "Account officer"), "Kim Cruz");
  assert.equal(fieldValue(doc, "Source of funds"), "Other: Rental income");
  assert.equal(fieldValue(doc, "Address"), "12 Rizal St, Quezon City");
  assert.equal(fieldValue(doc, "Birthdate"), "Apr 2, 1980");
  assert.equal(fieldValue(doc, "Relationship"), "Son");
  assert.equal(fieldValue(doc, "Minimum opening balance"), "₱500.00");
  // A contact the server withheld prints as a line to fill in.
  assert.equal(allFields(doc).filter((f) => f.label === "Contact number" && f.underline).length, 1);
  assert.match(renderPrintable(doc), /Juana Dela Cruz/);
});

test("without the member record, the personal details are left to fill in", () => {
  const doc = buildSavingsOpeningFormDoc({ account: ACCOUNT, member: null, product: null });
  assert.equal(fieldValue(doc, "Name"), "Juana Dela Cruz");
  assert.ok(isBlankField(doc, "Address"));
  assert.ok(isBlankField(doc, "Birthdate"));
  assert.ok(isBlankField(doc, "Email"));
});

test("an opening form whose account couldn't be read is a blank form", () => {
  const doc = buildSavingsOpeningFormDoc(null);
  assertPrintableShape(doc, "savings_opening_form");
  assert.ok(isBlankField(doc, "Account No."));
  assert.deepEqual(signatureLabels(doc), ["Depositor", "Account officer", "Approved by"]);
});

// ── Agreement ──

test("the agreement states the product's terms from the server, rates unrounded", () => {
  const doc = buildSavingsAgreementDoc({ account: ACCOUNT, product: PRODUCT, settings: SETTINGS }, { org: ORG });
  assertPrintableShape(doc, "savings_agreement");
  const text = prose(doc);
  assert.match(text, /Binhs Multi-Purpose Cooperative/);
  assert.match(text, /Any balance: 2% per annum; ₱50,000.00 and up: 2.125% per annum/);
  assert.match(text, /credited quarterly/);
  assert.match(text, /below ₱1,000.00 earns no interest/);
  assert.match(text, /maintaining balance of ₱300.00/);
  assert.match(text, /2 withdrawals are free each calendar month; each further withdrawal is charged a fee of ₱15.00/);
  assert.match(text, /for 24 months becomes dormant/);
  assert.match(text, /for members it is currently 0%/);
  assert.match(text, /Depositor/);
  assert.doesNotMatch(text, /\$/);
});

test("a product that refuses withdrawals beyond the free count says so", () => {
  const doc = buildSavingsAgreementDoc({ account: ACCOUNT, product: { ...PRODUCT, excess_withdrawal_fee: null }, settings: SETTINGS });
  assert.match(prose(doc), /further withdrawals in the month are refused/);
});

test("rate lines read each tier in words", () => {
  assert.deepEqual(rateLines(PRODUCT), ["Any balance: 2% per annum", "₱50,000.00 and up: 2.125% per annum"]);
  assert.deepEqual(rateLines(null), []);
});

test("an agreement with nothing read still prints its terms and signature lines", () => {
  const doc = buildSavingsAgreementDoc(null);
  assertPrintableShape(doc, "savings_agreement");
  assert.match(prose(doc), /the rate the Cooperative sets/);
});

// ── Closure form ──

test("an open account's closure form prints the server's quote and anything stopping it", () => {
  const doc = buildSavingsClosureFormDoc({
    account: ACCOUNT,
    quote: {
      balance: "4600.00",
      accrued_interest: "12.34",
      withholding_tax: "0.00",
      payout_amount: "4612.34",
      can_close: false,
      blockers: ["A hold of ₱100.00 is still active."],
    },
  });
  assertPrintableShape(doc, "savings_closure_form");
  assert.equal(chargeAmount(doc, "AMOUNT TO BE PAID OUT"), "₱4,612.34");
  assert.equal(chargeAmount(doc, "Add: Interest earned to date"), "₱12.34");
  assert.match(notes(doc), /can't be closed yet: A hold of ₱100.00 is still active./);
  assert.ok(isBlankField(doc, "Reason for closing"));
});

test("without a quote the closing figures are blank lines, not ₱0.00", () => {
  const doc = buildSavingsClosureFormDoc({ account: ACCOUNT, quote: null });
  assert.equal(chargeAmount(doc, "AMOUNT TO BE PAID OUT"), "_______________");
  assert.match(notes(doc), /worked out by the system/);
});

test("a closed account's form prints the closing date, reason and payout row", () => {
  const doc = buildSavingsClosureFormDoc({
    account: { ...ACCOUNT, status: "closed", closed_on: "2026-11-10", close_reason: "Moving abroad" },
    closing: { reference: "SVT-77", debit: "4612.34" },
  });
  assert.equal(titleBlock(doc).subtitle, "ACCOUNT CLOSED");
  assert.equal(fieldValue(doc, "Reason"), "Moving abroad");
  assert.equal(fieldValue(doc, "Status"), "Closed");
  assert.equal(chargeAmount(doc, "AMOUNT PAID OUT"), "₱4,612.34");
});

// ── Dormancy notice ──

test("a dormant account's notice says since when and how to reactivate", () => {
  const doc = buildSavingsDormancyNoticeDoc({
    account: { ...ACCOUNT, status: "dormant", dormant_since: "2026-10-31", last_member_activity_on: "2024-10-31" },
    settings: SETTINGS,
  });
  assertPrintableShape(doc, "savings_dormancy_notice");
  assert.equal(titleBlock(doc).subtitle, "Notice of Dormant Account");
  const text = prose(doc);
  assert.match(text, /since <strong><u>Oct 31, 2024<\/u><\/strong>/);
  assert.match(text, /for 24 months is classified dormant/);
  assert.match(text, /dormant since <strong><u>Oct 31, 2026<\/u><\/strong>/);
  assert.match(text, /Main branch/);
  assert.equal(chargeAmount(doc, "BALANCE TODAY"), "₱4,600.00");
  assert.equal(doc.incomplete, undefined);
});

test("an active account's notice is a reminder and works out no date", () => {
  const doc = buildSavingsDormancyNoticeDoc({ account: ACCOUNT, settings: SETTINGS });
  assert.equal(titleBlock(doc).subtitle, "Reminder Before Dormancy");
  assert.match(prose(doc), /was on <strong><u>Oct 31, 2026<\/u><\/strong>/);
  assert.doesNotMatch(prose(doc), /dormant since/);
});

test("a dormancy notice whose account couldn't be read is blank and says so", () => {
  const doc = buildSavingsDormancyNoticeDoc(null);
  assert.equal(doc.incomplete, true);
  assert.equal(chargeAmount(doc, "BALANCE TODAY"), "_______________");
});

test("names from the server are escaped in the prose", () => {
  const doc = buildSavingsDormancyNoticeDoc({ account: { ...ACCOUNT, borrower_name: "<b>Ana</b>" }, settings: SETTINGS });
  assert.doesNotMatch(renderPrintable(doc), /<b>Ana<\/b>/);
});
