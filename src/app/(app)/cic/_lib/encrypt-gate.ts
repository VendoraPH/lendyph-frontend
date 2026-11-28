// Whether the file can be encrypted now, from the server's own answer: its
// `actions.encrypt` and the active key's `usable`. The browser decides nothing
// itself; this only says why the button is off.
import type { CicSubmissionDetail } from "@/types/cic";

export function encryptBlockedReason(d: Pick<CicSubmissionDetail, "status" | "active_key" | "validation" | "encryption" | "actions">): string | null {
  if (d.status !== "generated") return "This file is already encrypted.";
  if (!d.active_key) return "There is no active CIC public key. Upload CIC's key and have it verified in CIC Settings.";
  if (!d.active_key.usable) return d.active_key.unusable_reason ?? "CIC's public key can't be used to encrypt.";
  if (d.validation.errors > 0) return "The file's capture now has errors, so it can't be encrypted. Take a new capture and generate again.";
  if (!d.encryption.gpg_available) return "Encryption isn't installed on the server yet.";
  if (!d.actions.encrypt) return "You can't encrypt CIC files.";
  return null;
}
