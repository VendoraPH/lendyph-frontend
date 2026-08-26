import { test } from "node:test";
import assert from "node:assert/strict";
import { DASH, formatCurrency } from "@/lib/report-format";
import { renderPrintable } from "./print-render";
import type { PrintBlock, PrintableDocument } from "./types";

/**
 * The renderer is the only thing between a template's data and a document a
 * cooperative hands to a member, so these assert the two properties that
 * actually break in print: that nothing off the wire can become markup, and
 * that every block kind puts something on the page.
 */

function doc(overrides: Partial<PrintableDocument> = {}): PrintableDocument {
  return {
    id: "official_receipt",
    org: { name: "Binhs Multi-Purpose Cooperative", logoUrl: null },
    title: "Official Receipt",
    reference: "OR-20260826-0142",
    generatedAt: "Aug 26, 2026, 1:42 AM",
    blocks: [],
    ...overrides,
  };
}

function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

test("a standalone, printable HTML document comes out", () => {
  const html = renderPrintable(doc({ blocks: [{ kind: "note", text: "Hello" }] }));

  assert.match(html, /^<!DOCTYPE html>/);
  assert.match(html, /<html lang="en">/);
  assert.match(html, /<\/html>$/);
  // The stylesheet travels inside the document — it is opened as a blob with
  // no origin to load one from.
  assert.match(html, /\.charges-table/);
  assert.match(html, /Times New Roman/);
  // The toolbar is the only interactive part, and it never prints.
  assert.match(html, /class="no-print"/);
  assert.match(html, /onclick="window\.print\(\)"/);
  assert.match(html, /onclick="window\.close\(\)"/);
  assert.match(html, /<title>Official Receipt — Binhs Multi-Purpose Cooperative<\/title>/);
});

test("the letterhead carries logo, organization, address, contact and branch", () => {
  const html = renderPrintable(
    doc({
      org: {
        name: "Binhs Multi-Purpose Cooperative",
        logoUrl: "https://api.example.test/storage/logo.png",
        address: "Poblacion, Binhs, Leyte",
        contact: "(053) 555-0100",
        branchLabel: "Main",
      },
    })
  );

  assert.match(html, /class="letterhead"/);
  assert.match(html, /<img class="letterhead-logo" src="https:\/\/api\.example\.test\/storage\/logo\.png"/);
  assert.match(html, /Binhs Multi-Purpose Cooperative/);
  assert.match(html, /Poblacion, Binhs, Leyte/);
  assert.match(html, /\(053\) 555-0100/);
  assert.match(html, /Branch: Main/);
});

test("a deployment with no branding configured prints no empty letterhead", () => {
  const html = renderPrintable(doc({ org: { name: "", logoUrl: null } }));

  assert.equal(count(html, 'class="letterhead"'), 0);
  assert.match(html, /<title>Official Receipt<\/title>/);
});

test("a borrower named <script> is printed, not executed", () => {
  const hostile = "<script>alert('xss')</script>";
  const html = renderPrintable(
    doc({
      org: { name: `Ilaya Farmers & Fisherfolk ${hostile}`, logoUrl: null },
      copies: [hostile, "File Copy"],
      footerNote: hostile,
      blocks: [
        { kind: "fields", items: [{ label: "Borrower", value: hostile }] },
        {
          kind: "table",
          columns: [{ key: "name", header: "Name" }],
          rows: [{ name: hostile }],
          totals: { name: hostile },
        },
        { kind: "charges", lines: [{ label: hostile, amount: hostile }] },
        { kind: "signatures", blocks: [{ label: hostile, name: hostile, detail: hostile }] },
        { kind: "notarial", body: hostile },
        { kind: "note", text: hostile },
        { kind: "heading", text: hostile },
      ],
    })
  );

  assert.equal(count(html, "<script>"), 0);
  assert.equal(count(html, "</script>"), 0);
  assert.equal(count(html, "alert('xss')"), 0);
  assert.match(html, /&lt;script&gt;/);
  // An ampersand in a legitimate organization name is escaped too, so the
  // document is valid HTML rather than merely safe.
  assert.match(html, /Ilaya Farmers &amp; Fisherfolk/);
});

test("a template's own paragraph markup is left intact", () => {
  // The documented exception: `paragraph.html` is authored in this repo, and
  // legal prose is meaningless without <strong>/<u>.
  const html = renderPrintable(
    doc({
      blocks: [
        {
          kind: "paragraph",
          html: "FOR VALUE RECEIVED, I promise to pay <strong><u>Juan Dela Cruz</u></strong>.",
        },
      ],
    })
  );

  assert.match(html, /<strong><u>Juan Dela Cruz<\/u><\/strong>/);
  assert.match(html, /class="para"/);
});

/**
 * Exhaustive by construction: a new `PrintBlock` kind has to be added to both
 * maps below or this file stops compiling, which is the same guarantee
 * `renderBlock`'s `never` branch gives at the call site.
 */
const BLOCK_FIXTURES: Record<PrintBlock["kind"], PrintBlock> = {
  title: {
    kind: "title",
    text: "Promissory Note",
    subtitle: "Negotiable Instrument",
    legalRef: "Act No. 2031",
  },
  heading: { kind: "heading", text: "Terms and Conditions" },
  fields: {
    kind: "fields",
    title: "Borrower Information",
    items: [{ label: "Name of Borrower", value: "Juan Dela Cruz" }],
    columns: 2,
  },
  paragraph: { kind: "paragraph", html: "<em>Acknowledgment of receipt.</em>" },
  table: {
    kind: "table",
    columns: [
      { key: "period", header: "No.", align: "center" },
      { key: "amount_due", header: "Amortization", format: "currency" },
    ],
    rows: [{ period: 1, amount_due: 1500 }],
    totals: { amount_due: formatCurrency(1500) },
  },
  charges: {
    kind: "charges",
    lines: [
      { label: "Processing Fee", amount: formatCurrency(250), indent: true },
      { label: "Net Proceeds", amount: formatCurrency(9750), rule: "grand" },
    ],
  },
  signatures: {
    kind: "signatures",
    blocks: [{ label: "Borrower", name: "Juan Dela Cruz", detail: "Date: ____" }],
  },
  notarial: { kind: "notarial", body: "Doc. No. ____;\nPage No. ____;" },
  note: { kind: "note", text: "Valid only when machine validated." },
  spacer: { kind: "spacer", height: "24pt" },
  page_break: { kind: "page_break" },
};

const BLOCK_MARKERS: Record<PrintBlock["kind"], string> = {
  title: "<h1>Promissory Note</h1>",
  heading: '<div class="section-title">Terms and Conditions</div>',
  fields: 'class="field-grid"',
  paragraph: "<em>Acknowledgment of receipt.</em>",
  table: '<th scope="col">Amortization</th>',
  charges: 'class="grand-total"',
  signatures: 'class="sig-section"',
  notarial: 'class="notarial"',
  note: 'class="note"',
  spacer: 'style="height:24pt"',
  page_break: '<div class="page-break"></div>',
};

test("every block kind puts something on the page", () => {
  for (const [kind, block] of Object.entries(BLOCK_FIXTURES)) {
    const html = renderPrintable(doc({ blocks: [block] }));
    const marker = BLOCK_MARKERS[kind as PrintBlock["kind"]];
    assert.ok(
      html.includes(marker),
      `the ${kind} block rendered nothing matching ${marker}`
    );
  }
});

test("figures are formatted by the report formatters, not re-derived", () => {
  const html = renderPrintable(doc({ blocks: [BLOCK_FIXTURES.table] }));

  // A peso on a receipt has to read exactly as it does on a report.
  assert.match(html, new RegExp(formatCurrency(1500).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(html, /<td class="ctr">1<\/td>/);
  assert.match(html, /<td class="num">/);
});

test("an empty table says so instead of printing a headless grid", () => {
  const html = renderPrintable(
    doc({
      blocks: [
        {
          kind: "table",
          title: "Amortization Schedule",
          columns: [{ key: "period", header: "No." }],
          rows: [],
          emptyText: "No schedule has been generated for this loan.",
        },
      ],
    })
  );

  assert.match(html, /No schedule has been generated for this loan\./);
  assert.equal(count(html, "<table>"), 0);
});

test("a field with nothing to show draws a rule, or a dash when it is not a blank", () => {
  const html = renderPrintable(
    doc({
      blocks: [
        {
          kind: "fields",
          items: [
            { label: "Date Signed", underline: true },
            { label: "Account Officer" },
          ],
        },
      ],
    })
  );

  assert.match(html, /<span class="field-underline">&nbsp;<\/span>/);
  assert.match(html, new RegExp(`<span class="field-value">${DASH}</span>`));
  // The colon belongs to the layout, so templates never write it.
  assert.match(html, /<span class="field-label">Date Signed:<\/span>/);
});

test("a template title block wins over the document title", () => {
  const html = renderPrintable(
    doc({ title: "Promissory Note", blocks: [BLOCK_FIXTURES.title] })
  );

  // One heading, not two: the block carries the subtitle and legal citation.
  assert.equal(count(html, "<h1>"), 1);
  assert.match(html, /Act No\. 2031/);
});

test("a document with no title block heads itself", () => {
  const html = renderPrintable(doc({ blocks: [{ kind: "note", text: "x" }] }));

  assert.equal(count(html, "<h1>"), 1);
  assert.match(html, /<h1>Official Receipt<\/h1>/);
});

test("each copy is a whole document on its own page", () => {
  const html = renderPrintable(
    doc({
      copies: ["Borrower's Copy", "File Copy"],
      blocks: [{ kind: "note", text: "Received with thanks." }],
    })
  );

  // Two bodies, one break between them — not a leading break that would eject
  // a blank first page.
  assert.equal(count(html, '<section class="copy"'), 1);
  assert.equal(count(html, '<section class="copy page-break"'), 1);
  assert.equal(count(html, 'class="letterhead"'), 2);
  assert.equal(count(html, "Received with thanks."), 2);
  assert.equal(count(html, 'class="copy-label"'), 2);
  assert.match(html, /<span>Borrower&#39;s Copy<\/span>/);
  assert.match(html, /<span>File Copy<\/span>/);
});

test("one copy, or none, prints unlabelled", () => {
  const single = renderPrintable(doc({ copies: ["File Copy"] }));
  const none = renderPrintable(doc());

  assert.equal(count(single, 'class="copy-label"'), 0);
  assert.equal(count(single, '<section class="copy"'), 1);
  assert.equal(count(single, "page-break\""), 0);
  assert.equal(count(none, 'class="copy-label"'), 0);
  assert.equal(count(none, '<section class="copy"'), 1);
});

test("the footer carries the reference and the generated stamp", () => {
  const html = renderPrintable(doc({ footerNote: "This is a system-generated receipt." }));

  assert.match(
    html,
    /This is a system-generated receipt\. &bull; Ref: OR-20260826-0142 &bull; Generated: Aug 26, 2026, 1:42 AM/
  );
});

test("a document generated before chrome ran still prints", () => {
  const html = renderPrintable(doc({ reference: null, generatedAt: "" }));

  assert.match(html, /This is a system-generated document\./);
  assert.equal(count(html, "Ref:"), 0);
  assert.equal(count(html, "Generated:"), 0);
});

test("a spacer height that is not a length is ignored rather than injected", () => {
  const html = renderPrintable(
    doc({ blocks: [{ kind: "spacer", height: '10pt" onload="alert(1)' }] })
  );

  assert.equal(count(html, "onload"), 0);
  assert.match(html, /style="height:12pt"/);
});

test("a column width is only honoured when it is a CSS length", () => {
  const html = renderPrintable(
    doc({
      blocks: [
        {
          kind: "table",
          columns: [
            { key: "a", header: "A", width: "12%" },
            { key: "b", header: "B", width: "wide" },
          ],
          rows: [{ a: 1, b: 2 }],
        },
      ],
    })
  );

  assert.match(html, /<th scope="col" style="width:12%">A<\/th>/);
  assert.match(html, /<th scope="col">B<\/th>/);
});

test("three-column sign-offs get their own grid", () => {
  const html = renderPrintable(
    doc({
      blocks: [
        {
          kind: "signatures",
          columns: 3,
          blocks: [
            { label: "Prepared by" },
            { label: "Approved by" },
            { label: "Released by" },
          ],
        },
      ],
    })
  );

  assert.match(html, /class="sig-grid sig-grid-3"/);
  // An unknown signatory still gets a rule to sign on.
  assert.equal(count(html, 'class="sig-line"'), 3);
  assert.equal(count(html, '<div class="sig-name">&nbsp;</div>'), 3);
});
