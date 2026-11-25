/**
 * Reprint after a change (finish run round 3, R.A. 3765): the loan page's
 * notice, the Release button's reason and the release refusal, in words.
 *
 * WHAT THIS PROVES: the page reads only the server's
 * `printed_documents_outdated`; one or both documents are named with when each
 * was printed (Manila time, `formatDateTime`); Release is held with a reason
 * only while the list isn't empty; a release refused on `documents` gives the
 * server's sentence, and the page is wired to all of it.
 * WHAT IT DOES NOT PROVE: which documents are out of date (the server decides;
 * backend tests), or the rendered page (no DOM here; its wiring is pinned in
 * its source).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DOCUMENTS_REFUSAL_FALLBACK,
  outdatedPrints,
  releaseBlockedReason,
  releaseDocumentsRefusal,
  releaseReadyState,
  releaseStepInstruction,
  reprintNotice,
  waitingForReleasePhrase,
  waitingForReprintLine,
} from "./reprint-notice";
import type { PrintedDocumentOutdated } from "@/types/loan";

const DISCLOSURE: PrintedDocumentOutdated = {
  document: "disclosure",
  label: "Disclosure Statement",
  printed_at: "2026-11-25T02:04:00.000000Z",
};

const NOTE: PrintedDocumentOutdated = {
  document: "promissory_note",
  label: "Promissory Note",
  printed_at: "2026-11-24T07:15:00.000000Z",
};

const SENTENCE =
  "The loan's terms changed after the disclosure statement was printed on November 25, 2026. Print it again and have the member sign the new copy before releasing.";

const refused = (status: number, errors?: Record<string, unknown>) => ({
  response: { status, data: { message: "refused", errors } },
});

test("only the server's list is read, and a missing one reads as nothing out of date", () => {
  assert.deepEqual(outdatedPrints({ printed_documents_outdated: [DISCLOSURE] }), [DISCLOSURE]);
  assert.deepEqual(outdatedPrints({ printed_documents_outdated: [] }), []);
  assert.deepEqual(outdatedPrints({}), []);
  assert.deepEqual(outdatedPrints(null), []);
});

test("nothing out of date: no notice, and Release isn't held", () => {
  assert.equal(reprintNotice([]), null);
  assert.equal(releaseBlockedReason([]), null);
});

test("one document: the notice names it with when it was printed, in Manila time", () => {
  assert.equal(
    reprintNotice([DISCLOSURE]),
    "The loan's terms changed after the Disclosure Statement was printed (Nov 25, 2026, 10:04 AM). " +
      "Print it again and have the member sign the new copy before release.",
  );
  assert.equal(
    releaseBlockedReason([DISCLOSURE]),
    "Print the Disclosure Statement again before release: the loan's terms changed after it was printed.",
  );
});

test("both documents are named in one notice, each with its own print time", () => {
  assert.equal(
    reprintNotice([DISCLOSURE, NOTE]),
    "The loan's terms changed after the Disclosure Statement (Nov 25, 2026, 10:04 AM) and the " +
      "Promissory Note (Nov 24, 2026, 03:15 PM) were printed. Print them again and have the member " +
      "sign the new copies before release.",
  );
  assert.equal(
    releaseBlockedReason([DISCLOSURE, NOTE]),
    "Print the Disclosure Statement and the Promissory Note again before release: the loan's terms " +
      "changed after they were printed.",
  );
});

test("a document sent without a label still reads in words, never as its key", () => {
  const notice = reprintNotice([{ ...NOTE, label: "" }]) ?? "";
  assert.match(notice, /after the Promissory Note was printed/);
  assert.doesNotMatch(notice, /promissory_note/);
  assert.match(releaseBlockedReason([{ ...DISCLOSURE, label: " " }]) ?? "", /^Print the Disclosure Statement again/);
});

test("a release refused on documents gives the server's sentence; any other answer gives nothing", () => {
  assert.equal(releaseDocumentsRefusal(refused(422, { documents: [SENTENCE] })), SENTENCE);
  // Refused on documents with no sentence to show: still words.
  assert.equal(releaseDocumentsRefusal(refused(422, { documents: [] })), DOCUMENTS_REFUSAL_FALLBACK);
  assert.equal(releaseDocumentsRefusal(refused(422, { documents: ["documents_outdated"] })), DOCUMENTS_REFUSAL_FALLBACK);
  assert.equal(releaseDocumentsRefusal(refused(422, { principal_amount: ["The source loan was paid down."] })), null);
  assert.equal(releaseDocumentsRefusal(refused(409, { documents: [SENTENCE] })), null);
  assert.equal(releaseDocumentsRefusal(refused(422)), null);
  assert.equal(releaseDocumentsRefusal(new Error("Network Error")), null);
  assert.equal(releaseDocumentsRefusal(null), null);
});

test("once every approver has signed off, the line waits on the reprint exactly while Release is held", () => {
  assert.equal(releaseReadyState(false, []), null);
  assert.equal(releaseReadyState(false, [DISCLOSURE]), null);
  assert.equal(releaseReadyState(true, []), "ready");
  assert.equal(releaseReadyState(true, [NOTE]), "waiting_for_reprint");

  for (const items of [[], [DISCLOSURE], [NOTE], [DISCLOSURE, NOTE]]) {
    assert.equal(releaseReadyState(true, items) === "waiting_for_reprint", releaseBlockedReason(items) !== null);
  }

  assert.equal(waitingForReprintLine([]), null);
  assert.equal(
    waitingForReprintLine([DISCLOSURE]),
    "All approvers have signed off. The release waits until the Disclosure Statement is printed again and the member signs the new copy.",
  );
  assert.equal(
    waitingForReprintLine([DISCLOSURE, NOTE]),
    "All approvers have signed off. The release waits until the Disclosure Statement and the Promissory Note are printed " +
      "again and the member signs the new copies.",
  );
});

test("the release step's line and the waiting line say the release waits exactly while it is held", () => {
  assert.equal(releaseStepInstruction([]), "open the release dialog to complete the loan release.");
  assert.equal(
    releaseStepInstruction([DISCLOSURE]),
    "the release waits until the Disclosure Statement is printed again and the member signs the new copy.",
  );
  assert.equal(
    releaseStepInstruction([DISCLOSURE, NOTE]),
    "the release waits until the Disclosure Statement and the Promissory Note are printed again and the member " +
      "signs the new copies.",
  );
  assert.equal(waitingForReleasePhrase([]), "to release the loan");
  assert.equal(
    waitingForReleasePhrase([NOTE]),
    "to release the loan once the Promissory Note is printed again and the member signs the new copy",
  );

  // One rule: each says the release waits exactly while the button is held.
  for (const items of [[], [DISCLOSURE], [NOTE], [DISCLOSURE, NOTE]]) {
    const held = releaseBlockedReason(items) !== null;
    assert.equal(releaseStepInstruction(items).startsWith("the release waits"), held);
    assert.equal(waitingForReleasePhrase(items) !== "to release the loan", held);
    assert.equal(releaseReadyState(true, items) === "waiting_for_reprint", held);
  }
});

test("no line on the approval card invites the release while it is held", () => {
  const page = readFileSync(join(process.cwd(), "src/app/(app)/loans/[id]/page.tsx"), "utf8");
  assert.ok(page.includes('{currentStep.kind === "release" && ` — ${releaseStepInstruction(outdatedDocuments)}`}'));
  assert.doesNotMatch(page, /open the release dialog to complete the loan release/);
  assert.ok(page.includes("? waitingForReleasePhrase(outdatedDocuments)"));
  assert.doesNotMatch(page, /\? "to release the loan"/);
});

test("the approval card shows the ready line or the waiting line, never both", () => {
  const page = readFileSync(join(process.cwd(), "src/app/(app)/loans/[id]/page.tsx"), "utf8");
  assert.ok(page.includes("const releaseReady = releaseReadyState(readyForRelease(loan.status, allStepsApproved), outdatedDocuments);"));
  const ready = page.indexOf("All approvers have signed off. The loan is ready for release.");
  assert.ok(ready > -1);
  assert.match(page.slice(ready - 500, ready), /\{releaseReady === "ready" && \(/);
  assert.ok(page.includes('{releaseReady === "waiting_for_reprint" && ('));
  assert.ok(page.includes("{waitingForReprintLine(outdatedDocuments)}"));
});

test("the loan page shows the notice, holds Release with the reason, reads the loan again on return, and says a refusal", () => {
  const page = readFileSync(join(process.cwd(), "src/app/(app)/loans/[id]/page.tsx"), "utf8");

  assert.ok(page.includes("const outdatedDocuments = outdatedPrints(loan);"));
  assert.ok(page.includes("const reprintNoticeText = reprintNotice(outdatedDocuments);"));
  assert.ok(page.includes("{reprintNoticeText !== null && ("));

  // The Release button sits in the house disabled-with-reason wrapper, off while held.
  const start = page.indexOf("{currentStep.kind === \"release\" && (");
  const release = page.slice(start, page.indexOf("Release Loan", start));
  assert.ok(start > -1 && release.length > 0);
  assert.match(release, /<DisabledReason reason=\{releaseHeldReason\}/);
  assert.match(release, /disabled=\{stepActionLoading \|\| !clientCanActOnCurrentStep \|\| releaseHeldReason !== null\}/);

  // Read again only while a document is out of date, and only on a return.
  assert.ok(page.includes("useRereadOnReturn(outdatedPrints(loan).length > 0, rereadLoan);"));
  assert.doesNotMatch(page, /setInterval\([^)]*reread/i);

  // A refusal on documents says the server's sentence and reads the loan again.
  assert.ok(page.includes("const documentsRefusal = releaseDocumentsRefusal(err);"));
  assert.ok(page.includes("toast.error(documentsRefusal);"));
});
