import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { saveAs } from "file-saver";
import { formatCell } from "./formatters";
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

function drawHeader(doc: jsPDF, report: ReportDocument): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const headerHeight = 64;

  doc.setFillColor(...BRAND_ORANGE);
  doc.rect(0, 0, pageWidth, headerHeight, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont("helvetica", "italic");
  doc.text(report.meta.org.toUpperCase(), PAGE_MARGIN_X, 22);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(report.meta.title, PAGE_MARGIN_X, 44);

  if (report.meta.subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(report.meta.subtitle, PAGE_MARGIN_X, 58);
  }

  // Period / generated-at strip
  const stripY = headerHeight;
  const stripHeight = 22;
  doc.setFillColor(245, 245, 245);
  doc.rect(0, stripY, pageWidth, stripHeight, "F");

  doc.setTextColor(...MUTED);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Period: ${report.meta.period ?? "—"}`, PAGE_MARGIN_X, stripY + 14);
  const generatedText = `Generated: ${report.meta.generatedAt}`;
  const textWidth = doc.getTextWidth(generatedText);
  doc.text(generatedText, pageWidth - PAGE_MARGIN_X - textWidth, stripY + 14);

  return stripY + stripHeight + 12;
}

function drawFooter(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setTextColor(...MUTED);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.text(
      "Auto-generated. Figures reflect data available at the time of export.",
      PAGE_MARGIN_X,
      pageHeight - 18
    );
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

  // 4-up grid that wraps. Each card: small label + bold value.
  const cols = 4;
  const gap = 8;
  const totalW = pageWidth - PAGE_MARGIN_X * 2;
  const cardW = (totalW - gap * (cols - 1)) / cols;
  const cardH = 48;

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

export function exportReportToPdf(report: ReportDocument): void {
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });

  let cursor = drawHeader(doc, report);

  for (const section of report.sections) {
    if (section.kind === "kpi_grid") {
      cursor = drawKpiGrid(doc, section, cursor);
    } else if (section.kind === "table") {
      cursor = drawTable(doc, section, cursor);
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

  drawFooter(doc);

  const slug = report.meta.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const date = new Date().toISOString().slice(0, 10);
  const blob = doc.output("blob");
  saveAs(blob, `${slug}-${date}.pdf`);
}
