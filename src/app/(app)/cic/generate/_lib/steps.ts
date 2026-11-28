// The Generate Report wizard's steps and what each one waits on. Pure, so the
// gating is tested without a browser. Every "can it" comes from the server's
// answer (the capture list, the submission's status and `actions`).
import type { FormStepDef, StepErrors } from "@/lib/form-stepper";
import type { CicSubmissionDetail } from "@/types/cic";
import { encryptBlockedReason } from "../../_lib/encrypt-gate";

export const GENERATE_STEPS: readonly FormStepDef[] = [
  {
    id: "capture",
    title: "Capture",
    description: "The month-end capture the file is built from: its records were frozen at 23:58 on the month's last day.",
    fields: ["capture_id", "correction_reason"],
  },
  {
    id: "generate",
    title: "Generate",
    description: "The server builds the file from the capture and checks it again.",
    fields: ["comments", "generate"],
  },
  {
    id: "review",
    title: "Review",
    description: "What the server will encrypt, and the key it encrypts for.",
    fields: ["confirmed"],
  },
  {
    id: "encrypt",
    title: "Encrypt",
    description: "The server zips the file and encrypts the zip with CIC's public key.",
    fields: ["encrypt"],
  },
  {
    id: "download",
    title: "Download",
    description: "Save the encrypted file, then upload it on CIC's submission portal.",
    fields: ["download"],
  },
  {
    id: "submit",
    title: "Submit",
    description: "Once the file is uploaded to CIC, mark it submitted. Record CIC's answer on the file when it arrives.",
  },
];

export interface GenerateState {
  correction: boolean;
  captureId: number | null;
  correctionReason: string;
  submission: CicSubmissionDetail | null;
  /** The reviewer ticked that the file is ready to encrypt. */
  confirmed: boolean;
  downloaded: boolean;
}

/** The open step's problem, keyed by its field, or true when the user may go on. */
export function generateStepErrors(stepId: string, s: GenerateState): StepErrors | true {
  switch (stepId) {
    case "capture":
      if (s.captureId === null) {
        return { capture_id: s.correction ? "Take or choose the correction capture." : "Choose the capture to report." };
      }
      if (s.correction && !s.correctionReason.trim()) return { correction_reason: "Say why the correction is sent." };
      return true;
    case "generate":
      return s.submission ? true : { generate: "Generate the file." };
    case "review": {
      if (!s.submission) return { confirmed: "Generate the file." };
      if (s.submission.status !== "generated") return true;
      const blocked = encryptBlockedReason(s.submission);
      if (blocked) return { confirmed: blocked };
      return s.confirmed ? true : { confirmed: "Confirm you reviewed the file before it is encrypted." };
    }
    case "encrypt":
      return s.submission && s.submission.status !== "generated" ? true : { encrypt: "Encrypt the file." };
    case "download":
      return s.downloaded || (s.submission !== null && s.submission.status !== "encrypted")
        ? true
        : { download: "Download the encrypted file." };
    default:
      return true;
  }
}
