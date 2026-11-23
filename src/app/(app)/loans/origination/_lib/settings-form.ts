/**
 * The online application settings form (`PUT /loan-origination/settings`).
 * The server checks every limit and answers in words; the form sends what it
 * edits and leaves the rules to the server.
 */

import type { OriginationSettings, OriginationSettingsInput } from "@/types/loan-origination";

/** `Payslip (latest)` → `payslip_latest`: the key a new document type is saved under. */
export function documentTypeKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 50);
}

/**
 * The five sections the server takes, never what it only reports (`server`,
 * `rules_version`, who saved last). A saved document type keeps its key,
 * which applications already use; a new one is keyed from its name. The
 * server refuses a key that reads as "valid ID", in its own words.
 */
export function settingsPayload(s: OriginationSettings | OriginationSettingsInput): OriginationSettingsInput {
  return {
    general: s.general,
    products: s.products,
    assessment: s.assessment,
    documents: {
      ...s.documents,
      types: s.documents.types.map((t) => ({ ...t, type: t.type || documentTypeKey(t.label) })),
    },
    notifications: s.notifications,
  };
}

/** What can't be sent at all: a document type with no name has no key either. */
export function settingsProblems(s: OriginationSettingsInput): string[] {
  return s.documents.types.some((t) => t.label.trim() === "") ? ["Give each document type a name."] : [];
}
