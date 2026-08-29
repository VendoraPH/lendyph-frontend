import { escapeHtml } from "@/lib/html-escape";
import { DASH, formatValue } from "@/lib/report-format";
import { PRINT_STYLES } from "./print-styles";
import type {
  PrintAlign,
  PrintBlock,
  PrintChargeLine,
  PrintColumn,
  PrintField,
  PrintSignature,
  PrintableDocument,
  PrintableOrg,
} from "./types";

/**
 * The one place in the printables module that knows about HTML.
 *
 * A template emits blocks; this turns them into a standalone document that is
 * opened in a new tab and printed from there. Nothing here fetches, and nothing
 * here touches `window` — `renderPrintable` is a pure `document -> string`, so
 * the full markup of all eight printables is assertable in a node test.
 *
 * Figures are formatted with the report formatters rather than a local
 * `Intl.NumberFormat`, so a peso on a receipt is the same peso the report shows
 * — two-decimal, en-PH. That was the whole reason the hand-written templates
 * drifted: they carried their own `fmt()`.
 */

/**
 * Every value in a `PrintableDocument` — a borrower's name, an address, a
 * branch, a table cell — originates in the API and ends up inside a document
 * the browser executes, so all of it goes through `escapeHtml`
 * (`@/lib/html-escape`). A member registered as `<script>…</script>` would
 * otherwise run in the print window, which is same-origin with the app. The
 * single exception is a `paragraph`'s `html`; see its case below.
 *
 * Every interpolation in this file is inside a double-quoted attribute or a
 * text node — the invariant `escapeHtml` documents and depends on. The two
 * places that would otherwise break it are the `style` attributes, and those
 * take a validated CSS length rather than an escaped value; see `cssLength`.
 */

/**
 * A CSS length a template supplied, or the fallback.
 *
 * Column widths and spacer heights are the only template-authored values that
 * reach a `style` attribute, so they are validated rather than escaped: an
 * attacker-controlled width is not the threat, a typo silently breaking the
 * layout is.
 */
const CSS_LENGTH = /^\d+(\.\d+)?(pt|px|in|cm|mm|em|rem|%)$/;

function cssLength(value: string | undefined, fallback: string): string {
  const text = (value ?? "").trim();
  return CSS_LENGTH.test(text) ? text : fallback;
}

function alignClass(align: PrintAlign | undefined, suffix: string): string {
  return align ? ` ${suffix}-${align}` : "";
}

/** Non-empty, trimmed, or null. Keeps optional letterhead lines from printing blank. */
function text(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed ? trimmed : null;
}

// ---------------------------------------------------------------------------
// Letterhead, title, footer
// ---------------------------------------------------------------------------

/**
 * Logo, organization name, address, contact.
 *
 * Only what branding settings hold. The issuing branch deliberately does not
 * appear here: a letterhead is the cooperative's identity, and the branch a
 * copy was printed at is not part of it.
 *
 * A plain `<img>`, not `next/image`: this markup is opened in a blank tab
 * outside the Next runtime, where the image optimizer does not exist, and
 * `next.config.ts` whitelists a single remote host anyway. `print-chrome`
 * guarantees the URL is absolute — a relative `src` has nothing to resolve
 * against in a document that carries no URL of its own.
 *
 * Degrades a piece at a time: no logo leaves the name centred, no name leaves
 * the logo alone, and a fresh deployment that has filled in no branding at all
 * drops the letterhead entirely rather than printing an empty rule.
 */
function renderLetterhead(org: PrintableOrg): string {
  const name = text(org.name);
  const meta = [text(org.address), text(org.contact)]
    .filter((line): line is string => line !== null)
    .map((line) => `<div class="letterhead-meta">${escapeHtml(line)}</div>`)
    .join("");

  const logo = org.logoUrl
    ? `<img class="letterhead-logo" src="${escapeHtml(org.logoUrl)}" alt="">`
    : "";

  if (!name && !meta && !logo) return "";

  const heading = name ? `<div class="letterhead-name">${escapeHtml(name)}</div>` : "";
  return `<div class="letterhead">${logo}<div>${heading}${meta}</div></div>`;
}

function renderTitle(title: string, subtitle?: string, legalRef?: string): string {
  const parts = [`<h1>${escapeHtml(title)}</h1>`];
  if (text(subtitle)) parts.push(`<div class="subtitle">${escapeHtml(subtitle)}</div>`);
  if (text(legalRef)) parts.push(`<div class="legal-ref">${escapeHtml(legalRef)}</div>`);
  return `<div class="doc-header">${parts.join("")}</div>`;
}

/** Reference and generation stamp — what a branch quotes when a copy is queried. */
function renderFooter(doc: PrintableDocument): string {
  const parts = [
    text(doc.footerNote) ?? "This is a system-generated document.",
    text(doc.reference) ? `Ref: ${doc.reference}` : null,
    text(doc.generatedAt) ? `Generated: ${doc.generatedAt}` : null,
  ].filter((part): part is string => part !== null);

  return `<div class="footer">${parts.map(escapeHtml).join(" &bull; ")}</div>`;
}

// ---------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------

function renderField(item: PrintField): string {
  // Labels are written without punctuation by templates; the colon belongs to
  // the layout, so adding it here keeps every form line consistent.
  const label = item.label.trim();
  const labelText = escapeHtml(label.endsWith(":") ? label : `${label}:`);
  const value = text(item.value);

  const body = item.underline
    ? `<span class="field-underline">${value ? escapeHtml(value) : "&nbsp;"}</span>`
    : `<span class="field-value">${value ? escapeHtml(value) : DASH}</span>`;

  return `<div class="field-row"><span class="field-label">${labelText}</span>${body}</div>`;
}

function cellClass(column: PrintColumn): string {
  if (column.align === "center") return " class=\"ctr\"";
  if (column.align === "right") return " class=\"num\"";
  if (column.align === "left") return "";
  // Unaligned figures right-align themselves: a column of pesos that is not
  // decimal-aligned is unreadable, and every ported document did this by hand.
  const numeric = column.format === "currency" || column.format === "number" || column.format === "percent";
  return numeric ? " class=\"num\"" : "";
}

function renderTableBlock(block: Extract<PrintBlock, { kind: "table" }>): string {
  const title = text(block.title)
    ? `<div class="section-title">${escapeHtml(block.title)}</div>`
    : "";

  if (block.rows.length === 0) {
    const empty = text(block.emptyText) ?? "No entries to show.";
    return `<div class="section">${title}<div class="empty-text">${escapeHtml(empty)}</div></div>`;
  }

  const head = block.columns
    .map((column) => {
      const width = cssLength(column.width, "");
      const style = width ? ` style="width:${width}"` : "";
      // scope="col" costs nothing on paper and makes the print preview
      // navigable for a screen reader before it is sent to the printer.
      return `<th scope="col"${style}>${escapeHtml(column.header)}</th>`;
    })
    .join("");

  const body = block.rows
    .map((row) => {
      const cells = block.columns
        .map(
          (column) =>
            `<td${cellClass(column)}>${escapeHtml(formatValue(row[column.key], column.format))}</td>`
        )
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  // Totals arrive pre-formatted from the template, which is the only place that
  // knows whether a column sums, averages, or means nothing at all.
  const foot = block.totals
    ? `<tfoot><tr>${block.columns
        .map((column) => {
          const value = block.totals?.[column.key];
          return `<td${cellClass(column)}>${value ? escapeHtml(value) : ""}</td>`;
        })
        .join("")}</tr></tfoot>`
    : "";

  return (
    `<div class="section">${title}` +
    `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody>${foot}</table>` +
    `</div>`
  );
}

function renderChargeLine(line: PrintChargeLine): string {
  const rowClass =
    line.rule === "grand" ? ' class="grand-total"' : line.rule === "total" ? ' class="total-row"' : "";
  const indent = line.indent ? ' style="padding-left:16pt;"' : "";
  return (
    `<tr${rowClass}><td${indent}>${escapeHtml(line.label)}</td>` +
    `<td class="amt">${escapeHtml(line.amount)}</td></tr>`
  );
}

function renderSignature(signature: PrintSignature): string {
  const name = text(signature.name);
  const detail = text(signature.detail);
  return (
    `<div class="sig-block">` +
    `<div class="sig-line"></div>` +
    // The rule above is the space to sign in; an unknown signatory leaves the
    // name line blank rather than printing a second row of underscores.
    `<div class="sig-name">${name ? escapeHtml(name) : "&nbsp;"}</div>` +
    `<div class="sig-label">${escapeHtml(signature.label)}</div>` +
    (detail ? `<div class="sig-detail">${escapeHtml(detail)}</div>` : "") +
    `</div>`
  );
}

function renderBlock(block: PrintBlock): string {
  switch (block.kind) {
    case "title":
      return renderTitle(block.text, block.subtitle, block.legalRef);

    case "heading":
      return `<div class="section-title">${escapeHtml(block.text)}</div>`;

    case "fields": {
      const title = text(block.title)
        ? `<div class="section-title">${escapeHtml(block.title)}</div>`
        : "";
      const rows = block.items.map(renderField).join("");
      const body = block.columns === 2 ? `<div class="field-grid">${rows}</div>` : rows;
      return `<div class="section">${title}${body}</div>`;
    }

    case "paragraph":
      // The one value in this file that is NOT escaped. `paragraph.html` is
      // authored by a template in this repo — that is what the contract in
      // types.ts defines it as — so it carries intentional <strong>/<u>/<ol>
      // markup. Templates escape the API values they interpolate into it with
      // the same `escapeHtml` this file uses. Never point this at a payload.
      return `<div class="para${alignClass(block.align, "para")}">${block.html}</div>`;

    case "table":
      return renderTableBlock(block);

    case "charges": {
      const title = text(block.title)
        ? `<div class="section-title">${escapeHtml(block.title)}</div>`
        : "";
      const rows = block.lines.map(renderChargeLine).join("");
      return `<div class="section">${title}<table class="charges-table"><tbody>${rows}</tbody></table></div>`;
    }

    case "signatures": {
      const title = text(block.title)
        ? `<div class="section-title">${escapeHtml(block.title)}</div>`
        : "";
      const grid = block.columns === 3 ? "sig-grid sig-grid-3" : "sig-grid";
      const blocks = block.blocks.map(renderSignature).join("");
      // .sig-section carries page-break-inside: avoid — a signature block split
      // across the fold is the defect that gets a document sent back.
      return `<div class="sig-section">${title}<div class="${grid}">${blocks}</div></div>`;
    }

    case "notarial":
      // Plain text, not markup: the contract only sanctions template-authored
      // HTML in `paragraph`. Newlines become breaks so a jurat keeps its
      // "Doc. No. ___; Page No. ___" shape.
      return `<div class="notarial">${escapeHtml(block.body).replace(/\n/g, "<br>")}</div>`;

    case "note":
      return `<div class="note">${escapeHtml(block.text)}</div>`;

    case "spacer":
      return `<div style="height:${cssLength(block.height, "12pt")}"></div>`;

    case "page_break":
      return `<div class="page-break"></div>`;

    default: {
      // Exhaustiveness guard. Adding a block kind to the union without a branch
      // here fails the build, instead of printing a document with a section
      // silently missing from it.
      const _never: never = block;
      return _never;
    }
  }
}

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

const TOOLBAR = `
  <div class="no-print">
    <button type="button" onclick="window.print()">Print Document</button>
    <button type="button" onclick="window.close()">Close</button>
  </div>`;

/** One complete copy: letterhead, title, blocks, footer. */
function renderCopy(doc: PrintableDocument, label: string | null, index: number): string {
  const classes = index === 0 ? "copy" : "copy page-break";
  const copyLabel = label
    ? `<div class="copy-label"><span>${escapeHtml(label)}</span></div>`
    : "";

  // A template that needs a subtitle or a legal citation emits its own `title`
  // block; when it does, that one wins and `doc.title` is left to the tab
  // title. Otherwise the document heads itself, so no template has to repeat it.
  const heading = doc.blocks.some((block) => block.kind === "title")
    ? ""
    : renderTitle(doc.title);

  const blocks = doc.blocks.map(renderBlock).join("\n");

  return (
    `<section class="${classes}">` +
    copyLabel +
    renderLetterhead(doc.org) +
    heading +
    blocks +
    renderFooter(doc) +
    `</section>`
  );
}

/**
 * A `PrintableDocument` as a complete, standalone HTML document.
 *
 * `copies` repeats the whole body — letterhead, blocks and footer — once per
 * label, each on its own page and stamped in the corner. A single entry or none
 * prints one unlabelled copy, per the contract: an official receipt needs
 * "Borrower's Copy" and "File Copy", a promissory note does not want the word
 * "copy" on it anywhere.
 */
export function renderPrintable(doc: PrintableDocument): string {
  const labels = (doc.copies ?? [])
    .map((label) => text(label))
    .filter((label): label is string => label !== null);
  const copies: (string | null)[] = labels.length > 1 ? labels : [null];

  const orgName = text(doc.org.name);
  const title = orgName ? `${doc.title} — ${orgName}` : doc.title;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>${PRINT_STYLES}</style>
</head>
<body>
${TOOLBAR}
${copies.map((label, index) => renderCopy(doc, label, index)).join("\n")}
</body>
</html>`;
}
