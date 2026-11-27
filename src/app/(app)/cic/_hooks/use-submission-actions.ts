"use client";

import { useState } from "react";
import { cicService } from "@/services";
import { notifyError, notifySuccess } from "@/lib/notify";
import { saveBlob } from "@/lib/save-blob";
import type { CicAcknowledgementData, CicSubmission } from "@/types/cic";

/** The encrypted file's name: the CSDF name with the PGP extension. */
export function encryptedFilename(submission: Pick<CicSubmission, "filename">): string {
  return `${submission.filename}.pgp`;
}

/**
 * Encrypt, download, mark submitted and acknowledge one submission. Shared
 * by the Generate Report wizard and the submission's own page. Each action
 * hands the updated submission to `onChange`.
 */
export function useSubmissionActions(onChange: (submission: CicSubmission) => void) {
  const [busy, setBusy] = useState<null | "encrypt" | "download" | "submit" | "acknowledge">(null);

  const encrypt = async (s: CicSubmission) => {
    setBusy("encrypt");
    try {
      const updated = await cicService.encrypt(s.id);
      notifySuccess("File encrypted with CIC's public key.");
      setBusy(null);
      onChange(updated);
    } catch (err) {
      setBusy(null);
      notifyError(err, "The file could not be encrypted.");
    }
  };

  /** Resolves true once the encrypted file is saved. */
  const download = async (s: CicSubmission): Promise<boolean> => {
    setBusy("download");
    try {
      const blob = await cicService.download(s.id);
      saveBlob(blob, encryptedFilename(s));
      setBusy(null);
      return true;
    } catch (err) {
      setBusy(null);
      notifyError(err, "The encrypted file could not be downloaded.");
      return false;
    }
  };

  const markSubmitted = async (s: CicSubmission) => {
    setBusy("submit");
    try {
      const updated = await cicService.markSubmitted(s.id);
      notifySuccess("Marked as submitted to CIC.");
      setBusy(null);
      onChange(updated);
    } catch (err) {
      setBusy(null);
      notifyError(err, "The submission could not be updated.");
    }
  };

  /** Resolves true once CIC's answer is recorded. */
  const acknowledge = async (s: CicSubmission, data: CicAcknowledgementData): Promise<boolean> => {
    setBusy("acknowledge");
    try {
      const updated = await cicService.acknowledge(s.id, data);
      notifySuccess(data.status === "accepted" ? "Recorded CIC's acceptance." : "Recorded CIC's rejection.");
      setBusy(null);
      onChange(updated);
      return true;
    } catch (err) {
      setBusy(null);
      notifyError(err, "CIC's answer could not be recorded.");
      return false;
    }
  };

  return { busy, encrypt, download, markSubmitted, acknowledge };
}
