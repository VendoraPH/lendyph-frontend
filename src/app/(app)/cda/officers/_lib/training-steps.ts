import type { CdaOfficer } from "@/types/cda";
import { POSITION_LABELS, TRAINING_STATUS_LABELS, labelOf, toOptions } from "../../_lib/labels";
import type { RecordField } from "../../_lib/record-form";
import type { RecordStepGroup } from "../../_lib/record-steps";

/** A training's fields, in the form's order; the officer is picked from the year's officers. */
export function trainingFields(officers: CdaOfficer[]): RecordField[] {
  return [
    {
      key: "officer_id",
      label: "Officer",
      type: "select",
      required: true,
      options: officers.map((o) => ({ value: String(o.id), label: `${o.name ?? o.member?.name ?? "Officer"} (${labelOf(POSITION_LABELS, o.position)})` })),
    },
    { key: "title", label: "Training", type: "text", required: true },
    {
      key: "training_type",
      label: "Training type",
      type: "text",
      placeholder: "e.g. Seminar",
      help: "Up to 40 characters, such as seminar, workshop or online course.",
    },
    {
      key: "requirement_key",
      label: "Meets requirement",
      type: "text",
      placeholder: "e.g. basic_coop_course",
      help: "The training key from CDA settings that this training meets.",
    },
    { key: "is_mandatory", label: "Mandatory", type: "checkbox" },
    { key: "provider", label: "Provider", type: "text" },
    { key: "provider_accreditation_no", label: "Provider accreditation no.", type: "text" },
    { key: "started_on", label: "Started", type: "date" },
    { key: "completed_on", label: "Completed", type: "date" },
    { key: "hours", label: "Hours", type: "money", placeholder: "0.00" },
    { key: "certificate_number", label: "Certificate no.", type: "text" },
    { key: "status", label: "Status", type: "select", required: true, options: toOptions(TRAINING_STATUS_LABELS) },
    { key: "expires_on", label: "Expires", type: "date" },
    { key: "remarks", label: "Remarks", type: "textarea" },
  ];
}

/** The certificate's key in the upload (`cdaService.createTraining`) and in a 422. */
export const TRAINING_FILE_KEY = "certificate";

/** Two steps, each fitting the dialog at 1366 x 768. */
export const TRAINING_STEPS: RecordStepGroup[] = [
  {
    id: "training",
    title: "Training",
    fields: ["officer_id", "title", "training_type", "requirement_key", "is_mandatory", "provider", "provider_accreditation_no"],
  },
  {
    id: "completion",
    title: "Completion and certificate",
    fields: ["started_on", "completed_on", "hours", "certificate_number", "status", "expires_on", "remarks", TRAINING_FILE_KEY],
  },
];
