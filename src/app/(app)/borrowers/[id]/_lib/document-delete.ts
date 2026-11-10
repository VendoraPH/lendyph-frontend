import type { Document } from "@/services/document.service";
import type { BorrowerValidId } from "@/services/borrower.service";
import { VALID_ID_OPTIONS } from "@/constants";

type Named = Pick<Document, "id" | "label">;
type NamedId = Pick<BorrowerValidId, "type" | "custom_type_name" | "id_number">;

/** How the Documents tab names a document: its label, else its number. */
export function documentName(doc: Named): string {
  return doc.label?.trim() || `Document #${doc.id}`;
}

/** The delete icon's accessible name. */
export function deleteDocumentLabel(doc: Named): string {
  return `Delete ${documentName(doc)}`;
}

/** A valid ID's type in words: the picker's label, or the name typed for "Others". */
export function validIdLabel(entry: NamedId): string {
  if (entry.type === "others") return entry.custom_type_name || "Others";
  return VALID_ID_OPTIONS.find((o) => o.value === entry.type)?.label ?? entry.custom_type_name ?? entry.type;
}

/** A valid ID's type with its number, so two IDs of one type read apart. */
export function validIdName(entry: NamedId): string {
  const number = entry.id_number?.trim();
  return number ? `${validIdLabel(entry)} ${number}` : validIdLabel(entry);
}

/** The valid ID delete icon's accessible name. */
export function deleteValidIdLabel(entry: NamedId): string {
  return `Delete ${validIdName(entry)}`;
}
