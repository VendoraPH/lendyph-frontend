import { test } from "node:test";
import assert from "node:assert/strict";
import { useBrandingStore } from "@/store/branding-store";
import {
  applyPrintChrome,
  buildPrintableReference,
  resolvePrintableOrg,
} from "./print-chrome";
import type { PrintableDocument } from "./types";

/**
 * Chrome is what turns a built document into an issued one: under whose
 * letterhead, against which reference, stamped when. It is applied after the
 * template runs, so these tests assert the merge rather than any payload
 * mapping.
 */

function baseDoc(): PrintableDocument {
  return {
    id: "official_receipt",
    org: { name: "Binhs Multi-Purpose Cooperative", logoUrl: null },
    title: "Official Receipt",
    generatedAt: "",
    blocks: [{ kind: "note", text: "Received with thanks." }],
  };
}

test("a reference is prefix, issue date, issue time", () => {
  const at = new Date(2026, 7, 26, 1, 42);
  assert.equal(buildPrintableReference("official_receipt", at), "OR-20260826-0142");
});

test("every printable has its own prefix", () => {
  const at = new Date(2026, 7, 26, 1, 42);
  assert.equal(buildPrintableReference("disclosure_statement", at), "DIS-20260826-0142");
  assert.equal(buildPrintableReference("promissory_note", at), "PN-20260826-0142");
  assert.equal(buildPrintableReference("release_voucher", at), "RV-20260826-0142");
  assert.equal(buildPrintableReference("demand_letter", at), "DL-20260826-0142");
  assert.equal(buildPrintableReference("amortization_schedule", at), "AMS-20260826-0142");
  assert.equal(buildPrintableReference("share_capital_certificate", at), "SCC-20260826-0142");
  assert.equal(buildPrintableReference("member_ledger_card", at), "MLC-20260826-0142");
});

test("the reference is stamped from local calendar parts, not UTC", () => {
  // 00:30 on Aug 7 in Manila is still Aug 6 in UTC. Formatting off the ISO
  // string would date a receipt a day early — and the date is half the
  // reference a branch quotes back when the payment is queried.
  const at = new Date(2026, 7, 7, 0, 30);
  assert.equal(buildPrintableReference("official_receipt", at), "OR-20260807-0030");
});

test("chrome fills the reference and the generated stamp", () => {
  const doc = applyPrintChrome(baseDoc(), new Date(2026, 7, 26, 1, 42));

  assert.equal(doc.reference, "OR-20260826-0142");
  assert.match(doc.generatedAt, /2026/);
});

test("an existing reference wins, so a reprint carries its original number", () => {
  const issued: PrintableDocument = {
    ...baseDoc(),
    reference: "OR-2026-000142",
    generatedAt: "Aug 26, 2026, 1:42 AM",
  };
  const reprint = applyPrintChrome(issued, new Date(2027, 0, 1, 9, 0));

  assert.equal(reprint.reference, "OR-2026-000142");
  assert.equal(reprint.generatedAt, "Aug 26, 2026, 1:42 AM");
});

test("applying chrome twice changes nothing the second time", () => {
  const once = applyPrintChrome(baseDoc(), new Date(2026, 7, 26, 1, 42));
  const twice = applyPrintChrome(once, new Date(2027, 0, 1, 9, 0));

  assert.deepEqual(twice, once);
});

test("applying chrome leaves the built document untouched", () => {
  const original = baseDoc();
  applyPrintChrome(original);

  assert.equal(original.reference, undefined);
  assert.equal(original.generatedAt, "");
});

test("the letterhead reads the configured organization", async () => {
  // `loaded: true` short-circuits the store's fetch, so this stays offline.
  useBrandingStore.setState({
    loaded: true,
    loading: false,
    logoUrl: "https://api.example.test/storage/branding/logo.png",
    organizationName: "  Binhs Multi-Purpose Cooperative  ",
    address: "Poblacion, Binhs, Leyte",
    contact: "(053) 555-0100",
  });

  const org = await resolvePrintableOrg();

  assert.equal(org.name, "Binhs Multi-Purpose Cooperative");
  assert.equal(org.logoUrl, "https://api.example.test/storage/branding/logo.png");
  assert.equal(org.address, "Poblacion, Binhs, Leyte");
  assert.equal(org.contact, "(053) 555-0100");
});

test("an unset organization name is left unset, never the product name", async () => {
  useBrandingStore.setState({
    loaded: true,
    loading: false,
    logoUrl: null,
    organizationName: null,
    address: null,
    contact: null,
  });

  const org = await resolvePrintableOrg();

  assert.equal(org.name, null);
  assert.equal(org.logoUrl, null);
  assert.equal(org.address, null);
  assert.equal(org.contact, null);
});

test("a configured logo with no name letterheads as the logo alone", async () => {
  // The shape a deployment is actually in after uploading a logo in branding
  // settings and leaving the organization fields blank. Captioning that logo
  // with the product's name would print `Lendy.PH` on the cooperative's
  // disclosure statement.
  useBrandingStore.setState({
    loaded: true,
    loading: false,
    logoUrl: "https://api.example.test/storage/branding/logo.png",
    organizationName: null,
    address: null,
    contact: null,
  });

  const org = await resolvePrintableOrg();

  assert.equal(org.name, null);
  assert.equal(org.logoUrl, "https://api.example.test/storage/branding/logo.png");
});

test("a whitespace-only organization name is not a name", async () => {
  useBrandingStore.setState({
    loaded: true,
    loading: false,
    organizationName: "   ",
    address: "",
    contact: "   ",
  });

  const org = await resolvePrintableOrg();

  assert.equal(org.name, null);
  assert.equal(org.address, null);
  assert.equal(org.contact, null);
});
