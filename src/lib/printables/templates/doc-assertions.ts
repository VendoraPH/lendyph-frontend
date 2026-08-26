/**
 * Block readers shared by the template tests. Test support, not a template —
 * named so it is never matched by the `src/**\/*.test.ts` runner glob.
 *
 * Templates are asserted as `payload -> PrintableDocument`, never as rendered
 * HTML: the renderer is a separate module with its own tests, and a document
 * that carries the right blocks is the actual contract between the two.
 */

import assert from "node:assert/strict";
import type {
  PrintableDocument,
  PrintBlock,
  PrintChargeLine,
  PrintField,
  PrintSignature,
} from "../types";

type BlockOf<K extends PrintBlock["kind"]> = Extract<PrintBlock, { kind: K }>;

export function blocksOfKind<K extends PrintBlock["kind"]>(
  doc: PrintableDocument,
  kind: K
): BlockOf<K>[] {
  return doc.blocks.filter((b): b is BlockOf<K> => b.kind === kind);
}

export function titleBlock(doc: PrintableDocument): BlockOf<"title"> {
  const block = doc.blocks[0];
  assert.ok(block && block.kind === "title", "document does not open with a title");
  return block;
}

export function fieldsBlock(
  doc: PrintableDocument,
  title: string
): BlockOf<"fields"> {
  const block = blocksOfKind(doc, "fields").find((b) => b.title === title);
  assert.ok(block, `fields block "${title}" not found`);
  return block;
}

/** Every `fields` row in the document, regardless of which block holds it. */
export function allFields(doc: PrintableDocument): PrintField[] {
  return blocksOfKind(doc, "fields").flatMap((b) => b.items);
}

export function findField(doc: PrintableDocument, label: string): PrintField {
  const item = allFields(doc).find((f) => f.label === label);
  assert.ok(item, `field "${label}" not found`);
  return item;
}

export function fieldValue(doc: PrintableDocument, label: string): string {
  const item = findField(doc, label);
  assert.ok(item.value !== undefined, `field "${label}" has no value`);
  return item.value;
}

/** True when the row is a rule to be completed by hand rather than a value. */
export function isBlankField(doc: PrintableDocument, label: string): boolean {
  const item = allFields(doc).find((f) => f.label === label);
  return !!item && item.underline === true && item.value === undefined;
}

export function chargesBlock(
  doc: PrintableDocument,
  title?: string
): BlockOf<"charges"> {
  const blocks = blocksOfKind(doc, "charges");
  const block = title ? blocks.find((b) => b.title === title) : blocks[0];
  assert.ok(block, `charges block ${title ? `"${title}" ` : ""}not found`);
  return block;
}

export function allChargeLines(doc: PrintableDocument): PrintChargeLine[] {
  return blocksOfKind(doc, "charges").flatMap((b) => b.lines);
}

export function chargeAmount(doc: PrintableDocument, label: string): string {
  const line = allChargeLines(doc).find((l) => l.label === label);
  assert.ok(line, `charge line "${label}" not found`);
  return line.amount;
}

export function hasChargeLine(doc: PrintableDocument, label: string): boolean {
  return allChargeLines(doc).some((l) => l.label === label);
}

export function tableBlock(
  doc: PrintableDocument,
  title?: string
): BlockOf<"table"> {
  const blocks = blocksOfKind(doc, "table");
  const block = title ? blocks.find((b) => b.title === title) : blocks[0];
  assert.ok(block, `table ${title ? `"${title}" ` : ""}not found`);
  return block;
}

export function hasTable(doc: PrintableDocument, title: string): boolean {
  return blocksOfKind(doc, "table").some((b) => b.title === title);
}

export function signatures(doc: PrintableDocument): PrintSignature[] {
  return blocksOfKind(doc, "signatures").flatMap((b) => b.blocks);
}

export function signatureLabels(doc: PrintableDocument): string[] {
  return signatures(doc).map((s) => s.label);
}

/** All prose in the document, joined — for asserting statutory wording. */
export function prose(doc: PrintableDocument): string {
  return blocksOfKind(doc, "paragraph")
    .map((b) => b.html)
    .join("\n");
}

export function notes(doc: PrintableDocument): string {
  return blocksOfKind(doc, "note")
    .map((b) => b.text)
    .join("\n");
}

export function notarialBody(doc: PrintableDocument): string {
  const block = blocksOfKind(doc, "notarial")[0];
  assert.ok(block, "notarial block not found");
  return block.body;
}

/**
 * What every document owes its caller, whatever the payload was.
 *
 * The signature assertion is the load-bearing one: a cooperative document is
 * not a document until someone has put their name to it, so a template that
 * forgets its sign-off block fails here rather than in front of a member.
 */
export function assertPrintableShape(
  doc: PrintableDocument,
  id: PrintableDocument["id"]
): void {
  assert.equal(doc.id, id);
  assert.ok(doc.title.length > 0, "document has no title");
  assert.ok(doc.generatedAt.length > 0, "document has no generatedAt");
  assert.ok(doc.blocks.length > 0, "document has no blocks");
  assert.equal(doc.blocks[0]?.kind, "title", "document does not open with a title");
  assert.ok(
    blocksOfKind(doc, "signatures").length > 0,
    "document has no signature block"
  );
}
