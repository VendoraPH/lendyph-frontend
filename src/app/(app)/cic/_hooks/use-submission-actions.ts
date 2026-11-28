"use client";

import { useState } from "react";
import { cicService } from "@/services";
import { notifyError, notifySuccess } from "@/lib/notify";
import { saveBlob } from "@/lib/save-blob";
import type { CicAcknowledgementData, CicSubmission } from "@/types/cic";

/**
 * Encrypt, download, mark submitted and acknowledge one submission. Shared
 * by the Generate Report wizard and the submission's own page. Each action
 * hands the updated submission to `onChange`.
 */
export function useSubmissionActions(onChange: (submission: CicSubmission) => void) {
  const [busy, setBusy] = useState<null | "encrypt" | "download" | "submit" | "acknowledge">(null);

  /** Sends the reviewer's confirmation and the key they saw; resolves true once encrypted. */
  const encrypt = async (s: CicSubmission, keyFingerprint: string): Promise<boolean> => {
    setBusy("encrypt");
    try {
      const updated = await cicService.encrypt(s.id, { confirmed: true, key_fingerprint: keyFingerprint });
      notifySuccess("File zipped and encrypted with CIC's public key.");
      setBusy(null);
      onChange(updated);
      return true;
    } catch (err) {
      setBusy(null);
      notifyError(err, "The file could not be encrypted.");
      return false;
    }
  };

  /** Resolves true once the encrypted file is saved. */
  const download = async (s: CicSubmission): Promise<boolean> => {
    setBusy("download");
    try {
      const blob = await cicService.download(s.id);
      saveBlob(blob, s.encrypted_filename ?? `${s.filename.replace(/\.txt$/, "")}.zip.gpg`);
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
