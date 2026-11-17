import type { RecordStepGroup } from "../../_lib/record-steps";

/** The file's key in the upload (`toFormData`'s default) and in a 422. */
export const UPLOAD_FILE_KEY = "file";

/**
 * Upload and Attach (`uploadFields`, 8 fields and the file) ran past 1366 x 768
 * in one dialog, the report's long help most of all: two steps, each fitting.
 */
export const UPLOAD_STEPS: RecordStepGroup[] = [
  { id: "document", title: "Document", fields: ["title", "category", "report_id", "expires_on"] },
  {
    id: "details",
    title: "Details and file",
    fields: ["version_label", "final", "description", "notes", UPLOAD_FILE_KEY],
  },
];
