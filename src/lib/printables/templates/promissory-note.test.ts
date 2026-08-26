import { test } from "node:test";
import assert from "node:assert/strict";
import { formatCurrency } from "@/app/(app)/reports/_lib/formatters";
import { amountInWords } from "../amount-in-words";
import { buildPromissoryNoteDoc } from "./promissory-note";
import {
  allFields,
  assertPrintableShape,
  blocksOfKind,
  fieldValue,
  isBlankField,
  notarialBody,
  notes,
  prose,
  signatureLabels,
  signatures,
  titleBlock,
} from "./doc-assertions";

/** What `PromissoryNoteService::generatePromissoryNote()` actually returns. */
const PAYLOAD = {
  document_title: "PROMISSORY NOTE",
  reference_number: "PN-2026-0042",
  generated_at: "2026-08-26 09:15:00",
  borrower: {
    borrower_code: "MBR-0001",
    full_name: "Juana Dela Cruz",
    address: "12 Mabini St., Poblacion, Cebu City",
    contact_number: "0917-555-0101",
  },
  co_makers: [
    {
      co_maker_code: "CM-0007",
      full_name: "Mario Reyes",
      address: "8 Rizal Ave., Mandaue City",
      relationship_to_borrower: "sibling",
    },
  ],
  loan_terms: {
    application_number: "APP-2026-0042",
    loan_account_number: "LN-2026-0042",
    principal_amount: 100000,
    interest_rate: 2,
    interest_method: "diminishing",
    term: 6,
    frequency: "monthly",
    start_date: "2026-08-01",
    maturity_date: "2027-02-01",
    total_interest: 7000,
    total_obligation: 107000,
    penalty_rate: 3,
    grace_period_days: 3,
  },
  payment_schedule_summary: {
    number_of_installments: 6,
    installment_amount: 18666.67,
    first_due_date: "2026-09-01",
    last_due_date: "2027-02-01",
  },
  branch: { name: "Main Branch", address: "Cebu City", contact_number: "032-555-0100" },
  signatures: {
    borrower_name: "Juana Dela Cruz",
    co_maker_names: ["Mario Reyes"],
    approved_by: "Ana Bautista",
  },
};

test("promissory note: header carries the note's own identity", () => {
  const doc = buildPromissoryNoteDoc(PAYLOAD);
  assertPrintableShape(doc, "promissory_note");

  const title = titleBlock(doc);
  assert.equal(title.text, "Promissory Note");
  assert.equal(title.legalRef, "Act No. 2031 — Negotiable Instruments Law");

  // The API mints the reference; reprinting must not re-mint it.
  assert.equal(doc.reference, "PN-2026-0042");
  assert.equal(fieldValue(doc, "Loan Account No."), "LN-2026-0042");
  assert.equal(fieldValue(doc, "Amount"), formatCurrency(100000));
  assert.equal(fieldValue(doc, "Place"), "Philippines");
});

test("promissory note: the promise to pay states the sum in words and figures", () => {
  const text = prose(buildPromissoryNoteDoc(PAYLOAD));

  assert.match(text, /FOR VALUE RECEIVED, I\/We,/);
  assert.match(text, /jointly and severally promise to pay, without need of demand/);
  assert.match(text, /to the order of the <strong>LENDER<\/strong>, at its principal office/);
  // Words control over figures if the numerals are altered, so both appear.
  assert.ok(text.includes(amountInWords(100000)));
  assert.ok(text.includes(formatCurrency(100000)));
  assert.match(text, /at the rate of <strong><u>2% per month<\/u><\/strong>/);
  assert.match(text, /computed on the basis of <strong><u>Diminishing Balance<\/u><\/strong>/);
});

test("promissory note: the rate promised is the rate the schedule charges", () => {
  // "per month" was written into the operative sentence whatever the loan's
  // frequency was, so a daily loan's Maker promised to pay 1% a month on an
  // instrument they then signed.
  const text = prose(
    buildPromissoryNoteDoc({
      ...PAYLOAD,
      loan_terms: { ...PAYLOAD.loan_terms, interest_rate: 1, frequency: "daily" },
    })
  );

  assert.match(text, /at the rate of <strong><u>1% per day<\/u><\/strong>/);
  assert.doesNotMatch(text, /1% per month/);
});

test("promissory note: the installment clause reads the schedule, not the release date", () => {
  const text = prose(buildPromissoryNoteDoc(PAYLOAD));

  assert.match(text, /to be paid in <strong><u>6<\/u><\/strong> consecutive/);
  assert.match(text, /and every monthly period thereafter/);
  // First due date comes from payment_schedule_summary.first_due_date.
  assert.match(text, /the first installment to be due and payable on <strong><u>Sep 1, 2026<\/u><\/strong>/);
  assert.match(text, /The maturity date of this Note is <strong><u>Feb 1, 2027<\/u><\/strong>/);
});

test("promissory note: all six standard clauses survive word for word", () => {
  const text = prose(buildPromissoryNoteDoc(PAYLOAD));

  assert.match(text, /<strong>1\. DEFAULT \/ PENALTY\.<\/strong>/);
  assert.match(text, /<strong>2\. ACCELERATION\.<\/strong> Time is of the essence of this Note\./);
  assert.match(text, /<strong>3\. ATTORNEY'S FEES AND COSTS OF COLLECTION\.<\/strong>/);
  assert.match(
    text,
    /attorney's fees equivalent to ten percent \(10%\) of the total amount due but not less than Five Thousand Pesos \(PHP 5,000\.00\)/
  );
  assert.match(text, /<strong>4\. VENUE\.<\/strong>/);
  assert.match(text, /<strong>5\. WAIVER\.<\/strong> I\/We hereby waive demand, presentment for payment, notice of non-payment, notice of dishonor, protest, and notice of protest/);
  assert.match(text, /<strong>6\. SEVERABILITY\.<\/strong>/);
  assert.match(text, /IN WITNESS WHEREOF, I\/We have hereunto set my\/our hand\(s\) this/);
});

test("promissory note: the co-maker is bound solidarily and primarily", () => {
  const doc = buildPromissoryNoteDoc(PAYLOAD);
  const text = prose(doc);

  assert.match(text, /I, <strong><u>Mario Reyes<\/u><\/strong>/);
  assert.match(
    text,
    /do hereby bind myself <strong>jointly and severally \(solidarily\)<\/strong> with the above-named Maker\/Borrower/
  );
  // The clause that makes a co-maker worth having.
  assert.match(
    text,
    /as co-maker, I am <strong>primarily liable<\/strong> for the obligation, and the holder may proceed against me directly without first proceeding against the principal Maker\/Borrower or exhausting any security given for the obligation\./
  );

  assert.deepEqual(signatureLabels(doc), [
    "Maker / Borrower",
    "Co-Maker",
    "Witness 1 — Signature Over Printed Name",
    "Witness 2 — Signature Over Printed Name",
  ]);
  assert.equal(signatures(doc)[1]?.name, "Mario Reyes");
});

test("promissory note: without a co-maker the lender signs the second block", () => {
  const doc = buildPromissoryNoteDoc({ ...PAYLOAD, co_makers: [] });

  assert.ok(!prose(doc).includes("primarily liable"));
  assert.deepEqual(signatureLabels(doc), [
    "Maker / Borrower",
    "Lender / Creditor",
    "Witness 1 — Signature Over Printed Name",
    "Witness 2 — Signature Over Printed Name",
  ]);
});

test("promissory note: the notarial block is complete, as plain text", () => {
  const body = notarialBody(buildPromissoryNoteDoc(PAYLOAD));

  // The renderer escapes this block and turns newlines into breaks, so it must
  // carry no markup of its own.
  assert.ok(!body.includes("<"), "notarial body must be plain text");

  assert.match(body, /^ACKNOWLEDGMENT/);
  assert.match(body, /REPUBLIC OF THE PHILIPPINES \)/);
  assert.match(body, /CITY \/ MUNICIPALITY OF _____________ \) S\.S\./);
  assert.match(
    body,
    /BEFORE ME, a Notary Public for and in the above jurisdiction, this _____ day of _______________, 20___, personally appeared the following:/
  );
  assert.match(
    body,
    /known to me and to me known to be the same person\(s\) who executed the foregoing Promissory Note, and acknowledged to me that the same is their free and voluntary act and deed\./
  );
  assert.match(body, /WITNESS MY HAND AND SEAL on the date and place above written\./);
  assert.match(body, /NOTARY PUBLIC/);
  assert.match(body, /PTR No\. _____ \/ IBP No\. _____/);
  assert.match(
    body,
    /Doc\. No\. _____; Page No\. _____; Book No\. _____; Series of 20___\./
  );
  // Both parties appear before the notary, each with their own ID line.
  assert.match(body, /Name: Juana Dela Cruz/);
  assert.match(body, /Name: Mario Reyes/);
  assert.equal(
    body.split("Valid ID / CTC No.:").length - 1,
    2,
    "one ID line per appearing party"
  );
});

test("promissory note: interpolated names are HTML-escaped", () => {
  const doc = buildPromissoryNoteDoc({
    ...PAYLOAD,
    borrower: { full_name: "Ben & Sons <Trading>", address: "A & B St." },
    co_makers: [],
  });

  const text = prose(doc);
  assert.match(text, /Ben &amp; Sons &lt;Trading&gt;/);
  assert.ok(!text.includes("<Trading>"));
  // The notarial block is plain text — the renderer escapes it, so the raw
  // name is what belongs here.
  assert.match(notarialBody(doc), /Name: Ben & Sons <Trading>/);
});

test("promissory note: an unreadable loan is NOT notarisable", () => {
  // The behaviour this replaces: a 429 from the API limiter printed a note
  // reading "Zero Pesos", "0% per month", no Maker and no co-makers, under a
  // complete jurat — while the app toasted "opened in a new tab". A blank
  // release voucher is a form; a blank note carrying a jurat is an incomplete
  // negotiable instrument, and Act No. 2031 s.14 lets its holder fill in the
  // blanks.
  const doc = buildPromissoryNoteDoc(null);
  assertPrintableShape(doc, "promissory_note");

  assert.equal(doc.incomplete, true);

  // No jurat: there is no instrument to acknowledge.
  assert.equal(blocksOfKind(doc, "notarial").length, 0);
  assert.throws(() => notarialBody(doc));
  assert.match(notes(doc), /Do not sign, witness or notarise it/);

  // No figure that could be read as a promise to pay.
  assert.ok(isBlankField(doc, "Amount"));
  assert.notEqual(
    allFields(doc).find((f) => f.label === "Amount")?.value,
    formatCurrency(0)
  );

  const text = prose(doc);
  assert.doesNotMatch(text, /Zero Pesos/);
  assert.doesNotMatch(text, /0% per month/);

  // And it is unmistakable on the page.
  assert.equal(titleBlock(doc).subtitle, "DATA UNAVAILABLE — DO NOT SIGN");
  assert.match(text, /\*\*\* D O &nbsp;N O T &nbsp;S I G N \*\*\*/);
  assert.match(doc.footerNote ?? "", /DO NOT SIGN/);
});

test("promissory note: a real loan is still fully notarisable", () => {
  const doc = buildPromissoryNoteDoc(PAYLOAD);

  assert.equal(doc.incomplete, undefined);
  assert.equal(titleBlock(doc).subtitle, undefined);
  assert.match(notarialBody(doc), /Doc\. No\. _____/);
  assert.doesNotMatch(prose(doc), /D O &nbsp;N O T &nbsp;S I G N/);

  // A loan whose interest really is zero still states it as a figure.
  const free = buildPromissoryNoteDoc({
    ...PAYLOAD,
    loan_terms: { ...PAYLOAD.loan_terms, interest_rate: 0 },
  });
  assert.equal(free.incomplete, undefined);
  assert.match(prose(free), /at the rate of <strong><u>0% per month<\/u><\/strong>/);
});

test("promissory note: the prose still fills unknown parties with rules", () => {
  // A loan that loaded but is missing a co-maker address is a form to
  // complete, not a failure — that distinction is the whole point of the flag.
  const doc = buildPromissoryNoteDoc({
    ...PAYLOAD,
    borrower: { full_name: "Juana Dela Cruz" },
    co_makers: [],
  });

  assert.equal(doc.incomplete, undefined);
  assert.match(prose(doc), /FOR VALUE RECEIVED/);
  assert.match(notarialBody(doc), /Doc\. No\. _____/);
});
