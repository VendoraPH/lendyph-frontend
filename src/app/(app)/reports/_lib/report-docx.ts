import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  PageOrientation,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { saveAs } from "file-saver";
import { formatCell } from "./formatters";
import type {
  ReportColumn,
  ReportDocument,
  ReportSection,
} from "./types";

// Hex without # — same palette as preview/excel/pdf so the document
// reads as a sibling artifact, not a different format.
const BRAND_ORANGE = "EA6A22";
const BRAND_ORANGE_SOFT = "FFF1E5";
const TABLE_HEADER_BG = "F3F4F6";
const TOTAL_ROW_BG = "FFF7ED";
const MUTED = "6B7280";
const BORDER = "E5E7EB";
const FOREGROUND = "111827";

const NO_BORDER = {
  top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
} as const;

const THIN_BORDER = {
  top: { style: BorderStyle.SINGLE, size: 4, color: BORDER },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: BORDER },
  left: { style: BorderStyle.SINGLE, size: 4, color: BORDER },
  right: { style: BorderStyle.SINGLE, size: 4, color: BORDER },
} as const;

function alignment(col: ReportColumn): typeof AlignmentType[keyof typeof AlignmentType] {
  switch (col.align) {
    case "right":
      return AlignmentType.RIGHT;
    case "center":
      return AlignmentType.CENTER;
    default:
      return AlignmentType.LEFT;
  }
}

function spacer(): Paragraph {
  return new Paragraph({ children: [new TextRun({ text: "" })] });
}

function buildHeaderTable(report: ReportDocument): Table {
  const titleRow = new TableRow({
    tableHeader: true,
    children: [
      new TableCell({
        shading: { type: ShadingType.SOLID, fill: BRAND_ORANGE, color: "auto" },
        borders: NO_BORDER,
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: report.meta.org.toUpperCase(),
                color: "FFFFFF",
                italics: true,
                size: 18,
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: report.meta.title,
                bold: true,
                color: "FFFFFF",
                size: 32,
              }),
            ],
          }),
          ...(report.meta.subtitle
            ? [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: report.meta.subtitle,
                      color: "FFFFFF",
                      size: 20,
                    }),
                  ],
                }),
              ]
            : []),
        ],
      }),
    ],
  });

  const periodCell = new TableCell({
    shading: { type: ShadingType.SOLID, fill: "F5F5F5", color: "auto" },
    borders: NO_BORDER,
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text: `Period: ${report.meta.period ?? "—"}`,
            color: MUTED,
            size: 18,
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          new TextRun({
            text: `Generated: ${report.meta.generatedAt}`,
            color: MUTED,
            size: 18,
          }),
        ],
      }),
    ],
  });
  const periodRow = new TableRow({ children: [periodCell] });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [titleRow, periodRow],
  });
}

function buildKpiTable(section: ReportSection): Table | null {
  if (section.kind !== "kpi_grid") return null;

  const rows = section.items.map(
    (item) =>
      new TableRow({
        children: [
          new TableCell({
            width: { size: 40, type: WidthType.PERCENTAGE },
            shading: {
              type: ShadingType.SOLID,
              fill: BRAND_ORANGE_SOFT,
              color: "auto",
            },
            borders: THIN_BORDER,
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: item.label,
                    color: MUTED,
                    size: 18,
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 60, type: WidthType.PERCENTAGE },
            shading: {
              type: ShadingType.SOLID,
              fill: BRAND_ORANGE_SOFT,
              color: "auto",
            },
            borders: THIN_BORDER,
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: item.value,
                    bold: true,
                    color:
                      item.tone === "positive"
                        ? "15803D"
                        : item.tone === "negative"
                          ? "B91C1C"
                          : FOREGROUND,
                    size: 22,
                  }),
                ],
              }),
            ],
          }),
        ],
      })
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows,
  });
}

function buildDataTable(section: ReportSection): Table | null {
  if (section.kind !== "table" || section.rows.length === 0) return null;

  const headerCells = section.columns.map(
    (col) =>
      new TableCell({
        shading: {
          type: ShadingType.SOLID,
          fill: TABLE_HEADER_BG,
          color: "auto",
        },
        borders: THIN_BORDER,
        children: [
          new Paragraph({
            alignment: alignment(col),
            children: [
              new TextRun({
                text: col.header,
                bold: true,
                color: FOREGROUND,
                size: 18,
              }),
            ],
          }),
        ],
      })
  );

  const headerRow = new TableRow({ tableHeader: true, children: headerCells });

  const bodyRows = section.rows.map(
    (row) =>
      new TableRow({
        children: section.columns.map(
          (col) =>
            new TableCell({
              borders: THIN_BORDER,
              children: [
                new Paragraph({
                  alignment: alignment(col),
                  children: [
                    new TextRun({
                      text: formatCell(row, col),
                      size: 18,
                      color: FOREGROUND,
                    }),
                  ],
                }),
              ],
            })
        ),
      })
  );

  let totalRow: TableRow | null = null;
  if (section.totals && section.totals.length > 0) {
    const firstTotalIdx = section.columns.findIndex((c) =>
      section.totals!.some((t) => t.column === c.key)
    );
    totalRow = new TableRow({
      children: section.columns.map((col, idx) => {
        const t = section.totals!.find((x) => x.column === col.key);
        const isLabel = idx === Math.max(0, firstTotalIdx - 1) && !t;
        return new TableCell({
          shading: {
            type: ShadingType.SOLID,
            fill: TOTAL_ROW_BG,
            color: "auto",
          },
          borders: THIN_BORDER,
          children: [
            new Paragraph({
              alignment: alignment(col),
              children: [
                new TextRun({
                  text: t ? t.value : isLabel ? "Total" : "",
                  bold: true,
                  color: FOREGROUND,
                  size: 18,
                }),
              ],
            }),
          ],
        });
      }),
    });
  }

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: totalRow ? [headerRow, ...bodyRows, totalRow] : [headerRow, ...bodyRows],
  });
}

function sectionToChildren(section: ReportSection): Array<Paragraph | Table> {
  const children: Array<Paragraph | Table> = [];

  if (section.kind === "kpi_grid") {
    if (section.title) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          children: [new TextRun({ text: section.title, bold: true })],
        })
      );
    }
    const t = buildKpiTable(section);
    if (t) children.push(t);
    children.push(spacer());
  } else if (section.kind === "table") {
    if (section.title) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          children: [new TextRun({ text: section.title, bold: true })],
        })
      );
    }
    if (section.rows.length === 0) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: section.emptyText ?? "No data available.",
              italics: true,
              color: MUTED,
            }),
          ],
        })
      );
    } else {
      const t = buildDataTable(section);
      if (t) children.push(t);
    }
    children.push(spacer());
  } else if (section.kind === "note") {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: section.text,
            italics: true,
            color: MUTED,
            size: 18,
          }),
        ],
      })
    );
    children.push(spacer());
  }

  return children;
}

export async function exportReportToDocx(report: ReportDocument): Promise<void> {
  const headerTable = buildHeaderTable(report);

  const bodyChildren: Array<Paragraph | Table> = [];
  bodyChildren.push(headerTable);
  bodyChildren.push(spacer());

  for (const section of report.sections) {
    bodyChildren.push(...sectionToChildren(section));
  }

  bodyChildren.push(
    new Paragraph({
      children: [
        new TextRun({
          text:
            "This report is auto-generated. Figures reflect data available at the time of export.",
          italics: true,
          color: MUTED,
          size: 16,
        }),
      ],
    })
  );

  const doc = new Document({
    creator: report.meta.org,
    title: report.meta.title,
    description: report.meta.subtitle ?? "",
    sections: [
      {
        properties: {
          page: {
            size: {
              orientation: PageOrientation.LANDSCAPE,
            },
            margin: {
              top: 720,
              right: 720,
              bottom: 720,
              left: 720,
            },
          },
        },
        children: bodyChildren,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const slug = report.meta.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const date = new Date().toISOString().slice(0, 10);
  saveAs(blob, `${slug}-${date}.docx`);
}
