import type { Document } from "@/services/document.service";

type Named = Pick<Document, "id" | "label">;

/** How the Documents tab names a document: its label, else its number. */
export function documentName(doc: Named): string {
  return doc.label?.trim() || `Document #${doc.id}`;
}

/** The delete icon's accessible name. */
export function deleteDocumentLabel(doc: Named): string {
  return `Delete ${documentName(doc)}`;
}
