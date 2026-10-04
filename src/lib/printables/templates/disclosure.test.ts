import { test } from "node:test";
import assert from "node:assert/strict";
import { DASH, formatCurrency, formatValue } from "@/lib/report-format";
import { buildDisclosureDoc } from "./disclosure";
import {
  allFields,
  assertPrintableShape,
  blocksOfKind,
  chargeAmount,
  chargesBlock,
  fieldValue,
  hasChargeLine,
  isBlankField,
  prose,
  signatureLabels,
  tableBlock,
  titleBlock,
} from "./doc-assertions";

/**
 * Contract test. The payload below is what
 * `DisclosureService::generateDisclosure()` actually returns — nested under
 * `borrower` / `loan_terms` / `deductions` / `totals`, plus the R.A. 3765
 * classification of round 3 (`finance_charges`, `non_finance_charges`,
 * `proceeds`, `rates`) — so a renamed key fails here instead of printing a
 * blank statutory disclosure for a member.
 */
const PAYLOAD = {
  document_title: "DISCLOSURE STATEMENT",
  reference_number: "APP-2026-0042",
  generated_at: "2026-08-26 09:15:00",
  borrower: {
    borrower_code: "MBR-0001",
    full_name: "Juana Dela Cruz",
    address: "12 Mabini St., Poblacion, Cebu City",
    contact_number: "0917-555-0101",
  },
  loan_terms: {
    application_number: "APP-2026-0042",
    loan_account_number: "LN-2026-0042",
    loan_product_name: "Regular Loan",
    principal_amount: 100000,
    interest_rate: 2,
    interest_method: "diminishing",
    term: 6,
    frequency: "monthly",
    penalty_rate: 3,
    grace_period_days: 3,
    start_date: "2026-08-01",
    maturity_date: "2027-02-01",
  },
  deductions: {
    items: [
      { name: "Processing Fee", amount: 2000, type: "percentage", original_value: 2 },
      { name: "Service Fee", amount: 1000, type: "percentage", original_value: 1 },
      { name: "Notarial Fee", amount: 500, type: "fixed", original_value: 500 },
      { name: "Insurance Premium", amount: 400, type: "fixed", original_value: 400 },
      { name: "Share Capital", amount: 1000, type: "fixed", original_value: 1000 },
    ],
    total_deductions: 4900,
    net_proceeds: 95100,
  },
  // The server's totals for the whole six-period schedule: deliberately not
  // the three rows below added up, so a test can tell the two apart.
  totals: {
    total_principal: 100000,
    total_interest: 7000,
    total_obligation: 107000,
    total_amortization: 107000,
    total_deductions: 4900,
    net_proceeds: 95100,
    // Interest and the coop's own fees only: 7,000 + 2,000 + 1,000.
    total_finance_charges: 10000,
    total_non_finance_charges: 1100,
    unitemised_deductions: 0,
  },
  finance_charges: {
    interest: 7000,
    items: [
      { name: "Processing Fee", amount: 2000 },
      { name: "Service Fee", amount: 1000 },
    ],
    total: 10000,
  },
  non_finance_charges: {
    items: [
      { name: "Notarial Fee", amount: 500, deducted: 500, owed: 0 },
      // ₱600 premium: ₱400 collected at release, ₱200 owed on the loan.
      { name: "Insurance Premium", amount: 600, deducted: 400, owed: 200 },
    ],
    total: 1100,
  },
  proceeds: {
    principal: 100000,
    finance_charges_deducted: 3000,
    non_finance_charges_deducted: 900,
    share_capital: 1000,
    net_proceeds: 95100,
  },
  rates: {
    contractual_rate: 2,
    rate_frequency: "monthly",
    nominal_annual_rate: 24,
    effective_rate_monthly: 2.3456,
    effective_rate_annual: 28.1472,
  },
  amortization_schedule: [
    { period_number: 1, due_date: "2026-09-01", principal_due: 16666.67, interest_due: 2000, total_due: 18666.67, remaining_balance: 83333.33 },
    { period_number: 2, due_date: "2026-10-01", principal_due: 16666.67, interest_due: 1666.67, total_due: 18333.34, remaining_balance: 66666.66 },
    { period_number: 3, due_date: "2026-11-01", principal_due: 16666.66, interest_due: 1333.33, total_due: 17999.99, remaining_balance: 50000 },
  ],
  co_makers: [],
};

const NET_PROCEEDS_LABEL = "4. Net Proceeds of Loan (Amount Received by Borrower)";
const SHARE_CAPITAL_LABEL = "Less: Share Capital (deducted from proceeds; not a charge)";

test("disclosure: a full payload produces the seven statutory sections", () => {
  const doc = buildDisclosureDoc(PAYLOAD);
  assertPrintableShape(doc, "disclosure_statement");

  const title = titleBlock(doc);
  assert.equal(title.text, "Disclosure Statement");
  assert.equal(title.subtitle, "on Loan / Credit Transaction");
  assert.match(title.legalRef ?? "", /Republic Act No\. 3765/);
  assert.match(title.legalRef ?? "", /BSP Circular No\. 730/);

  assert.deepEqual(
    doc.blocks.flatMap((b) => (b.kind !== "title" && "title" in b && b.title ? [b.title] : [])),
    [
      "I. Borrower & Loan Information",
      "II. Amount of Credit / Loan",
      "III. Finance Charges",
      "IV. Non-Finance Charges",
      "V. Net Proceeds",
      "VI. Rate Information",
      "VII. Amortization Schedule",
    ]
  );

  assert.equal(fieldValue(doc, "Name of Borrower"), "Juana Dela Cruz");
  assert.equal(fieldValue(doc, "Loan Account No."), "LN-2026-0042");
  assert.equal(fieldValue(doc, "Term of Loan"), "6 month(s)");
  assert.equal(fieldValue(doc, "Mode of Payment"), "Monthly");
  assert.equal(fieldValue(doc, "Contractual Interest Rate"), "2% per month");
  assert.equal(fieldValue(doc, "Nominal Annual Rate"), "24.00% per annum");
  assert.equal(fieldValue(doc, "Effective Interest Rate (Monthly)"), "2.3456% per month");
  assert.equal(fieldValue(doc, "Effective Interest Rate (Per Annum)"), "28.1472% per annum");
  assert.equal(fieldValue(doc, "Total Amount Payable"), formatCurrency(107000));
  // Formatted, not the raw "2026-08-01" the API sent.
  assert.equal(
    fieldValue(doc, "Date Granted"),
    formatValue(new Date(2026, 7, 1), "date")
  );
});

test("disclosure: the nominal annual rate is the server's, never annualised here", () => {
  // A 2%-a-month loan whose server figure is not 2 × 12: printed as sent.
  const doc = buildDisclosureDoc({
    ...PAYLOAD,
    rates: { ...PAYLOAD.rates, nominal_annual_rate: 36 },
  });
  assert.equal(fieldValue(doc, "Contractual Interest Rate"), "2% per month");
  assert.equal(fieldValue(doc, "Nominal Annual Rate"), "36.00% per annum");

  // A 1%-a-day rate: 365% nominal as the server states it, not a fixed × 12.
  const daily = buildDisclosureDoc({
    ...PAYLOAD,
    loan_terms: {
      ...PAYLOAD.loan_terms,
      interest_rate: 1,
      interest_rate_frequency: "daily",
      term: 30,
      term_unit: "days",
      frequency: "daily",
    },
    rates: { ...PAYLOAD.rates, contractual_rate: 1, rate_frequency: "daily", nominal_annual_rate: 365 },
  });
  assert.equal(fieldValue(daily, "Contractual Interest Rate"), "1% per day");
  assert.equal(fieldValue(daily, "Nominal Annual Rate"), "365.00% per annum");
  assert.equal(fieldValue(daily, "Term of Loan"), "30 day(s)");
  assert.equal(fieldValue(daily, "Mode of Payment"), "Daily");
});

test("disclosure: without the server's rates, no annual or effective rate is worked out", () => {
  // The loan terms alone (2% a month) used to be multiplied by 12 here.
  const { rates: _omitted, ...withoutRates } = PAYLOAD;
  void _omitted;
  const doc = buildDisclosureDoc(withoutRates);
  assert.equal(fieldValue(doc, "Contractual Interest Rate"), "2% per month");
  assert.equal(fieldValue(doc, "Nominal Annual Rate"), DASH);
  assert.equal(fieldValue(doc, "Effective Interest Rate (Monthly)"), DASH);
  assert.equal(fieldValue(doc, "Effective Interest Rate (Per Annum)"), DASH);
});

test("disclosure: a rate the server could not state is a dash", () => {
  // An unknown period (nominal) and an effective rate that could not be solved.
  const doc = buildDisclosureDoc({
    ...PAYLOAD,
    rates: {
      ...PAYLOAD.rates,
      nominal_annual_rate: null,
      effective_rate_monthly: null,
      effective_rate_annual: null,
    },
  });
  assert.equal(fieldValue(doc, "Nominal Annual Rate"), DASH);
  assert.equal(fieldValue(doc, "Effective Interest Rate (Monthly)"), DASH);
  assert.equal(fieldValue(doc, "Effective Interest Rate (Per Annum)"), DASH);
});

test("disclosure: every rate frequency is quoted in its own words", () => {
  const expected = [
    ["daily", "2% per day"],
    ["weekly", "2% per week"],
    ["bi_weekly", "2% per bi-weekly period"],
    ["semi_monthly", "2% per semi-monthly period"],
    ["monthly", "2% per month"],
    ["quarterly", "2% per period"],
  ] as const;

  for (const [rateFrequency, rate] of expected) {
    const doc = buildDisclosureDoc({
      ...PAYLOAD,
      rates: { ...PAYLOAD.rates, rate_frequency: rateFrequency },
    });
    assert.equal(fieldValue(doc, "Contractual Interest Rate"), rate, rateFrequency);
    // The annual figure stays the server's whatever the period.
    assert.equal(fieldValue(doc, "Nominal Annual Rate"), "24.00% per annum", rateFrequency);
    // `term` is labelled by its `term_unit`: 6 months on every row.
    assert.equal(fieldValue(doc, "Term of Loan"), "6 month(s)", rateFrequency);
  }
});

test("disclosure: fractional rates are disclosed exactly, as the API sends them", () => {
  // `decimal:4` arrives as a padded string. Rates are stated without the
  // padding and without rounding.
  const doc = buildDisclosureDoc({
    ...PAYLOAD,
    rates: {
      ...PAYLOAD.rates,
      contractual_rate: "1.1234",
      nominal_annual_rate: "13.4808",
      effective_rate_monthly: 1.5,
      effective_rate_annual: 18,
    },
  });
  assert.equal(fieldValue(doc, "Contractual Interest Rate"), "1.1234% per month");
  assert.equal(fieldValue(doc, "Nominal Annual Rate"), "13.4808% per annum");
  assert.equal(fieldValue(doc, "Effective Interest Rate (Monthly)"), "1.50% per month");
  assert.equal(fieldValue(doc, "Effective Interest Rate (Per Annum)"), "18.00% per annum");
});

test("disclosure: without a rate frequency the contractual rate is quoted per month", () => {
  // The backend's default, and what every rate before the field meant — even
  // on a daily loan.
  const { rate_frequency: _omitted, ...ratesWithoutFrequency } = PAYLOAD.rates;
  void _omitted;
  const doc = buildDisclosureDoc({
    ...PAYLOAD,
    loan_terms: { ...PAYLOAD.loan_terms, frequency: "daily" },
    rates: ratesWithoutFrequency,
  });
  assert.equal(fieldValue(doc, "Contractual Interest Rate"), "2% per month");
});

test("disclosure: finance charges are interest and the coop's own fees, as the server classifies them", () => {
  const doc = buildDisclosureDoc(PAYLOAD);
  const finance = chargesBlock(doc, "III. Finance Charges").lines.map((l) => [l.label, l.amount]);

  assert.deepEqual(finance, [
    ["a. Interest", formatCurrency(7000)],
    ["b. Processing Fee", formatCurrency(2000)],
    ["c. Service Fee", formatCurrency(1000)],
    ["2. Total Finance Charges", formatCurrency(10000)],
  ]);
  // Notarial fee, insurance and share capital are not finance charges.
  assert.ok(!finance.some(([label]) => /Notarial|Insurance|Share Capital/.test(label)));
});

test("disclosure: the server's Other Charges and Adjustment lines are lettered as sent", () => {
  const doc = buildDisclosureDoc({
    ...PAYLOAD,
    finance_charges: {
      ...PAYLOAD.finance_charges,
      items: [
        ...PAYLOAD.finance_charges.items,
        { name: "Other Charges", amount: 1500 },
        { name: "Adjustment", amount: -500 },
      ],
    },
  });
  assert.equal(chargeAmount(doc, "d. Other Charges"), formatCurrency(1500));
  assert.equal(chargeAmount(doc, "e. Adjustment"), formatCurrency(-500));
});

test("disclosure: the browser adds no line of its own for unitemised deductions", () => {
  // The server folds `unitemised_deductions` into its classified items.
  const doc = buildDisclosureDoc({
    ...PAYLOAD,
    totals: { ...PAYLOAD.totals, unitemised_deductions: 1500 },
  });
  assert.ok(
    !chargesBlock(doc, "III. Finance Charges").lines.some((l) => /Other Charges|Adjustment/.test(l.label))
  );
});

test("disclosure: non-finance charges have their own section and the server's total", () => {
  const doc = buildDisclosureDoc(PAYLOAD);
  const lines = chargesBlock(doc, "IV. Non-Finance Charges").lines;
  const last = lines[lines.length - 1];

  assert.equal(chargeAmount(doc, "a. Notarial Fee"), formatCurrency(500));
  // The full premium, not the part collected at release.
  assert.equal(chargeAmount(doc, "b. Insurance Premium"), formatCurrency(600));
  assert.deepEqual([last.label, last.amount], ["3. Total Non-Finance Charges", formatCurrency(1100)]);
});

test("disclosure: insurance unpaid at release is owed on the loan, interest-free, collected first", () => {
  const doc = buildDisclosureDoc(PAYLOAD);
  const lines = chargesBlock(doc, "IV. Non-Finance Charges").lines;
  const note = lines[lines.findIndex((l) => l.label === "b. Insurance Premium") + 1];

  assert.match(note.label, /₱200\.00/);
  assert.match(note.label, /owed on the loan/);
  assert.match(note.label, /interest-free/);
  assert.match(note.label, /collected first/);
  // A note, not a figure in the column: the column adds up to the total.
  assert.equal(note.amount, "");

  const paid = buildDisclosureDoc({
    ...PAYLOAD,
    non_finance_charges: {
      items: [{ name: "Insurance Premium", amount: 600, deducted: 600, owed: 0 }],
      total: 600,
    },
  });
  assert.ok(
    !chargesBlock(paid, "IV. Non-Finance Charges").lines.some((l) => /owed on the loan/.test(l.label))
  );
});

test("disclosure: net proceeds reconcile from the server's proceeds", () => {
  const doc = buildDisclosureDoc(PAYLOAD);

  assert.deepEqual(
    chargesBlock(doc, "V. Net Proceeds").lines.map((l) => [l.label, l.amount]),
    [
      ["Principal Loan Amount", formatCurrency(100000)],
      ["Less: Finance Charges Deducted", `(${formatCurrency(3000)})`],
      ["Less: Non-Finance Charges Deducted", `(${formatCurrency(900)})`],
      [SHARE_CAPITAL_LABEL, `(${formatCurrency(1000)})`],
      [NET_PROCEEDS_LABEL, formatCurrency(95100)],
    ]
  );
});

test("disclosure: finance charges and net proceeds are printed as the server sent them", () => {
  const sent = buildDisclosureDoc({
    ...PAYLOAD,
    totals: { ...PAYLOAD.totals, total_finance_charges: 10499.99 },
    proceeds: { ...PAYLOAD.proceeds, net_proceeds: 95099.99 },
  });
  assert.equal(chargeAmount(sent, "2. Total Finance Charges"), formatCurrency(10499.99));
  assert.equal(chargeAmount(sent, NET_PROCEEDS_LABEL), formatCurrency(95099.99));
});

test("disclosure: a total the server did not send is a dash, never worked out", () => {
  const {
    finance_charges: _finance,
    non_finance_charges: _nonFinance,
    proceeds: _proceeds,
    rates: _rates,
    ...bare
  } = PAYLOAD;
  void [_finance, _nonFinance, _proceeds, _rates];
  const doc = buildDisclosureDoc({
    ...bare,
    deductions: { items: PAYLOAD.deductions.items },
    totals: {},
  });

  assert.equal(chargeAmount(doc, "a. Interest"), DASH);
  assert.equal(chargeAmount(doc, "2. Total Finance Charges"), DASH);
  assert.equal(chargeAmount(doc, "3. Total Non-Finance Charges"), DASH);
  assert.equal(chargeAmount(doc, "Principal Loan Amount"), DASH);
  assert.equal(chargeAmount(doc, "Less: Finance Charges Deducted"), DASH);
  assert.equal(chargeAmount(doc, "Less: Non-Finance Charges Deducted"), DASH);
  assert.equal(chargeAmount(doc, SHARE_CAPITAL_LABEL), DASH);
  assert.equal(chargeAmount(doc, NET_PROCEEDS_LABEL), DASH);
  // The deductions list is not reclassified here.
  assert.ok(!hasChargeLine(doc, "b. Processing Fee"));
  const table = tableBlock(doc, "VII. Amortization Schedule");
  assert.equal(table.totals?.principal, DASH);
  assert.equal(table.totals?.interest, DASH);
  assert.equal(table.totals?.amount_due, DASH);
});

test("disclosure: co-makers and the borrower's address are deliberately absent", () => {
  // A decision, pinned so it cannot drift into an accident. The API sends both
  // and this form omits both: R.A. 3765 discloses the cost of credit to the
  // BORROWER, and a co-maker's solidary undertaking is disclosed, signed and
  // notarised on the Promissory Note instead — which does carry every one of
  // them. Revisit as a form-design change, not as a bug fix.
  const doc = buildDisclosureDoc({
    ...PAYLOAD,
    borrower: { ...PAYLOAD.borrower, address: "12 Mabini St., Poblacion, Cebu City" },
    co_makers: [
      { full_name: "Pedro Santos", address: "8 Lapu-Lapu St., Cebu City" },
      { full_name: "Maria Reyes", address: "3 Osmena Blvd., Cebu City" },
    ],
  });

  assert.ok(!allFields(doc).some((f) => f.label === "Address"));
  assert.doesNotMatch(prose(doc), /Pedro Santos|Maria Reyes|Mabini/);
  // Two signatories, both of them parties to the credit transaction itself.
  assert.deepEqual(signatureLabels(doc), [
    "Borrower — Signature Over Printed Name",
    "Creditor / Lending Company",
  ]);
});

test("disclosure: the schedule table carries the server's column totals", () => {
  const doc = buildDisclosureDoc(PAYLOAD);
  const table = tableBlock(doc, "VII. Amortization Schedule");

  assert.equal(table.rows.length, 3);
  // Six columns, six keys per row — the old markup declared seven headers for
  // six cells, which shifted every figure one column left.
  assert.equal(table.columns.length, 6);
  // `totals.total_principal`, `total_interest` and `total_amortization`, not
  // the three rows shown added up.
  assert.equal(table.totals?.principal, formatCurrency(100000));
  assert.equal(table.totals?.interest, formatCurrency(7000));
  assert.equal(table.totals?.amount_due, formatCurrency(107000));
});

test("disclosure: a long schedule breaks to its own page", () => {
  const short = buildDisclosureDoc(PAYLOAD);
  assert.equal(blocksOfKind(short, "page_break").length, 0);

  const long = buildDisclosureDoc({
    ...PAYLOAD,
    amortization_schedule: Array.from({ length: 24 }, (_, i) => ({
      period_number: i + 1,
      due_date: "2026-09-01",
      principal_due: 1000,
      interest_due: 100,
      total_due: 1100,
      remaining_balance: 1000 * (24 - i),
    })),
  });
  assert.equal(blocksOfKind(long, "page_break").length, 1);
});

test("disclosure: the R.A. 3765 acknowledgment survives word for word", () => {
  const text = prose(buildDisclosureDoc(PAYLOAD));

  assert.match(
    text,
    /I\/We acknowledge receipt of this Disclosure Statement <em>prior to the consummation<\/em> of the above credit\/loan transaction\./
  );
  assert.match(
    text,
    /I\/We have read and fully understood all the terms and conditions stated herein, including the finance charges, interest rate, penalties, and other charges\./
  );
  assert.match(
    text,
    /issued in compliance with <strong>Republic Act No\. 3765<\/strong>/
  );
  assert.match(
    text,
    /as amended by <strong>BSP Circular No\. 730, Series of 2011<\/strong>/
  );
});

test("disclosure: a null payload still prints a signable blank form", () => {
  const doc = buildDisclosureDoc(null);
  assertPrintableShape(doc, "disclosure_statement");

  // Blanks are rules to be filled in by hand, not dashes.
  assert.ok(isBlankField(doc, "Name of Borrower"));
  assert.ok(isBlankField(doc, "Loan Account No."));
  assert.ok(isBlankField(doc, "Date Granted"));

  // No figures were sent, so none is printed — a dash, never a ₱0.00 the
  // server did not state — but the statutory acknowledgment and sign-off must
  // be on the page regardless.
  assert.equal(chargeAmount(doc, "1. Principal Loan Amount"), DASH);
  assert.equal(chargeAmount(doc, "2. Total Finance Charges"), DASH);
  assert.ok(hasChargeLine(doc, "2. Total Finance Charges"));
  assert.equal(chargeAmount(doc, "3. Total Non-Finance Charges"), DASH);
  assert.equal(chargeAmount(doc, NET_PROCEEDS_LABEL), DASH);
  assert.match(prose(doc), /Truth in Lending Act/);
  assert.deepEqual(signatureLabels(doc), [
    "Borrower — Signature Over Printed Name",
    "Creditor / Lending Company",
  ]);

  // No schedule table at all, rather than an empty one claiming there is none.
  assert.equal(blocksOfKind(doc, "table").length, 0);
});

test("disclosure: the legacy flat payload still renders", () => {
  // The shape `LoanDisclosure` in src/types/loan-document.ts once described.
  const doc = buildDisclosureDoc({
    loan_id: 42,
    application_number: "APP-2026-0042",
    borrower_name: "Pedro Santos",
    principal_amount: 50000,
    interest_rate: 3,
    interest_type: "fixed",
    term_months: 12,
    payment_frequency: "bi_weekly",
    processing_fee: 1000,
    service_fee: 500,
    other_deductions: 0,
    net_proceeds: 48500,
    total_payable: 56000,
    amortization_schedule: [
      { period: 1, due_date: "2026-09-01", principal: 4166.67, interest: 1500, amount_due: 5666.67, balance: 45833.33 },
    ],
  });

  assert.equal(fieldValue(doc, "Name of Borrower"), "Pedro Santos");
  assert.equal(fieldValue(doc, "Term of Loan"), "12 month(s)");
  assert.equal(fieldValue(doc, "Mode of Payment"), "Bi weekly");
  // No totals block: interest is a dash, never total payable less principal.
  assert.equal(chargeAmount(doc, "a. Interest"), DASH);
  assert.equal(fieldValue(doc, "Total Amount Payable"), formatCurrency(56000));
  // Its flat fees were never classified by the server, so they are not
  // printed as finance charges, and no net proceeds is reconciled from them.
  assert.ok(!hasChargeLine(doc, "b. Processing / Service Fee"));
  assert.equal(chargeAmount(doc, NET_PROCEEDS_LABEL), DASH);
  assert.equal(tableBlock(doc, "VII. Amortization Schedule").rows.length, 1);
});
