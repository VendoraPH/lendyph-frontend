import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { todayISO } from "@/lib/format";
import type {
  ReportColumn,
  ReportDocument,
  ReportSection,
} from "./types";

// Match the on-screen preview's brand look: orange header band, muted subtitle,
// clean column chrome. These constants are the only styling the exporter
// touches — everything else flows from the ReportDocument shape.
const BRAND_ORANGE_ARGB = "FFEA6A22"; // ~brand-orange solid
const BRAND_ORANGE_SOFT_ARGB = "FFFFF1E5"; // soft peach for KPI cards
const MUTED_ARGB = "FF6B7280";
const BORDER_ARGB = "FFE5E7EB";
const TABLE_HEADER_BG_ARGB = "FFF3F4F6";
const TOTAL_ROW_BG_ARGB = "FFFFF7ED";

const MAX_COL = 7; // Number of merged header columns — wide enough for list reports.

function setupSheet(ws: ExcelJS.Worksheet) {
  ws.properties.defaultRowHeight = 18;
  ws.views = [{ state: "frozen", ySplit: 0, showGridLines: false }];
}

function excelNumFormat(col: ReportColumn): string | undefined {
  switch (col.format) {
    // Centavo-accurate, matching the on-screen preview — whole-peso rounding
    // made a column disagree with its own total.
    case "currency":
      return '"₱"#,##0.00;[Red]-"₱"#,##0.00';
    case "number":
      return "#,##0.##";
    case "percent":
      return "0.0%";
    case "date":
      return "mmm d, yyyy";
    case "datetime":
      return "mmm d, yyyy h:mm AM/PM";
    default:
      return undefined;
  }
}

function coerceValue(value: unknown, col: ReportColumn): unknown {
  if (value === null || value === undefined || value === "") return null;
  switch (col.format) {
    case "currency":
    case "number": {
      const n = typeof value === "number" ? value : Number(value);
      return Number.isFinite(n) ? n : value;
    }
    case "percent": {
      const n = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(n)) return value;
      // The API returns whole percents (12.5 = 12.5%); Excel's 0.0% format
      // expects a fraction. Never guess from magnitude — 0.8 is 0.8%, not 80%.
      return n / 100;
    }
    case "date":
    case "datetime": {
      const d = new Date(value as string | number | Date);
      return Number.isNaN(d.getTime()) ? value : d;
    }
    default:
      return value;
  }
}

function applyBorders(row: ExcelJS.Row, from = 1, to = MAX_COL) {
  for (let i = from; i <= to; i++) {
    const cell = row.getCell(i);
    cell.border = {
      top: { style: "thin", color: { argb: BORDER_ARGB } },
      left: { style: "thin", color: { argb: BORDER_ARGB } },
      right: { style: "thin", color: { argb: BORDER_ARGB } },
      bottom: { style: "thin", color: { argb: BORDER_ARGB } },
    };
  }
}

function writeHeaderBlock(
  ws: ExcelJS.Worksheet,
  doc: ReportDocument
): number {
  // Orange title bar: org + title.
  const titleRow = ws.addRow([doc.meta.title]);
  ws.mergeCells(titleRow.number, 1, titleRow.number, MAX_COL);
  titleRow.height = 28;
  const titleCell = titleRow.getCell(1);
  titleCell.font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
  titleCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: BRAND_ORANGE_ARGB },
  };

  const orgRow = ws.addRow([doc.meta.org]);
  ws.mergeCells(orgRow.number, 1, orgRow.number, MAX_COL);
  orgRow.height = 18;
  const orgCell = orgRow.getCell(1);
  orgCell.font = { size: 10, color: { argb: "FFFFFFFF" }, italic: true };
  orgCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  orgCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: BRAND_ORANGE_ARGB },
  };

  // Period + generated-at strip.
  if (doc.meta.subtitle) {
    const subRow = ws.addRow([doc.meta.subtitle]);
    ws.mergeCells(subRow.number, 1, subRow.number, MAX_COL);
    subRow.height = 18;
    const c = subRow.getCell(1);
    c.font = { size: 11, color: { argb: "FF111827" } };
    c.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  }

  // Period / reference strip, then scope / preparer — the same four facts the
  // preview shows, so a printed sheet is self-identifying.
  writeMetaRow(
    ws,
    `Period: ${doc.meta.period ?? "—"}`,
    doc.meta.reference ? `Reference: ${doc.meta.reference}` : ""
  );
  if (doc.meta.branchLabel || doc.meta.preparedBy) {
    writeMetaRow(
      ws,
      doc.meta.branchLabel ? `Branch: ${doc.meta.branchLabel}` : "",
      doc.meta.preparedBy ? `Prepared by: ${doc.meta.preparedBy}` : ""
    );
  }
  writeMetaRow(ws, "", `Generated: ${doc.meta.generatedAt}`);

  // Spacer row
  ws.addRow([]);

  return ws.rowCount;
}

/** One muted left/right strip line spanning the full header width. */
function writeMetaRow(ws: ExcelJS.Worksheet, left: string, right: string): void {
  const row = ws.addRow([left, null, null, null, null, null, right]);
  row.height = 16;
  row.getCell(1).font = { size: 10, color: { argb: MUTED_ARGB } };
  row.getCell(1).alignment = { horizontal: "left", indent: 1 };
  row.getCell(MAX_COL).font = { size: 10, color: { argb: MUTED_ARGB } };
  row.getCell(MAX_COL).alignment = { horizontal: "right", indent: 1 };
  ws.mergeCells(row.number, 1, row.number, 3);
  ws.mergeCells(row.number, 4, row.number, MAX_COL);
}

function writeKpiGrid(ws: ExcelJS.Worksheet, section: ReportSection): void {
  if (section.kind !== "kpi_grid") return;

  if (section.title) {
    const r = ws.addRow([section.title]);
    ws.mergeCells(r.number, 1, r.number, MAX_COL);
    r.getCell(1).font = { bold: true, size: 12 };
    r.getCell(1).alignment = { horizontal: "left", indent: 1 };
    r.height = 20;
  }

  // 2-column KPI table: label | value. Clean, reads like the on-screen grid.
  //
  // The value has to be written into column 4, not column 2. Both label and
  // value are merged bands (1–3 and 4–MAX_COL) and a merge keeps only the
  // top-left cell of each band: anything in column 2 is discarded when
  // `mergeCells(row, 1, row, 3)` runs. Writing to 2 and styling 4 is how every
  // KPI value in every report went missing from the .xlsx while the labels
  // stayed put.
  section.items.forEach((item) => {
    const row = ws.addRow([item.label, null, null, item.value]);
    ws.mergeCells(row.number, 1, row.number, 3);
    ws.mergeCells(row.number, 4, row.number, MAX_COL);
    row.height = item.hint ? 34 : 22;

    const labelCell = row.getCell(1);
    if (item.hint) {
      // The hint qualifies the figure ("Withheld from ₱370,000.00 principal
      // released") and is part of the reading, so it rides under the label as
      // a second, quieter line rather than being dropped on export.
      labelCell.value = {
        richText: [
          { text: item.label, font: { size: 11, color: { argb: MUTED_ARGB } } },
          {
            text: `\n${item.hint}`,
            font: { size: 9, italic: true, color: { argb: MUTED_ARGB } },
          },
        ],
      };
    } else {
      labelCell.font = { size: 11, color: { argb: MUTED_ARGB } };
    }
    labelCell.alignment = {
      vertical: "middle",
      horizontal: "left",
      indent: 1,
      wrapText: !!item.hint,
    };
    labelCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: BRAND_ORANGE_SOFT_ARGB },
    };

    const valueCell = row.getCell(4);
    valueCell.font = { size: 12, bold: true };
    valueCell.alignment = { vertical: "middle", horizontal: "right", indent: 1 };
    valueCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: BRAND_ORANGE_SOFT_ARGB },
    };

    applyBorders(row, 1, MAX_COL);
  });

  ws.addRow([]);
}

function writeTable(ws: ExcelJS.Worksheet, section: ReportSection): void {
  if (section.kind !== "table") return;

  if (section.title) {
    const r = ws.addRow([section.title]);
    ws.mergeCells(r.number, 1, r.number, MAX_COL);
    r.getCell(1).font = { bold: true, size: 12 };
    r.getCell(1).alignment = { horizontal: "left", indent: 1 };
    r.height = 20;
  }

  if (section.rows.length === 0) {
    const r = ws.addRow([section.emptyText ?? "No data available."]);
    ws.mergeCells(r.number, 1, r.number, MAX_COL);
    r.getCell(1).font = { italic: true, color: { argb: MUTED_ARGB } };
    r.getCell(1).alignment = { horizontal: "center" };
    r.height = 28;
    ws.addRow([]);
    return;
  }

  const columnCount = section.columns.length;

  // Header row
  const headerRow = ws.addRow(section.columns.map((c) => c.header));
  headerRow.height = 22;
  headerRow.eachCell((cell, colNumber) => {
    if (colNumber > columnCount) return;
    cell.font = { bold: true, size: 11 };
    cell.alignment = {
      vertical: "middle",
      horizontal: section.columns[colNumber - 1].align ?? "left",
      indent: 1,
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: TABLE_HEADER_BG_ARGB },
    };
  });
  applyBorders(headerRow, 1, columnCount);

  // Column widths
  section.columns.forEach((col, idx) => {
    const wsCol = ws.getColumn(idx + 1);
    const charWidth = Math.max(10, Math.round((col.width ?? 120) / 8));
    wsCol.width = Math.max(wsCol.width ?? 0, charWidth);
  });

  // Data rows
  section.rows.forEach((row) => {
    const values = section.columns.map((col) => coerceValue(row[col.key], col));
    const xr = ws.addRow(values);
    xr.height = 20;
    section.columns.forEach((col, idx) => {
      const cell = xr.getCell(idx + 1);
      cell.alignment = {
        vertical: "middle",
        horizontal: col.align ?? "left",
        indent: 1,
      };
      const fmt = excelNumFormat(col);
      if (fmt) cell.numFmt = fmt;
    });
    applyBorders(xr, 1, columnCount);
  });

  // Totals row
  if (section.totals && section.totals.length > 0) {
    const totalRowValues = section.columns.map((col) => {
      const match = section.totals!.find((t) => t.column === col.key);
      return match ? match.value : null;
    });
    const firstTotalIndex = section.columns.findIndex((c) =>
      section.totals!.some((t) => t.column === c.key)
    );
    if (firstTotalIndex > 0) {
      totalRowValues[firstTotalIndex - 1] = "Total";
    }
    const tr = ws.addRow(totalRowValues);
    tr.height = 22;
    section.columns.forEach((col, idx) => {
      const cell = tr.getCell(idx + 1);
      cell.font = { bold: true };
      cell.alignment = {
        vertical: "middle",
        horizontal: col.align ?? "left",
        indent: 1,
      };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: TOTAL_ROW_BG_ARGB },
      };
    });
    applyBorders(tr, 1, columnCount);
  }

  ws.addRow([]);
}

function writeFields(ws: ExcelJS.Worksheet, section: ReportSection): void {
  if (section.kind !== "fields") return;

  if (section.title) {
    const r = ws.addRow([section.title]);
    ws.mergeCells(r.number, 1, r.number, MAX_COL);
    r.getCell(1).font = { bold: true, size: 12 };
    r.getCell(1).alignment = { horizontal: "left", indent: 1 };
    r.height = 20;
  }

  // Values are pre-formatted strings from the builder, so they are written as
  // text rather than coerced — a loan account number is not a number.
  //
  // Column 4, for the same reason as the KPI grid: column 2 sits inside the
  // label's merge band and is discarded the moment the merge is applied.
  section.items.forEach((item) => {
    const row = ws.addRow([item.label, null, null, item.value]);
    ws.mergeCells(row.number, 1, row.number, 3);
    ws.mergeCells(row.number, 4, row.number, MAX_COL);
    row.height = 20;
    row.getCell(1).font = { size: 11, color: { argb: MUTED_ARGB } };
    row.getCell(1).alignment = { horizontal: "left", indent: 1 };
    row.getCell(4).font = { size: 11, bold: true };
    row.getCell(4).alignment = { horizontal: "left", indent: 1 };
    applyBorders(row, 1, MAX_COL);
  });

  ws.addRow([]);
}

function writeSignatures(ws: ExcelJS.Worksheet, section: ReportSection): void {
  if (section.kind !== "signatures") return;

  ws.addRow([]);
  // Blank signing space, then the ruled line, then the captions underneath —
  // the printed convention, mirrored from the preview.
  const space = ws.addRow([]);
  space.height = 34;

  const span = Math.max(1, Math.floor(MAX_COL / section.roles.length));
  const ruleRow = ws.addRow([]);
  const captionRow = ws.addRow(
    section.roles.flatMap((role, i) =>
      i === 0 ? [role] : [...Array(span - 1).fill(null), role]
    )
  );
  captionRow.height = 16;

  section.roles.forEach((_, i) => {
    const col = i * span + 1;
    if (col > MAX_COL) return;
    ruleRow.getCell(col).border = {
      bottom: { style: "thin", color: { argb: "FF9CA3AF" } },
    };
    for (let c = col + 1; c < col + span && c <= MAX_COL; c++) {
      ruleRow.getCell(c).border = {
        bottom: { style: "thin", color: { argb: "FF9CA3AF" } },
      };
    }
    captionRow.getCell(col).font = { size: 9, color: { argb: MUTED_ARGB } };
    captionRow.getCell(col).alignment = { horizontal: "left", indent: 1 };
  });

  ws.addRow([]);
}

function writeNote(ws: ExcelJS.Worksheet, section: ReportSection): void {
  if (section.kind !== "note") return;
  const r = ws.addRow([section.text]);
  ws.mergeCells(r.number, 1, r.number, MAX_COL);
  r.getCell(1).font = { italic: true, color: { argb: MUTED_ARGB }, size: 10 };
  r.getCell(1).alignment = { horizontal: "left", indent: 1, wrapText: true };
  ws.addRow([]);
}

function writeFooter(ws: ExcelJS.Worksheet, doc: ReportDocument): void {
  ws.addRow([]);
  const r = ws.addRow([
    "This report is auto-generated. Figures reflect data available at the time of export.",
  ]);
  ws.mergeCells(r.number, 1, r.number, MAX_COL);
  r.getCell(1).font = { size: 9, color: { argb: MUTED_ARGB }, italic: true };
  r.getCell(1).alignment = { horizontal: "left", indent: 1 };

  // Repeat the reference in Excel's own print footer so it survives paging.
  const footerParts = [doc.meta.org, doc.meta.reference].filter(Boolean);
  ws.headerFooter.oddFooter = `&L&9${footerParts.join(" • ")}&R&9Page &P of &N`;
}

/** Excel rejects any of `* ? : \ / [ ]` in a sheet name, and caps it at 31. */
const FORBIDDEN_SHEET_CHARS = /[*?:\\/[\]]/g;
const MAX_SHEET_NAME = 31;

/**
 * Turn a report title into a name Excel will accept.
 *
 * "Officer / Branch Performance" used to throw straight out of
 * `addWorksheet`, so that report had no Excel export at all — the user only
 * saw "Export failed. Please try again." while the other three formats worked.
 * Slicing to 28 characters guarded the length limit but not the character set.
 */
export function toWorksheetName(title: string): string {
  const cleaned = title
    .replace(FORBIDDEN_SHEET_CHARS, "-")
    .replace(/-{2,}/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_SHEET_NAME)
    // Excel also refuses a name that opens or closes on an apostrophe, and the
    // slice above can leave a dangling separator.
    .replace(/^['-]+|['\s-]+$/g, "")
    .trim();

  // "History" is reserved for Excel's own change-tracking sheet.
  if (!cleaned || cleaned.toLowerCase() === "history") return "Report";
  return cleaned;
}

/**
 * Build the workbook without saving it, so tests can read the real .xlsx back
 * rather than trusting the model that produced it.
 */
export function buildReportWorkbook(doc: ReportDocument): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = doc.meta.org;
  wb.created = new Date();
  wb.title = doc.meta.title;

  const ws = wb.addWorksheet(toWorksheetName(doc.meta.title), {
    pageSetup: {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      margins: {
        left: 0.4,
        right: 0.4,
        top: 0.5,
        bottom: 0.5,
        header: 0.3,
        footer: 0.3,
      },
    },
    properties: { defaultRowHeight: 18 },
  });

  setupSheet(ws);
  writeHeaderBlock(ws, doc);

  for (const section of doc.sections) {
    if (section.kind === "kpi_grid") writeKpiGrid(ws, section);
    else if (section.kind === "table") writeTable(ws, section);
    else if (section.kind === "fields") writeFields(ws, section);
    else if (section.kind === "signatures") writeSignatures(ws, section);
    else if (section.kind === "note") writeNote(ws, section);
  }

  writeFooter(ws, doc);

  // Ensure every column has a usable width even if no data set it.
  ws.columns.forEach((col) => {
    if (!col.width || col.width < 12) col.width = 16;
  });

  return wb;
}

export async function exportReportToExcel(doc: ReportDocument): Promise<void> {
  const wb = buildReportWorkbook(doc);
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer as BlobPart], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const filename = buildFilename(doc);
  saveAs(blob, filename);
}

function buildFilename(doc: ReportDocument): string {
  const slug = doc.meta.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const date = todayISO();
  return `${slug}-${date}.xlsx`;
}
