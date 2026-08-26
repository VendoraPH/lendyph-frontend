import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  ImageRun,
  PageNumber,
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
import { formatCell } from "@/lib/report-format";
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

/** docx only accepts these; anything else (webp, avif) is skipped silently. */
const DOCX_IMAGE_TYPES: Record<string, "png" | "jpg" | "gif" | "bmp"> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/gif": "gif",
  "image/bmp": "bmp",
};

/** Decode a `data:` URL into the bytes + type an ImageRun needs. */
function decodeLogo(
  dataUrl: string | null | undefined
): { data: Uint8Array; type: "png" | "jpg" | "gif" | "bmp" } | null {
  if (!dataUrl) return null;
  const match = /^data:([^;,]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  const type = DOCX_IMAGE_TYPES[match[1].toLowerCase()];
  if (!type) return null;
  try {
    const binary = atob(match[2]);
    const data = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) data[i] = binary.charCodeAt(i);
    return { data, type };
  } catch {
    return null;
  }
}

function buildHeaderTable(report: ReportDocument): Table {
  const logo = decodeLogo(report.meta.logoData);

  const brandCell = new TableCell({
    shading: { type: ShadingType.SOLID, fill: BRAND_ORANGE, color: "auto" },
    borders: NO_BORDER,
    children: [
      ...(logo
        ? [
            new Paragraph({
              children: [
                new ImageRun({
                  data: logo.data,
                  type: logo.type,
                  transformation: { width: 48, height: 48 },
                }),
              ],
            }),
          ]
        : []),
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
  });

  // Reference sits in its own right-hand cell so it stays put no matter how
  // long the title runs.
  const referenceCell = new TableCell({
    width: { size: 28, type: WidthType.PERCENTAGE },
    shading: { type: ShadingType.SOLID, fill: BRAND_ORANGE, color: "auto" },
    borders: NO_BORDER,
    children: report.meta.reference
      ? [
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({ text: "REFERENCE", color: "FFFFFF", size: 14 }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({
                text: report.meta.reference,
                color: "FFFFFF",
                bold: true,
                size: 18,
              }),
            ],
          }),
        ]
      : [new Paragraph({ children: [] })],
  });

  const titleRow = new TableRow({
    tableHeader: true,
    children: [brandCell, referenceCell],
  });

  const metaLine = (text: string, align: (typeof AlignmentType)[keyof typeof AlignmentType]) =>
    new Paragraph({
      alignment: align,
      children: [new TextRun({ text, color: MUTED, size: 18 })],
    });

  const metaCell = (paragraphs: Paragraph[], size: number) =>
    new TableCell({
      width: { size, type: WidthType.PERCENTAGE },
      shading: { type: ShadingType.SOLID, fill: "F5F5F5", color: "auto" },
      borders: NO_BORDER,
      children: paragraphs.length ? paragraphs : [new Paragraph({ children: [] })],
    });

  const leftMeta = [metaLine(`Period: ${report.meta.period ?? "—"}`, AlignmentType.LEFT)];
  if (report.meta.branchLabel) {
    leftMeta.push(metaLine(`Branch: ${report.meta.branchLabel}`, AlignmentType.LEFT));
  }

  const rightMeta = [
    metaLine(`Generated: ${report.meta.generatedAt}`, AlignmentType.RIGHT),
  ];
  if (report.meta.preparedBy) {
    rightMeta.push(
      metaLine(`Prepared by: ${report.meta.preparedBy}`, AlignmentType.RIGHT)
    );
  }

  const periodRow = new TableRow({
    children: [metaCell(leftMeta, 72), metaCell(rightMeta, 28)],
  });

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
              // The hint qualifies the headline figure ("Withheld from
              // ₱370,000.00 principal released"). It is on screen, so it
              // belongs in the document too — a quieter second line under the
              // label rather than a value the reader has to take on trust.
              ...(item.hint
                ? [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: item.hint,
                          color: MUTED,
                          italics: true,
                          size: 14,
                        }),
                      ],
                    }),
                  ]
                : []),
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

function buildFieldsTable(section: ReportSection): Table | null {
  if (section.kind !== "fields" || section.items.length === 0) return null;

  const rows = section.items.map(
    (item) =>
      new TableRow({
        children: [
          new TableCell({
            width: { size: 40, type: WidthType.PERCENTAGE },
            borders: THIN_BORDER,
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: item.label, color: MUTED, size: 18 }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 60, type: WidthType.PERCENTAGE },
            borders: THIN_BORDER,
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: item.value,
                    bold: true,
                    color: FOREGROUND,
                    size: 18,
                  }),
                ],
              }),
            ],
          }),
        ],
      })
  );

  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows });
}

/**
 * Sign-off block: blank signing space with a ruled bottom edge, captioned
 * underneath — one column per role, the same layout as the preview and PDF.
 */
function buildSignatureTable(section: ReportSection): Table | null {
  if (section.kind !== "signatures" || section.roles.length === 0) return null;

  const width = Math.floor(100 / section.roles.length);
  const ruledCell = () =>
    new TableCell({
      width: { size: width, type: WidthType.PERCENTAGE },
      borders: {
        ...NO_BORDER,
        bottom: { style: BorderStyle.SINGLE, size: 6, color: "9CA3AF" },
      },
      margins: { top: 400 },
      children: [new Paragraph({ children: [] })],
    });

  const captionCell = (role: string) =>
    new TableCell({
      width: { size: width, type: WidthType.PERCENTAGE },
      borders: NO_BORDER,
      children: [
        new Paragraph({
          children: [new TextRun({ text: role, color: MUTED, size: 16 })],
        }),
      ],
    });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: section.roles.map(ruledCell) }),
      new TableRow({ children: section.roles.map(captionCell) }),
    ],
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
  } else if (section.kind === "fields") {
    if (section.title) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          children: [new TextRun({ text: section.title, bold: true })],
        })
      );
    }
    const t = buildFieldsTable(section);
    if (t) children.push(t);
    children.push(spacer());
  } else if (section.kind === "signatures") {
    children.push(spacer());
    const t = buildSignatureTable(section);
    if (t) children.push(t);
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

function buildPageFooter(report: ReportDocument): Footer {
  const left = [report.meta.org, report.meta.reference].filter(Boolean).join("  •  ");
  return new Footer({
    children: [
      new Paragraph({
        children: [
          new TextRun({ text: left, color: MUTED, size: 14 }),
          new TextRun({ text: "\t\tPage ", color: MUTED, size: 14 }),
          new TextRun({ children: [PageNumber.CURRENT], color: MUTED, size: 14 }),
          new TextRun({ text: " of ", color: MUTED, size: 14 }),
          new TextRun({
            children: [PageNumber.TOTAL_PAGES],
            color: MUTED,
            size: 14,
          }),
        ],
      }),
    ],
  });
}

/**
 * Assemble the .docx and hand back the bytes, without saving. Split from the
 * download so tests can unzip the real document instead of asserting against
 * the model that produced it.
 */
export async function renderReportDocx(report: ReportDocument): Promise<Blob> {
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
        // Real page footer (not a trailing paragraph) so the reference and
        // page count repeat on every printed sheet.
        footers: { default: buildPageFooter(report) },
        children: bodyChildren,
      },
    ],
  });

  return Packer.toBlob(doc);
}

export async function exportReportToDocx(report: ReportDocument): Promise<void> {
  const blob = await renderReportDocx(report);
  const slug = report.meta.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const date = new Date().toISOString().slice(0, 10);
  saveAs(blob, `${slug}-${date}.docx`);
}
