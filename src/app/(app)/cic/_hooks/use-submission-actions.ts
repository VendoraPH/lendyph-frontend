"use client";

import { useState } from "react";
import { cicService } from "@/services";
import { notifyError, notifySuccess } from "@/lib/notify";
import { saveBlob } from "@/lib/save-blob";
import type { CicAcknowledgementData, CicSubmissionDetail } from "@/types/cic";

/**
 * Encrypt, download, mark submitted and acknowledge one submission, shared by
 * the Generate Report wizard and the submission's own page. Each action hands
 * the server's updated detail to `onChange`; refusals show in the server's
 * words.
 */
export function useSubmissionActions(onChange: (detail: CicSubmissionDetail) => void) {
  const [busy, setBusy] = useState<null | "encrypt" | "download" | "submit" | "acknowledge">(null);

  async function run<T>(kind: NonNullable<typeof busy>, call: () => Promise<T>, failure: string): Promise<T | null> {
    setBusy(kind);
    try {
      const result = await call();
      setBusy(null);
      return result;
    } catch (err) {
      setBusy(null);
      notifyError(err, failure);
      return null;
    }
  }

  /** Sends the reviewer's explicit confirmation; resolves true once encrypted. */
  const encrypt = async (s: CicSubmissionDetail): Promise<boolean> => {
    const updated = await run("encrypt", () => cicService.encrypt(s.id), "The file could not be encrypted.");
    if (!updated) return false;
    notifySuccess("File zipped and encrypted with CIC's public key.");
    onChange(updated);
    return true;
  };

  /** Saves the `.zip.gpg`; resolves true once saved. The count goes up on the server, so the detail reloads. */
  const download = async (s: CicSubmissionDetail): Promise<boolean> => {
    const file = await run("download", () => cicService.download(s.id), "The encrypted file could not be downloaded.");
    if (!file) return false;
    saveBlob(file.blob, file.filename ?? s.encrypted_filename ?? `${s.zip_filename}.gpg`);
    const updated = await cicService.getSubmission(s.id).catch(() => null);
    if (updated) onChange(updated);
    return true;
  };

  const markSubmitted = async (s: CicSubmissionDetail): Promise<boolean> => {
    const updated = await run("submit", () => cicService.markSubmitted(s.id), "The submission could not be updated.");
    if (!updated) return false;
    notifySuccess("Marked as submitted to CIC.");
    onChange(updated);
    return true;
  };

  /** Resolves true once CIC's answer is recorded. */
  const acknowledge = async (s: CicSubmissionDetail, data: CicAcknowledgementData): Promise<boolean> => {
    const updated = await run("acknowledge", () => cicService.acknowledge(s.id, data), "CIC's answer could not be recorded.");
    if (!updated) return false;
    notifySuccess(data.status === "accepted" ? "Recorded CIC's acceptance." : "Recorded CIC's rejection.");
    onChange(updated);
    return true;
  };

  return { busy, encrypt, download, markSubmitted, acknowledge };
}
