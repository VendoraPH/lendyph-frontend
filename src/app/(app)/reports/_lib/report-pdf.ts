import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { saveAs } from "file-saver";
import { todayISO } from "@/lib/format";
import { formatCell } from "@/lib/report-format";
import type { ReportDocument, ReportSection } from "./types";

// Match the on-screen preview palette so the PDF feels like the same
// document. RGB tuples for jsPDF.
const BRAND_ORANGE: [number, number, number] = [234, 106, 34];
const BRAND_ORANGE_SOFT: [number, number, number] = [255, 241, 229];
const TABLE_HEADER_BG: [number, number, number] = [243, 244, 246];
const TOTAL_ROW_BG: [number, number, number] = [255, 247, 237];
const MUTED: [number, number, number] = [107, 114, 128];
const FOREGROUND: [number, number, number] = [17, 24, 39];

const PAGE_MARGIN_X = 36;

// ---------------------------------------------------------------------------
// WinAnsi transcoding
// ---------------------------------------------------------------------------
//
// jsPDF's standard-14 fonts are declared with /WinAnsiEncoding, and jsPDF maps
// into it correctly right up until it meets a code point WinAnsi has no slot
// for. At that point it gives up on the whole string and re-emits it as raw
// UTF-16 - and the font still reads those bytes as WinAnsi. One bad character
// corrupts its entire text run, not just itself:
//
//   "\u20B1352,800.00"  ->  20 B1 00 33 00 35 00 32 ...  ->  prints "\u00B1352,800.00"
//
// \u20B1 is that character, and it is in every peso figure of all seventeen
// reports, so every currency line printed with a plus-minus in front of it.
//
// So the transcode below only has to do two things: swap \u20B1 for something
// printable, and make sure nothing else unmappable ever reaches jsPDF and
// takes a whole line down with it. Punctuation WinAnsi does carry (em dash,
// bullet, curly quotes) is listed explicitly so it keeps its real glyph rather
// than being folded away with the genuinely unrepresentable.
//
// We deliberately do NOT embed a Unicode font for the sake of one glyph: three
// faces of a modern sans is ~370 KB (~490 KB base64) in a route bundle that
// already carries exceljs, docx and jspdf, and even a Latin-1 subset would add
// a build step plus a new silent-failure mode - any glyph outside the subset
// renders as a blank box, which is the class of defect this replaces.

/**
 * Code points above U+00FF that WinAnsi can represent, mapped to their WinAnsi
 * byte. Doubles as the allowlist `foldChar` checks before treating a character
 * as unrepresentable, so an em dash keeps its glyph instead of folding to "?".
 */
const WIN_ANSI_HIGH: Readonly<Record<string, string>> = {
  "\u20AC": "\u0080", // euro
  "\u201A": "\u0082", // single low quote
  "\u0192": "\u0083", // florin
  "\u201E": "\u0084", // double low quote
  "\u2026": "\u0085", // ellipsis
  "\u2020": "\u0086", // dagger
  "\u2021": "\u0087", // double dagger
  "\u02C6": "\u0088", // circumflex
  "\u2030": "\u0089", // per mille
  "\u0160": "\u008A", // S caron
  "\u2039": "\u008B", // single left angle quote
  "\u0152": "\u008C", // OE
  "\u017D": "\u008E", // Z caron
  "\u2018": "\u0091", // left single quote
  "\u2019": "\u0092", // right single quote
  "\u201C": "\u0093", // left double quote
  "\u201D": "\u0094", // right double quote
  "\u2022": "\u0095", // bullet
  "\u2013": "\u0096", // en dash
  "\u2014": "\u0097", // em dash
  "\u02DC": "\u0098", // small tilde
  "\u2122": "\u0099", // trade mark
  "\u0161": "\u009A", // s caron
  "\u203A": "\u009B", // single right angle quote
  "\u0153": "\u009C", // oe
  "\u017E": "\u009E", // z caron
  "\u0178": "\u009F", // Y diaeresis
};

/** Punctuation WinAnsi has no slot for, but that has an honest ASCII stand-in. */
const ASCII_STANDIN: Readonly<Record<string, string>> = {
  "\u2010": "-", // hyphen
  "\u2011": "-", // non-breaking hyphen
  "\u2015": "-", // horizontal bar
  "\u2212": "-", // minus sign
  "\u2044": "/", // fraction slash
};

/**
 * The peso sign is the one glyph in these reports that WinAnsi cannot express
 * at all, so no standard-14 font can print it. It becomes its ISO 4217 code,
 * which is unambiguous on a printed statement. A space already following the
 * sign is swallowed so "\u20B1 100" does not become "PHP  100".
 */
const PESO_SIGN = /\u20B1[ \u00A0]?/g;

/** True for text every standard-14 glyph can already represent. */
const NON_LATIN1 = /[^\u0000-\u00FF]/;

/** Combining marks left behind by NFKD, which WinAnsi cannot stack. */
const COMBINING_MARKS = /[\u0300-\u036F]/g;

function foldChar(char: string): string {
  if (char.charCodeAt(0) <= 0xff) return char;
  const winAnsi = WIN_ANSI_HIGH[char];
  if (winAnsi !== undefined) return winAnsi;
  const standin = ASCII_STANDIN[char];
  if (standin !== undefined) return standin;
  // Last resort: decompose (A-macron to A, narrow no-break space to space) and
  // keep whatever lands inside Latin-1. A visible "?" beats a silent deletion
  // - silent deletion is how the missing em dashes went unnoticed.
  const folded = char
    .normalize("NFKD")
    .replace(COMBINING_MARKS, "")
    .split("")
    .filter((c) => c.charCodeAt(0) <= 0xff)
    .join("");
  return folded || "?";
}

/**
 * Render a string into something the standard-14 WinAnsi fonts can actually
 * print. Idempotent: already-safe text is returned untouched.
 */
export function toPdfText(value: string): string {
  const withCurrency = value.replace(PESO_SIGN, "PHP ");
  // Fast path - the overwhelming majority of report text is Latin-1 already.
  if (!NON_LATIN1.test(withCurrency)) return withCurrency;
  return Array.from(withCurrency, foldChar).join("");
}

function encodeTextArg(text: string | string[]): string | string[] {
  return Array.isArray(text) ? text.map(toPdfText) : toPdfText(text);
}

/**
 * Install the transcode on the instance rather than at each call site.
 *
 * jsPDF offers no encoding hook, and jspdf-autotable both draws and measures
 * straight off the jsPDF instance it is handed — so patching these four
 * methods is the only seam that covers table cells as well as our own draws.
 * Measurement goes through the same fold as drawing on purpose: right-aligned
 * currency columns only line up if the width we measure matches the bytes we
 * write, and "PHP " is wider than "₱".
 */
function installWinAnsiEncoder(doc: jsPDF): void {
  const text = doc.text.bind(doc);
  const getTextWidth = doc.getTextWidth.bind(doc);
  const getStringUnitWidth = doc.getStringUnitWidth.bind(doc);
  const splitTextToSize = doc.splitTextToSize.bind(doc);

  doc.text = ((
    value: string | string[],
    x: number,
    y: number,
    options?: Parameters<jsPDF["text"]>[3],
    transform?: Parameters<jsPDF["text"]>[4]
  ) => text(encodeTextArg(value), x, y, options, transform)) as jsPDF["text"];

  doc.getTextWidth = ((value: string) =>
    getTextWidth(toPdfText(String(value)))) as jsPDF["getTextWidth"];

  doc.getStringUnitWidth = ((value: string, options?: unknown) =>
    getStringUnitWidth(
      toPdfText(String(value)),
      options
    )) as jsPDF["getStringUnitWidth"];

  doc.splitTextToSize = ((value: string, maxlen: number, options?: unknown) =>
    splitTextToSize(
      toPdfText(String(value)),
      maxlen,
      options
    )) as jsPDF["splitTextToSize"];
}

/** Right-aligned text helper — used by the letterhead and both strips. */
function textRight(doc: jsPDF, text: string, y: number): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.text(text, pageWidth - PAGE_MARGIN_X - doc.getTextWidth(text), y);
}

function drawHeader(doc: jsPDF, report: ReportDocument): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const headerHeight = 64;

  doc.setFillColor(...BRAND_ORANGE);
  doc.rect(0, 0, pageWidth, headerHeight, "F");

  // Logo, when the fetch that encodes it succeeded. Drawn on a white plate so
  // a dark mark stays legible against the orange band.
  let textX = PAGE_MARGIN_X;
  if (report.meta.logoData) {
    const size = 38;
    const x = PAGE_MARGIN_X;
    const y = (headerHeight - size) / 2;
    try {
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(x, y, size, size, 3, 3, "F");
      doc.addImage(report.meta.logoData, x + 3, y + 3, size - 6, size - 6);
      textX = x + size + 12;
    } catch {
      // An unsupported image format must not cost us the whole export.
      textX = PAGE_MARGIN_X;
    }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont("helvetica", "italic");
  doc.text(report.meta.org.toUpperCase(), textX, 22);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(report.meta.title, textX, 44);

  if (report.meta.subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(report.meta.subtitle, textX, 58);
  }

  if (report.meta.reference) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    textRight(doc, "REFERENCE", 22);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    textRight(doc, report.meta.reference, 36);
  }

  // Scope strip: period / branch on the left, preparer / generated on the
  // right. A second line only appears when there is something to put on it.
  const stripY = headerHeight;
  const secondLine = !!(report.meta.branchLabel || report.meta.preparedBy);
  const stripHeight = secondLine ? 36 : 22;
  doc.setFillColor(245, 245, 245);
  doc.rect(0, stripY, pageWidth, stripHeight, "F");

  doc.setTextColor(...MUTED);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Period: ${report.meta.period ?? "—"}`, PAGE_MARGIN_X, stripY + 14);
  textRight(doc, `Generated: ${report.meta.generatedAt}`, stripY + 14);

  if (secondLine) {
    if (report.meta.branchLabel) {
      doc.text(`Branch: ${report.meta.branchLabel}`, PAGE_MARGIN_X, stripY + 28);
    }
    if (report.meta.preparedBy) {
      textRight(doc, `Prepared by: ${report.meta.preparedBy}`, stripY + 28);
    }
  }

  return stripY + stripHeight + 12;
}

function drawFooter(doc: jsPDF, report: ReportDocument) {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setTextColor(...MUTED);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    // The reference rides the footer so a loose page can be traced back to the
    // run that produced it.
    const left = [
      report.meta.reference,
      "Auto-generated. Figures reflect data available at the time of export.",
    ]
      .filter(Boolean)
      .join("  •  ");
    doc.text(left, PAGE_MARGIN_X, pageHeight - 18);
    const pageLabel = `Page ${i} of ${pageCount}`;
    const w = doc.getTextWidth(pageLabel);
    doc.text(pageLabel, pageWidth - PAGE_MARGIN_X - w, pageHeight - 18);
  }
}

function drawKpiGrid(doc: jsPDF, section: ReportSection, startY: number): number {
  if (section.kind !== "kpi_grid") return startY;
  const pageWidth = doc.internal.pageSize.getWidth();

  let y = startY;
  if (section.title) {
    doc.setTextColor(...FOREGROUND);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(section.title, PAGE_MARGIN_X, y + 4);
    y += 16;
  }

  // 4-up grid that wraps. Each card: small label + bold value, plus the hint
  // underneath when the section carries one. The hint is the qualifier that
  // makes a headline figure readable ("Withheld from ₱370,000.00 principal
  // released") — dropping it left the printed copy less informative than the
  // screen it was exported from.
  const cols = 4;
  const gap = 8;
  const totalW = pageWidth - PAGE_MARGIN_X * 2;
  const cardW = (totalW - gap * (cols - 1)) / cols;
  const hasHints = section.items.some((item) => !!item.hint);
  const cardH = hasHints ? 62 : 48;

  section.items.forEach((item, idx) => {
    const col = idx % cols;
    const rowIdx = Math.floor(idx / cols);
    const x = PAGE_MARGIN_X + col * (cardW + gap);
    const cardY = y + rowIdx * (cardH + gap);

    doc.setFillColor(...BRAND_ORANGE_SOFT);
    doc.setDrawColor(255, 220, 200);
    doc.roundedRect(x, cardY, cardW, cardH, 4, 4, "FD");

    doc.setTextColor(...MUTED);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(item.label.toUpperCase(), x + 8, cardY + 14);

    if (item.tone === "positive") {
      doc.setTextColor(21, 128, 61); // green-700
    } else if (item.tone === "negative") {
      doc.setTextColor(185, 28, 28); // red-700
    } else {
      doc.setTextColor(...FOREGROUND);
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(item.value, x + 8, cardY + 34);

    if (item.hint) {
      doc.setTextColor(...MUTED);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      // Two lines at most: a card is a headline, not a paragraph.
      const lines = doc.splitTextToSize(item.hint, cardW - 16) as string[];
      doc.text(lines.slice(0, 2), x + 8, cardY + 45);
    }
  });

  const rowsUsed = Math.ceil(section.items.length / cols);
  return y + rowsUsed * (cardH + gap) + 8;
}

function drawTable(doc: jsPDF, section: ReportSection, startY: number): number {
  if (section.kind !== "table") return startY;
  const pageWidth = doc.internal.pageSize.getWidth();

  let y = startY;
  if (section.title) {
    doc.setTextColor(...FOREGROUND);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(section.title, PAGE_MARGIN_X, y + 4);
    y += 14;
  }

  if (section.rows.length === 0) {
    doc.setTextColor(...MUTED);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.text(
      section.emptyText ?? "No data available.",
      pageWidth / 2,
      y + 20,
      { align: "center" }
    );
    return y + 32;
  }

  const head = [section.columns.map((c) => c.header)];
  const body = section.rows.map((row) =>
    section.columns.map((col) => formatCell(row, col))
  );

  let foot: string[][] | undefined;
  if (section.totals && section.totals.length > 0) {
    const firstTotalIdx = section.columns.findIndex((c) =>
      section.totals!.some((t) => t.column === c.key)
    );
    const totalRow = section.columns.map((c) => {
      const t = section.totals!.find((x) => x.column === c.key);
      return t ? t.value : "";
    });
    if (firstTotalIdx > 0) totalRow[firstTotalIdx - 1] = "Total";
    foot = [totalRow];
  }

  autoTable(doc, {
    head,
    body,
    foot,
    startY: y,
    margin: { left: PAGE_MARGIN_X, right: PAGE_MARGIN_X },
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 5,
      textColor: FOREGROUND,
      lineColor: [229, 231, 235],
      lineWidth: 0.5,
    },
    headStyles: {
      fillColor: TABLE_HEADER_BG,
      textColor: FOREGROUND,
      fontStyle: "bold",
    },
    footStyles: {
      fillColor: TOTAL_ROW_BG,
      textColor: FOREGROUND,
      fontStyle: "bold",
    },
    columnStyles: section.columns.reduce<
      Record<number, { halign: "left" | "right" | "center" }>
    >((acc, col, idx) => {
      acc[idx] = { halign: col.align ?? "left" };
      return acc;
    }, {}),
  });

  // jspdf-autotable mutates doc with lastAutoTable.
  const lastY =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? y + 20;
  return lastY + 12;
}

function drawFields(doc: jsPDF, section: ReportSection, startY: number): number {
  if (section.kind !== "fields") return startY;
  const pageWidth = doc.internal.pageSize.getWidth();

  let y = startY;
  if (section.title) {
    doc.setTextColor(...FOREGROUND);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(section.title, PAGE_MARGIN_X, y + 4);
    y += 14;
  }

  // Two columns of label→value, matching the preview's definition list.
  const cols = 2;
  const totalW = pageWidth - PAGE_MARGIN_X * 2;
  const colW = totalW / cols;
  const lineH = 16;
  const rows = Math.ceil(section.items.length / cols);

  doc.setDrawColor(229, 231, 235);
  doc.setFillColor(250, 250, 250);
  doc.rect(PAGE_MARGIN_X, y, totalW, rows * lineH + 10, "FD");

  section.items.forEach((item, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const x = PAGE_MARGIN_X + col * colW + 8;
    const lineY = y + 16 + row * lineH;

    doc.setTextColor(...MUTED);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(item.label, x, lineY);

    doc.setTextColor(...FOREGROUND);
    doc.setFont("helvetica", "bold");
    const valueW = doc.getTextWidth(item.value);
    doc.text(item.value, x + colW - 16 - valueW, lineY);
  });

  return y + rows * lineH + 20;
}

function drawSignatures(
  doc: jsPDF,
  section: ReportSection,
  startY: number
): number {
  if (section.kind !== "signatures") return startY;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const blockHeight = 56;
  // Never split a sign-off block across a page — half a signature line at the
  // bottom of a page reads as a printing error.
  let y = startY + 12;
  if (y + blockHeight > pageHeight - 40) {
    doc.addPage();
    y = 52;
  }

  const totalW = pageWidth - PAGE_MARGIN_X * 2;
  const colW = totalW / section.roles.length;
  const ruleY = y + 30;

  section.roles.forEach((role, idx) => {
    const x = PAGE_MARGIN_X + idx * colW;
    doc.setDrawColor(150, 150, 150);
    doc.setLineWidth(0.6);
    doc.line(x, ruleY, x + colW - 24, ruleY);

    doc.setTextColor(...MUTED);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(role, x, ruleY + 11);
  });

  return ruleY + 24;
}

function drawNote(doc: jsPDF, section: ReportSection, startY: number): number {
  if (section.kind !== "note") return startY;
  const pageWidth = doc.internal.pageSize.getWidth();
  const maxWidth = pageWidth - PAGE_MARGIN_X * 2;

  doc.setTextColor(...MUTED);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  const lines = doc.splitTextToSize(section.text, maxWidth);
  doc.text(lines, PAGE_MARGIN_X, startY + 4);
  return startY + lines.length * 12 + 8;
}

/**
 * Render the document and hand back the jsPDF instance, without saving. The
 * save is split off so tests can assert against the bytes we actually emit
 * rather than against the model that produced them.
 */
export function renderReportPdf(report: ReportDocument): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  installWinAnsiEncoder(doc);

  let cursor = drawHeader(doc, report);

  for (const section of report.sections) {
    if (section.kind === "kpi_grid") {
      cursor = drawKpiGrid(doc, section, cursor);
    } else if (section.kind === "table") {
      cursor = drawTable(doc, section, cursor);
    } else if (section.kind === "fields") {
      cursor = drawFields(doc, section, cursor);
    } else if (section.kind === "signatures") {
      cursor = drawSignatures(doc, section, cursor);
    } else if (section.kind === "note") {
      cursor = drawNote(doc, section, cursor);
    }

    // Soft page break: if we're near the bottom, add a new page so the
    // next section starts cleanly.
    const pageHeight = doc.internal.pageSize.getHeight();
    if (cursor > pageHeight - 80) {
      doc.addPage();
      cursor = 40;
    }
  }

  drawFooter(doc, report);

  return doc;
}

export function exportReportToPdf(report: ReportDocument): void {
  const doc = renderReportPdf(report);
  const slug = report.meta.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const date = todayISO();
  const blob = doc.output("blob");
  saveAs(blob, `${slug}-${date}.pdf`);
}
