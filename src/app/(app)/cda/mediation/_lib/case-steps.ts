import { MEDIATION_STATUS_META, toOptions } from "../../_lib/labels";
import type { RecordField } from "../../_lib/record-form";
import type { RecordStepGroup } from "../../_lib/record-steps";

/** A mediation case's fields, in the form's order. */
export const CASE_FIELDS: RecordField[] = [
  { key: "filed_on", label: "Filed on", type: "date", required: true },
  { key: "status", label: "Status", type: "select", required: true, options: toOptions(MEDIATION_STATUS_META) },
  { key: "complainant", label: "Complainant", type: "text" },
  { key: "respondent", label: "Respondent", type: "text" },
  { key: "nature", label: "Nature of the dispute", type: "text" },
  { key: "mediator", label: "Mediator or conciliator", type: "text" },
  { key: "mediation_started_on", label: "Mediation started", type: "date" },
  { key: "meetings_count", label: "Meetings held", type: "number" },
  {
    key: "resolved_on",
    label: "Closed on",
    type: "date",
    help: "Needed once the case is resolved, escalated or withdrawn.",
  },
  { key: "resolution", label: "Resolution", type: "textarea" },
  { key: "description", label: "Description", type: "textarea" },
  { key: "remarks", label: "Remarks", type: "textarea" },
];

/** Two steps, each fitting the dialog at 1366 x 768. Titles are generic: case details stay in the fields. */
export const CASE_STEPS: RecordStepGroup[] = [
  {
    id: "case",
    title: "Case",
    fields: [
      "filed_on",
      "status",
      "complainant",
      "respondent",
      "nature",
      "mediator",
      "mediation_started_on",
      "meetings_count",
      "resolved_on",
    ],
  },
  { id: "resolution", title: "Resolution and remarks", fields: ["resolution", "description", "remarks"] },
];
