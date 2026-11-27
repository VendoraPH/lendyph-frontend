/** The class of the copy of a report that only the printer sees. */
export const REPORT_PRINT_CLASS = "report-print-sheet";

/**
 * Print used to print one page of the app screen: menu, date filters and
 * buttons, cut off at the Balance Summary. These rules exist only while a report
 * is on the page, so no other screen's printing changes.
 *
 * Everything but the sheet is taken out of the page rather than hidden, because
 * the app shell's fixed-height scrolling containers are what clipped it to one
 * page. A short block (cards, particulars) keeps its heading with it rather than
 * leaving the heading alone at a page's foot. A `tfoot` is a row group here because browsers otherwise repeat it on
 * every page, which makes a grand total read like a subtotal.
 */
export const REPORT_PRINT_CSS = `
.${REPORT_PRINT_CLASS} { display: none; }
@media print {
  @page { size: A4 landscape; margin: 10mm; }
  html, body { height: auto !important; min-height: 0 !important; overflow: visible !important; background: #fff !important; }
  body > :not(.${REPORT_PRINT_CLASS}) { display: none !important; }
  .${REPORT_PRINT_CLASS} { display: block; width: 100%; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  .${REPORT_PRINT_CLASS} .overflow-hidden, .${REPORT_PRINT_CLASS} .overflow-x-auto { overflow: visible !important; }
  .${REPORT_PRINT_CLASS} table { width: 100%; font-size: 8pt; }
  .${REPORT_PRINT_CLASS} th { white-space: normal !important; min-width: 0 !important; }
  .${REPORT_PRINT_CLASS} th, .${REPORT_PRINT_CLASS} td { padding: 2px 4px !important; }
  .${REPORT_PRINT_CLASS} thead { display: table-header-group; }
  .${REPORT_PRINT_CLASS} tfoot { display: table-row-group; }
  .${REPORT_PRINT_CLASS} tr, .${REPORT_PRINT_CLASS} dl > div, .${REPORT_PRINT_CLASS} [data-signatures] { break-inside: avoid; }
  .${REPORT_PRINT_CLASS} [data-keep-together] { break-inside: avoid; }
  .${REPORT_PRINT_CLASS} h3 { break-after: avoid; }
}
`;
