// The Generate Report wizard's steps and what each one waits on. Pure, so
// the gating is tested without a browser.
import { cicKeyProblem } from "@/lib/cic/rules";
import type { CicSettings, CicSubmission } from "@/types/cic";

/**
 * The file is generated before it is reviewed: the reviewer reads the file
 * the server stored (masked), not a browser rebuild of it, and confirms it
 * before it is encrypted.
 */
export const GENERATE_STEPS = [
  "Reference Date",
  "Readiness",
  "Validation",
  "Generate",
  "Review",
  "Encrypt",
  "Download",
  "Submit",
] as const;

export type GenerateStep = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface GenerateState {
  referenceDate: string;
  submissionType: 0 | 1;
  correctsId: number | null;
  correctionReason: string;
  settings: CicSettings | null;
  recordCount: number;
  errorCount: number;
  submission: CicSubmission | null;
  /** The reviewer ticked that the previewed file is ready to encrypt. */
  reviewed: boolean;
  downloaded: boolean;
  now: Date;
}

/** Why the user cannot leave `step` yet, or null when they can. */
export function blockedReason(step: GenerateStep, s: GenerateState): string | null {
  switch (step) {
    case 0:
      if (!s.referenceDate) return "Choose the File Reference Date.";
      if (s.submissionType === 1 && s.correctsId === null) return "Choose the submission this file corrects.";
      if (s.submissionType === 1 && !s.correctionReason.trim()) return "Say why the correction is sent.";
      return null;
    case 1:
      if (!s.settings?.provider_code) return "Set the CIC provider code in CIC Settings first.";
      if (s.recordCount === 0) return "There is nothing to report as of this date.";
      return cicKeyProblem(s.settings.public_key, s.now);
    case 2:
      return s.errorCount > 0 ? "Fix every error first: CIC rejects a file with any of them." : null;
    case 3:
      return s.submission ? null : "Generate the file.";
    case 4:
      return s.reviewed ? null : "Review the file and confirm it is ready to encrypt.";
    case 5:
      return s.submission?.status === "generated" || !s.submission ? "Encrypt the file." : null;
    case 6:
      return s.downloaded ? null : "Download the encrypted file.";
    case 7:
      return null;
  }
}
