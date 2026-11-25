/**
 * Reminders in the Release dialog after a print (finish run round 4): an
 * insurance premium set after the disclosure statement was printed, or a
 * co-maker added after the promissory note was printed, is missing from the
 * signed paper. The dialog reminds the cashier to print it again after release;
 * it never holds the release.
 *
 * WHAT THIS PROVES: the reminders read only the server's `printed_documents`
 * (when each document was last printed) and each co-maker's `added_at` (when it
 * was linked to the loan); the insurance one shows exactly while a premium is
 * set and the statement was printed; the co-maker one exactly while a co-maker
 * was linked after the note's latest print; times read in Manila
 * (`formatDateTime`); and the dialog shows both without touching Confirm.
 * WHAT IT DOES NOT PROVE: the rendered dialog (no DOM here; its wiring is
 * pinned in its source), or when a document was printed (the server's; backend
 * tests).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { coMakerReprintReminder, insuranceReprintReminder, latestPrint } from "./release-reminders";
import type { ReleasePreviewInsuranceQuery } from "@/services/loan.service";
import type { LoanCoMaker, PrintedDocument } from "@/types/loan";

const DISCLOSURE: PrintedDocument = {
  document: "disclosure",
  label: "Disclosure Statement",
  printed_at: "2026-11-25T00:50:00.000000Z",
};

const NOTE: PrintedDocument = {
  document: "promissory_note",
  label: "Promissory Note",
  printed_at: "2026-11-25T01:10:00.000000Z",
};

const FULL: ReleasePreviewInsuranceQuery = { insurance_premium_percentage: 2, insurance_payment_type: "full" };
const PARTIAL: ReleasePreviewInsuranceQuery = {
  insurance_premium_percentage: 1.5,
  insurance_payment_type: "partial",
  insurance_partial_amount: 0,
};

const ME = 7;
const SOMEONE_ELSE = 9;

const coMaker = (id: number, added_at: string | null | undefined, added_by: number | null = ME): LoanCoMaker => ({
  id,
  full_name: `Co-maker ${id}`,
  added_at,
  added_by,
});

// Linked when the loan was applied for, before anything was printed.
const ON_THE_APPLICATION = coMaker(1, "2026-11-20T03:00:00.000000Z", SOMEONE_ELSE);

const INSURANCE_SENTENCE =
  "The disclosure statement printed on Nov 25, 2026, 08:50 AM doesn't show this insurance premium. " +
  "Print it again after release for the member to sign.";

test("only the server's list says when a document was last printed", () => {
  const loan = { printed_documents: [DISCLOSURE, NOTE] };
  assert.deepEqual(latestPrint(loan, "disclosure"), DISCLOSURE);
  assert.deepEqual(latestPrint(loan, "promissory_note"), NOTE);
  assert.equal(latestPrint({ printed_documents: [NOTE] }, "disclosure"), null);
  assert.equal(latestPrint({ printed_documents: [] }, "disclosure"), null);
  assert.equal(latestPrint({}, "disclosure"), null);
  assert.equal(latestPrint(null, "promissory_note"), null);
  // A time that can't be read is no print to name.
  assert.equal(latestPrint({ printed_documents: [{ ...DISCLOSURE, printed_at: "not a time" }] }, "disclosure"), null);
});

test("insurance: a premium set after the disclosure statement was printed reminds, in Manila time", () => {
  const loan = { printed_documents: [DISCLOSURE, NOTE] };
  assert.equal(insuranceReprintReminder(FULL, loan), INSURANCE_SENTENCE);
  assert.equal(insuranceReprintReminder(PARTIAL, loan), INSURANCE_SENTENCE);
});

test("insurance: no premium set, or no disclosure statement printed, reminds of nothing", () => {
  assert.equal(insuranceReprintReminder(null, { printed_documents: [DISCLOSURE] }), null);
  // Only the promissory note was printed: the statement will show the premium.
  assert.equal(insuranceReprintReminder(FULL, { printed_documents: [NOTE] }), null);
  // Nothing printed, or a loan that isn't approved (the server sends none).
  assert.equal(insuranceReprintReminder(FULL, { printed_documents: [] }), null);
  assert.equal(insuranceReprintReminder(FULL, {}), null);
});

test("co-maker: one the signed-in user added after the note was printed reminds them, in Manila time", () => {
  const loan = {
    printed_documents: [DISCLOSURE, NOTE],
    co_makers: [ON_THE_APPLICATION, coMaker(2, "2026-11-25T02:30:00.000000Z", ME)],
  };
  assert.equal(
    coMakerReprintReminder(loan, ME),
    "The promissory note printed on Nov 25, 2026, 09:10 AM doesn't name the co-maker you added. " +
      "Print it again after release for the member and the co-maker to sign.",
  );
});

test("co-maker: one added since by someone else, or by an unknown user, says so without 'you'", () => {
  const bySomeoneElse = {
    printed_documents: [NOTE],
    co_makers: [coMaker(2, "2026-11-25T02:30:00.000000Z", SOMEONE_ELSE)],
  };
  const expected =
    "The promissory note printed on Nov 25, 2026, 09:10 AM doesn't name the co-maker added since. " +
    "Print it again after release for the member and the co-maker to sign.";
  assert.equal(coMakerReprintReminder(bySomeoneElse, ME), expected);
  assert.equal(coMakerReprintReminder({ ...bySomeoneElse, co_makers: [coMaker(2, "2026-11-25T02:30:00.000000Z", null)] }, ME), expected);
  // Without a signed-in user, nobody is "you".
  assert.equal(coMakerReprintReminder({ ...bySomeoneElse, co_makers: [coMaker(2, "2026-11-25T02:30:00.000000Z", ME)] }, null), expected);
});

test("co-maker: two added since are named together", () => {
  const twoOfMine = {
    printed_documents: [NOTE],
    co_makers: [ON_THE_APPLICATION, coMaker(2, "2026-11-25T02:30:00.000000Z"), coMaker(3, "2026-11-25T02:31:00.000000Z")],
  };
  assert.equal(
    coMakerReprintReminder(twoOfMine, ME),
    "The promissory note printed on Nov 25, 2026, 09:10 AM doesn't name the co-makers you added. " +
      "Print it again after release for the member and the co-makers to sign.",
  );
  const mixed = { ...twoOfMine, co_makers: [coMaker(2, "2026-11-25T02:30:00.000000Z"), coMaker(3, "2026-11-25T02:31:00.000000Z", SOMEONE_ELSE)] };
  assert.equal(
    coMakerReprintReminder(mixed, ME),
    "The promissory note printed on Nov 25, 2026, 09:10 AM doesn't name the co-makers added since. " +
      "Print it again after release for the member and the co-makers to sign.",
  );
});

test("co-maker: every co-maker on the printed note, or no note printed, reminds of nothing", () => {
  // Linked before the note's latest print, or in the same second: on the paper.
  assert.equal(coMakerReprintReminder({ printed_documents: [NOTE], co_makers: [ON_THE_APPLICATION] }, ME), null);
  assert.equal(
    coMakerReprintReminder({ printed_documents: [NOTE], co_makers: [coMaker(2, NOTE.printed_at)] }, ME),
    null,
  );
  // The note printed again after the co-maker was added names them.
  const reprinted = { ...NOTE, printed_at: "2026-11-25T03:00:00.000000Z" };
  assert.equal(
    coMakerReprintReminder({ printed_documents: [reprinted], co_makers: [coMaker(2, "2026-11-25T02:30:00.000000Z")] }, ME),
    null,
  );
  // Only the disclosure statement was printed, or nothing was: the note will name them.
  const added = [coMaker(2, "2026-11-25T02:30:00.000000Z")];
  assert.equal(coMakerReprintReminder({ printed_documents: [DISCLOSURE], co_makers: added }, ME), null);
  assert.equal(coMakerReprintReminder({ printed_documents: [], co_makers: added }, ME), null);
  assert.equal(coMakerReprintReminder({ co_makers: added }, ME), null);
  assert.equal(coMakerReprintReminder(null, ME), null);
  // No co-makers at all.
  assert.equal(coMakerReprintReminder({ printed_documents: [NOTE] }, ME), null);
});

test("co-maker: a link with no time the server sent isn't counted", () => {
  for (const added_at of [null, undefined, "", "not a time"]) {
    assert.equal(coMakerReprintReminder({ printed_documents: [NOTE], co_makers: [coMaker(2, added_at)] }, ME), null);
  }
});

test("the reminders read in words, never as keys", () => {
  const loan = { printed_documents: [DISCLOSURE, NOTE], co_makers: [coMaker(2, "2026-11-25T02:30:00.000000Z")] };
  for (const text of [insuranceReprintReminder(FULL, loan), coMakerReprintReminder(loan, ME)]) {
    assert.ok(text);
    assert.doesNotMatch(text, /promissory_note|printed_at|added_at|_/);
  }
});

test("the Release dialog shows each reminder under its own fields and never holds Confirm for them", () => {
  const page = readFileSync(join(process.cwd(), "src/app/(app)/loans/[id]/page.tsx"), "utf8");

  assert.ok(page.includes("const releaseInsuranceReminder = insuranceReprintReminder(releaseInsurance, loan);"));
  assert.ok(page.includes("const releaseCoMakerReminder = coMakerReprintReminder(loan, currentUser?.id ?? null);"));

  // The co-maker reminder right under the co-makers, the insurance one right
  // under the insurance fields.
  const coMakers = page.indexOf("<ReleaseCoMakers loan={loan} onLoanChange={setLoan} />");
  const coMakerReminder = page.indexOf("<ReleaseReminder text={releaseCoMakerReminder} />");
  const insurance = page.indexOf("<InsurancePremiumSection");
  const insuranceEnd = page.indexOf("/>", insurance);
  const insuranceReminder = page.indexOf("<ReleaseReminder text={releaseInsuranceReminder} />");
  assert.ok(coMakers > -1 && coMakerReminder > coMakers);
  assert.equal(page.slice(page.indexOf("/>", coMakers) + 2, coMakerReminder).trim(), "");
  assert.ok(insurance > -1 && insuranceReminder > insuranceEnd);
  assert.equal(page.slice(insuranceEnd + 2, insuranceReminder).trim(), "");

  // Confirm Release stands on the server's answer and the reference, as before.
  const confirm = page.slice(page.indexOf("const canConfirmRelease ="), page.indexOf("const loanReleaseMethod"));
  assert.ok(confirm.length > 0);
  assert.doesNotMatch(confirm, /Reminder/);
});

test("a reminder is a calm status note, not an alert", () => {
  const source = readFileSync(join(process.cwd(), "src/app/(app)/loans/[id]/_components/release-reminder.tsx"), "utf8");
  assert.match(source, /<Alert role="status"/);
  assert.doesNotMatch(source, /role="alert"|variant="destructive"/);
});
