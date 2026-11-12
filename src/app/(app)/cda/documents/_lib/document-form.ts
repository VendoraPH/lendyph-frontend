import type { Permission } from "@/types";
import type { CdaReportRow } from "@/types/cda";
import type { CdaDocumentSubjectType, CdaDocumentUpload } from "@/services/cda.service";
import { CATEGORY_RESTRICTION, UPLOAD_CATEGORY_LABELS, reportName } from "../../_lib/labels";
import type { RecordDraft, RecordField, RecordValues } from "../../_lib/record-form";

/**
 * The upload categories a user may pick: a restricted one (audit, tax or
 * mediation papers) only with its view. Proofs and exports come from the
 * server, never from an upload.
 */
export function uploadCategories(can: (p: Permission) => boolean): { value: string; label: string }[] {
  return Object.entries(UPLOAD_CATEGORY_LABELS)
    .filter(([key]) => !CATEGORY_RESTRICTION[key] || can(CATEGORY_RESTRICTION[key]))
    .map(([value, label]) => ({ value, label }));
}

/** The reports a document can belong to: the year's reports the user may open. */
export function reportOptions(reports: readonly CdaReportRow[]): { value: string; label: string }[] {
  return reports.filter((r) => !r.restricted).map((r) => ({ value: String(r.id), label: reportName(r.report_type, r.part) }));
}

export function uploadFields(categories: { value: string; label: string }[], reports: { value: string; label: string }[]): RecordField[] {
  return [
    { key: "title", label: "Title", type: "text", required: true },
    { key: "category", label: "Category", type: "select", required: true, options: categories },
    {
      key: "report_id",
      label: "Report",
      type: "select",
      options: reports,
      help:
        "The report this document supports, if any. A CDA Correspondence letter not linked to a report is visible to every CDA user; link it to its mediation, audit or tax report to keep it restricted.",
    },
    { key: "expires_on", label: "Expires on", type: "date", help: "Staff are reminded 30 days before." },
    { key: "version_label", label: "Version label", type: "text", placeholder: "e.g. Signed copy" },
    { key: "final", label: "This is the final version", type: "checkbox" },
    { key: "description", label: "Description", type: "textarea" },
    { key: "notes", label: "Notes on this version", type: "textarea" },
  ];
}

export const VERSION_FIELDS: RecordField[] = [
  { key: "version_label", label: "Version label", type: "text", placeholder: "e.g. Signed copy" },
  { key: "final", label: "This is the final version", type: "checkbox" },
  { key: "notes", label: "What changed", type: "textarea" },
];

/** The register row a document is attached to. */
export interface DocumentSubject {
  type: CdaDocumentSubjectType;
  id: number;
}

/** The category Attach starts on for each register; the user can change it. */
const ATTACH_CATEGORY: Record<CdaDocumentSubjectType, string> = {
  training: "officers_trainings",
  program: "social_audit",
  case: "mediation",
};

export function attachDefaults(type: CdaDocumentSubjectType): RecordDraft {
  return { category: ATTACH_CATEGORY[type], final: "1" };
}

/** A training's certificate is added from the training itself (the server refuses it here, 422). */
export function attachCategories(
  categories: { value: string; label: string }[],
  type: CdaDocumentSubjectType,
): { value: string; label: string }[] {
  return type === "training" ? categories.filter((c) => c.value !== "certificates") : categories;
}

/** The upload's body; a report is sent by its id, and a register row by its type and id. */
export function toUpload(values: RecordValues, subject?: DocumentSubject): CdaDocumentUpload {
  const text = (key: string) => (values[key] === null || values[key] === undefined ? null : String(values[key]));
  return {
    title: text("title") ?? "",
    category: text("category") ?? "",
    report_id: values.report_id === null ? null : Number(values.report_id),
    expires_on: text("expires_on"),
    version_label: text("version_label"),
    description: text("description"),
    notes: text("notes"),
    final: values.final === true,
    ...(subject ? { subject_type: subject.type, subject_id: subject.id } : {}),
  };
}
