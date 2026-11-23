import { test } from "node:test";
import assert from "node:assert/strict";
import type { PublicNotice, PublicPortal, PublicProduct } from "@/types/public-application";
import {
  amountRange,
  consentsFor,
  linkClosure,
  NOT_READY,
  noticesAreDraft,
  noticesToAccept,
  scheduleWords,
  termChoices,
  termRange,
  trackingClosure,
} from "./portal-state";

// The link's state as LO-B2's PublicPortal::present() sends it.

const NOTICE = (version: string, final = false): PublicNotice => ({ version, text: `Text ${version}`, final });

function portal(over: Partial<PublicPortal> = {}): PublicPortal {
  return {
    organization: { name: "Binhs Coop", logo_url: null, contact_phone: null, contact_email: null, address: null },
    accepting: true,
    closed_reason: null,
    welcome_heading: "Apply for a loan with Binhs Coop",
    intro: null,
    eligibility: null,
    estimated_minutes: 15,
    privacy_notice: NOTICE("2026.1"),
    terms: NOTICE("2026.2"),
    credit_authorization: null,
    declaration: NOTICE("2026.3"),
    products: [],
    documents: [],
    branches: [],
    accepted_file_types: ["jpg", "jpeg", "png", "pdf"],
    max_upload_mb: 10,
    otp_channels: ["sms"],
    ...over,
  };
}

function product(over: Partial<PublicProduct> = {}): PublicProduct {
  return {
    id: 7,
    name: "Salary Loan",
    description: null,
    min_amount: 5000,
    max_amount: 50000,
    min_term: 3,
    max_term: 12,
    term_unit: "months",
    payment_frequencies: ["monthly"],
    interest_method: "diminishing",
    interest_rate: 2.5,
    interest_rate_frequency: "monthly",
    eligibility: null,
    instructions: null,
    ...over,
  };
}

test("an open link with a code channel takes applications", () => {
  assert.equal(linkClosure(portal()), null);
});

test("a closed link reads the server's reason", () => {
  const reason = "This application link has expired. Please contact the office.";
  assert.equal(linkClosure(portal({ accepting: false, closed_reason: reason })), reason);
});

test("an empty otp_channels closes the link, whatever accepting says", () => {
  assert.equal(
    linkClosure(portal({ otp_channels: [], accepting: false, closed_reason: "Online applications open once text messages can be sent." })),
    "Online applications open once text messages can be sent.",
  );
  assert.equal(linkClosure(portal({ otp_channels: [] })), NOT_READY);
});

test("a link closed with no reason reads the generic not-ready wording", () => {
  assert.equal(NOT_READY, "Online applications aren't ready yet. Please contact the office.");
  assert.equal(linkClosure(portal({ accepting: false, closed_reason: null })), NOT_READY);
  assert.equal(linkClosure(portal({ accepting: false, closed_reason: "  " })), NOT_READY);
});

test("tracking works on a closed link while a code can still be sent", () => {
  const expired = portal({ accepting: false, closed_reason: "This application link has expired. Please contact the office." });
  assert.equal(trackingClosure(expired), null);
  assert.equal(
    trackingClosure(portal({ accepting: false, otp_channels: [], closed_reason: "Online applications open once text messages can be sent." })),
    "Online applications open once text messages can be sent.",
  );
  assert.equal(trackingClosure(portal({ otp_channels: [] })), NOT_READY);
});

test("the notices read as a draft until every published one is final", () => {
  assert.equal(noticesAreDraft(portal()), true);
  const final = { privacy_notice: NOTICE("1", true), terms: NOTICE("2", true), declaration: NOTICE("3", true) };
  assert.equal(noticesAreDraft(portal(final)), false);
  assert.equal(noticesAreDraft(portal({ ...final, credit_authorization: NOTICE("4") })), true);
});

test("every published notice is accepted at submit, the credit authorization only when published", () => {
  assert.deepEqual(
    noticesToAccept(portal()).map((n) => [n.key, n.label, n.notice.version]),
    [
      ["privacy_notice", "Privacy notice", "2026.1"],
      ["terms", "Terms and conditions", "2026.2"],
      ["declaration", "Declaration", "2026.3"],
    ],
  );
  assert.deepEqual(
    noticesToAccept(portal({ credit_authorization: NOTICE("2026.4") })).map((n) => n.key),
    ["privacy_notice", "terms", "credit_authorization", "declaration"],
  );
});

test("the consents send each current version and the marketing choice", () => {
  assert.deepEqual(consentsFor(portal(), true), {
    privacy_notice_version: "2026.1",
    terms_version: "2026.2",
    declaration_version: "2026.3",
    credit_authorization_version: null,
    marketing_opt_in: true,
  });
  assert.equal(consentsFor(portal({ credit_authorization: NOTICE("2026.4") }), false)?.credit_authorization_version, "2026.4");
});

test("no consents while a required notice is unpublished", () => {
  assert.equal(consentsFor(portal({ terms: null }), false), null);
});

test("a product's amount range reads its own limits in pesos, two decimals", () => {
  assert.equal(amountRange(product()), "₱5,000.00 to ₱50,000.00");
  assert.equal(amountRange(product({ max_amount: null })), "From ₱5,000.00");
  assert.equal(amountRange(product({ min_amount: null })), "Up to ₱50,000.00");
  assert.equal(amountRange(product({ min_amount: null, max_amount: null })), null);
});

test("a product's term range reads its unit", () => {
  assert.equal(termRange(product()), "3 to 12 months");
  assert.equal(termRange(product({ min_term: 30, max_term: 90, term_unit: "days" })), "30 to 90 days");
  assert.equal(termRange(product({ min_term: null })), "Up to 12 months");
  assert.equal(termRange(product({ max_term: null })), "From 3 months");
  assert.equal(termRange(product({ min_term: null, max_term: null })), null);
});

test("a short known term range is a list to pick from; anything else is typed", () => {
  assert.deepEqual(termChoices(product()), [3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  assert.equal(termChoices(product({ max_term: null })), null);
  assert.equal(termChoices(product({ min_term: 1, max_term: 365, term_unit: "days" })), null);
  assert.deepEqual(termChoices(product({ min_term: null, max_term: 3 })), [1, 2, 3]);
});

test("a payment schedule reads in words, never as its key", () => {
  assert.equal(scheduleWords("semi_monthly"), "Semi-Monthly");
  assert.equal(scheduleWords("upon_maturity"), "Upon Maturity");
  assert.equal(scheduleWords("fortnightly_custom"), "Fortnightly custom");
});
