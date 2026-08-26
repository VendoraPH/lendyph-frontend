import { test } from "node:test";
import assert from "node:assert/strict";
import { siteConfig } from "@/config/site";
import { useBrandingStore } from "@/store/branding-store";
import { applyChrome, buildReference } from "./report-chrome";
import type { ReportDocument } from "./types";

/**
 * Chrome is what turns a data dump into a document: who ran it, under whose
 * logo, against which branch, and under what reference. It is applied after
 * the build, so these tests assert the merge rather than any payload mapping.
 */

// `applyChrome` awaits the branding store, and an unloaded store would try to
// fetch. Marking it loaded up front keeps the file offline; the letterhead
// tests at the bottom override this deliberately and put it back after.
useBrandingStore.setState({ loaded: true, loading: false, organizationName: null });

function baseDoc(): ReportDocument {
  return {
    reportId: "aging_report",
    meta: {
      title: "Aging Report",
      generatedAt: "Aug 6, 2026, 9:15 AM",
      org: "Lendyph — Cooperative Lending",
    },
    sections: [{ kind: "note", text: "Total overdue: ₱451,861.50" }],
  };
}

/**
 * What a builder actually hands to chrome: an empty `org`, because builders are
 * pure and have no branding to read. This is the document the letterhead race
 * damages — `baseDoc()` already carries a name, so the store never gets asked.
 */
function builtDoc(): ReportDocument {
  const doc = baseDoc();
  return { ...doc, meta: { ...doc.meta, org: "" } };
}

test("chrome lands in meta where the preview and every export read it", async () => {
  const doc = await applyChrome(baseDoc(), {
    logoUrl: "https://api.example.test/storage/logo.png",
    logoData: "data:image/png;base64,AAAA",
    preparedBy: "A. Maputol",
    branchLabel: "Main",
    reference: "AGE-20260806-0915",
  });

  assert.equal(doc.meta.logoUrl, "https://api.example.test/storage/logo.png");
  assert.equal(doc.meta.logoData, "data:image/png;base64,AAAA");
  assert.equal(doc.meta.preparedBy, "A. Maputol");
  assert.equal(doc.meta.branchLabel, "Main");
  assert.equal(doc.meta.reference, "AGE-20260806-0915");
});

test("a report generated before the logo is encoded keeps a null logo", async () => {
  // Unlike the organization name, the logo is deliberately not waited for: an
  // unreachable image must not hold up a preview, and the text header stands
  // in for it perfectly well.
  const doc = await applyChrome(baseDoc(), { preparedBy: "A. Maputol" });

  assert.equal(doc.meta.logoUrl, null);
  assert.equal(doc.meta.logoData, null);
  assert.equal(doc.meta.branchLabel, null);
});

test("a reference is minted when the caller supplies none", async () => {
  const doc = await applyChrome(baseDoc(), {});
  assert.match(doc.meta.reference!, /^AGE-\d{8}-\d{4}$/);
});

test("the reference is stamped from local calendar parts, not UTC", () => {
  // 00:30 on Aug 7 in Manila is still Aug 6 in UTC. Formatting off the ISO
  // string would date this report a day early.
  const at = new Date(2026, 7, 7, 0, 30);
  assert.equal(buildReference("statement_of_account", at), "SOA-20260807-0030");
});

test("every report id has its own reference prefix", () => {
  const at = new Date(2026, 7, 6, 9, 15);
  assert.equal(buildReference("daily_collection", at), "DCR-20260806-0915");
  assert.equal(buildReference("subsidiary_ledger", at), "SLG-20260806-0915");
});

test("the sign-off block closes the document", async () => {
  const doc = await applyChrome(baseDoc(), {});
  const last = doc.sections[doc.sections.length - 1];

  assert.equal(last.kind, "signatures");
  assert.deepEqual(
    last.kind === "signatures" ? last.roles : [],
    ["Prepared by", "Checked by", "Approved by"]
  );
});

test("regenerating does not stack a second sign-off block", async () => {
  const once = await applyChrome(baseDoc(), {});
  const twice = await applyChrome(once, {});

  assert.equal(twice.sections.filter((s) => s.kind === "signatures").length, 1);
});

test("applying chrome leaves the built document untouched", async () => {
  const original = baseDoc();
  await applyChrome(original, { preparedBy: "A. Maputol" });

  assert.equal(original.sections.length, 1);
  assert.equal(original.meta.preparedBy, undefined);
});

// ---------------------------------------------------------------------------
// The letterhead race
//
// `meta.org` is written once and never re-read from the store: the preview,
// the PDF, the Word file, the Excel sheet and the CSV all quote the string
// that was stamped at generate time. So resolving it a beat too early does not
// show the wrong name for a moment — it freezes the wrong name into the
// document and every export of it. Hitting Generate on a cold page load, before
// the branding fetch answers, used to be exactly that beat.
// ---------------------------------------------------------------------------

/** Replaces the store with a cold one whose `load()` answers with `name`. */
function coldStore(name: string | null) {
  const restore = useBrandingStore.getState();
  let loads = 0;
  useBrandingStore.setState({
    loaded: false,
    loading: true,
    organizationName: null,
    load: async () => {
      loads += 1;
      // A real timer, not a resolved promise: this has to model a request that
      // is genuinely still out when Generate is clicked, so that reading the
      // store one microtask early still fails the test.
      await new Promise((resolve) => setTimeout(resolve, 5));
      useBrandingStore.setState({
        organizationName: name,
        loaded: true,
        loading: false,
      });
    },
  });
  return { loadCount: () => loads, restore: () => useBrandingStore.setState(restore) };
}

test("a report generated before branding answers waits for the real name", async () => {
  const store = coldStore("  Binhs Multi-Purpose Cooperative  ");
  try {
    const doc = await applyChrome(builtDoc(), { preparedBy: "A. Maputol" });

    // The regression, stated as plainly as it can be: this deployment has a
    // name, so the product's name must never reach its letterhead.
    assert.notEqual(doc.meta.org, siteConfig.name);
    assert.equal(doc.meta.org, "Binhs Multi-Purpose Cooperative");
    // Waited on the store's shared fetch rather than starting its own.
    assert.equal(store.loadCount(), 1);
  } finally {
    store.restore();
  }
});

test("the fallback is only stamped once branding has actually answered", async () => {
  // Nothing configured — now `Lendy.PH` is the true answer, not a race, and a
  // headed document beats a blank line.
  const store = coldStore(null);
  try {
    const doc = await applyChrome(builtDoc(), {});
    assert.equal(doc.meta.org, siteConfig.name);
  } finally {
    store.restore();
  }
});

test("a name the caller passes wins over the one branding holds", async () => {
  // Chrome's own org is the first candidate, so whatever the store answers with
  // is irrelevant — and the caller's value is trimmed like any other.
  const store = coldStore("Ignored Cooperative");
  try {
    const doc = await applyChrome(builtDoc(), { org: "  Binhs MPC  " });
    assert.equal(doc.meta.org, "Binhs MPC");
  } finally {
    store.restore();
  }
});
