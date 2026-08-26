/**
 * The stylesheet every printable is rendered with.
 *
 * Lifted from `BASE_STYLES` in `loan-document-templates.ts`, which is already
 * tuned for the output that matters here: Times New Roman 11pt on a
 * bond-paper-ish margin, an `@media print` block that tightens the padding and
 * hides the toolbar, and the `.doc-header` / `.field-row` / `.section-title` /
 * `.charges-table` / `.sig-*` rules the disclosure statement and promissory
 * note are built out of. Those rules are reproduced unchanged so the two ported
 * documents come off the printer looking exactly as they do today.
 *
 * Everything below the "── Engine additions ──" marker is new, and exists only
 * because the block union covers ground the two hand-written documents never
 * did: a letterhead (no legal document had one), multi-copy labelling, prose
 * paragraphs and a notarial box as first-class blocks rather than inline
 * `style=` attributes.
 *
 * One stylesheet for all eight documents is the point. A template emits blocks
 * and never a byte of CSS, so nothing can drift into a per-document look.
 */
export const PRINT_STYLES = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: "Times New Roman", Times, serif;
    font-size: 11pt;
    line-height: 1.5;
    color: #000;
    background: #fff;
    padding: 0.6in 0.8in;
  }
  @media print {
    body { padding: 0.4in 0.6in; }
    .no-print { display: none !important; }
    .page-break { page-break-before: always; }
  }
  .no-print {
    position: fixed; top: 12px; right: 12px; z-index: 100;
    display: flex; gap: 8px;
  }
  .no-print button {
    padding: 8px 20px; border: 1px solid #ccc; border-radius: 6px;
    cursor: pointer; font-size: 10pt; font-family: sans-serif; background: #fff;
  }
  .no-print button:first-child { background: #f97316; color: #fff; border-color: #f97316; }

  .doc-header { text-align: center; margin-bottom: 20pt; }
  .doc-header h1 { font-size: 14pt; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 2pt; }
  .doc-header .subtitle { font-size: 9pt; margin-bottom: 6pt; }
  .doc-header .legal-ref { font-size: 8.5pt; font-style: italic; color: #444; }

  .field-row { display: flex; gap: 12pt; margin-bottom: 3pt; font-size: 10.5pt; }
  .field-label { min-width: 160pt; color: #333; }
  .field-value { font-weight: bold; flex: 1; }
  .field-underline { border-bottom: 1px solid #000; flex: 1; min-width: 120pt; font-weight: bold; }

  .section { margin-bottom: 14pt; }
  .section-title {
    font-size: 10pt; font-weight: bold; text-transform: uppercase;
    background: #f0f0f0; border: 1px solid #ccc;
    padding: 4pt 8pt; margin-bottom: 8pt; letter-spacing: 0.5px;
  }

  table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
  th {
    background: #e8e8e8; border: 1px solid #999;
    padding: 4pt 6pt; text-align: center;
    font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.3px;
  }
  td { border: 1px solid #bbb; padding: 3pt 6pt; }
  td.num { text-align: right; font-family: "Courier New", monospace; font-size: 9pt; }
  td.ctr { text-align: center; }
  tfoot td { border-top: 2px solid #000; font-weight: bold; background: #f5f5f5; }

  .charges-table { width: 100%; font-size: 10.5pt; border-collapse: collapse; }
  .charges-table td { padding: 3pt 0; border: none; }
  .charges-table .amt { text-align: right; width: 140pt; }
  .charges-table .total-row td { border-top: 1px solid #000; font-weight: bold; padding-top: 6pt; }
  .charges-table .grand-total td { border-top: 2px double #000; font-weight: bold; font-size: 11pt; padding-top: 8pt; }

  .sig-section { margin-top: 40pt; page-break-inside: avoid; }
  .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40pt; }
  .sig-block { text-align: center; }
  .sig-line { border-bottom: 1px solid #000; height: 32pt; margin-bottom: 2pt; }
  .sig-name { font-weight: bold; font-size: 10.5pt; }
  .sig-label { font-size: 8pt; color: #555; text-transform: uppercase; letter-spacing: 0.5px; }
  .sig-detail { font-size: 8pt; color: #666; margin-top: 1pt; }

  .legal-text { font-size: 10pt; line-height: 1.6; text-align: justify; margin-top: 10pt; }
  .legal-text p { margin-bottom: 8pt; text-indent: 24pt; }
  .legal-text ol { margin-left: 24pt; margin-bottom: 8pt; }
  .legal-text ol li { margin-bottom: 4pt; }

  .clause-title { font-weight: bold; font-size: 10pt; margin-top: 10pt; margin-bottom: 4pt; }

  .footer {
    margin-top: 24pt; text-align: center;
    font-size: 7.5pt; color: #999;
    border-top: 1px solid #ddd; padding-top: 6pt;
  }

  /* ── Engine additions ── */

  /* Letterhead. Logo and organization sit on one centred row so the block
     collapses gracefully: no logo leaves the name centred on its own, and a
     missing address or contact simply removes a line. */
  .letterhead {
    display: flex; align-items: center; justify-content: center; gap: 14pt;
    text-align: center;
    border-bottom: 2px solid #000; padding-bottom: 8pt; margin-bottom: 14pt;
  }
  .letterhead-logo { max-height: 54pt; max-width: 100pt; object-fit: contain; }
  .letterhead-name { font-size: 13pt; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
  .letterhead-meta { font-size: 8.5pt; color: #333; line-height: 1.35; }

  /* Corner label for a multi-copy document ("Borrower's Copy" / "File Copy").
     A boxed, right-aligned label rather than a positioned one: absolutely
     positioned chrome is what makes print engines disagree about which page it
     belongs to. */
  .copy-label { text-align: right; margin-bottom: 4pt; }
  .copy-label span {
    display: inline-block; border: 1px solid #000; padding: 1pt 8pt;
    font-family: sans-serif; font-size: 7.5pt; font-weight: bold;
    text-transform: uppercase; letter-spacing: 1px;
  }
  /* On screen the copies scroll continuously, so they need a visible seam;
     on paper the page break is the seam and the rule would be noise. */
  .copy + .copy { margin-top: 28pt; border-top: 1px dashed #ccc; padding-top: 28pt; }
  @media print { .copy + .copy { margin-top: 0; border-top: none; padding-top: 0; } }

  /* Prose. Justified and first-line indented to match the promissory note's
     body; an explicitly aligned paragraph drops the indent, since a centred
     line that is also indented reads as misaligned. */
  .para { font-size: 10.5pt; line-height: 1.6; text-align: justify; text-indent: 24pt; margin-bottom: 8pt; }
  .para-left { text-align: left; text-indent: 0; }
  .para-center { text-align: center; text-indent: 0; }
  .para-right { text-align: right; text-indent: 0; }
  .para ol, .para ul { margin-left: 36pt; margin-bottom: 8pt; text-indent: 0; }
  .para li { margin-bottom: 4pt; }

  /* Jurat / acknowledgment. Boxed and kept whole — a notarial block split
     across two pages is not something a notary will sign. */
  .notarial {
    margin-top: 32pt; border: 1px solid #ccc; padding: 16pt;
    font-size: 9pt; line-height: 1.6; page-break-inside: avoid;
  }

  .note { font-size: 8.5pt; color: #444; font-style: italic; margin: 8pt 0; }
  .empty-text { font-size: 9.5pt; color: #666; font-style: italic; padding: 6pt 0; }

  /* Two-up field grid for the "fields" block's columns: 2 option. */
  .field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2pt 20pt; }
  .field-grid .field-label { min-width: 120pt; }

  .sig-grid-3 { grid-template-columns: 1fr 1fr 1fr; gap: 24pt; }

  /* A schedule long enough to paginate must carry its header onto every page,
     otherwise page two is an unlabelled wall of figures. Keeping rows whole
     stops a line splitting across the fold. */
  thead { display: table-header-group; }
  tbody tr { page-break-inside: avoid; }
  /* ...but the totals row must NOT repeat. Chrome treats a tfoot as a running
     footer by default, which printed the grand total at the foot of every page
     of a 12-month schedule, where it reads as a per-page subtotal. Flowing it
     as an ordinary row group puts it once, at the end, where it belongs. */
  tfoot { display: table-row-group; }
`;
