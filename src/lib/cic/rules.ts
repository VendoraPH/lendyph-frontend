// The few CIC rules the screens apply themselves: what CIC accepts as a
// provider code, the default File Reference Date, and whether CIC's key may
// encrypt a file. Everything about the file's content is the backend's.
import type { CicPublicKey } from "@/types/cic";

export function isValidProviderCode(code: string): boolean {
  return /^[A-Za-z0-9]{8}$/.test(code);
}

/**
 * The File Reference Date CIC expects by default: the last day of the month
 * before `todayIso` (YYYY-MM-DD, Manila). A monthly file reports the month
 * just closed.
 */
export function defaultCicReferenceDate(todayIso: string): string {
  const [y, m] = todayIso.split("-").map(Number);
  // Day 0 of this month is the last day of the previous one.
  const last = new Date(Date.UTC(y, m - 1, 0));
  const mm = String(last.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(last.getUTCDate()).padStart(2, "0");
  return `${last.getUTCFullYear()}-${mm}-${dd}`;
}

/**
 * Why CIC's key cannot encrypt a file, or null when it can. The server
 * refuses the same keys; this says so before anyone gets that far.
 * `expires_at` is a UTC timestamp, so it is compared as an instant.
 */
export function cicKeyProblem(key: CicPublicKey | null, now: Date): string | null {
  if (!key) return "Upload CIC's public key in CIC Settings first: the file cannot be encrypted without it.";
  if (key.status === "expired" || (key.expires_at !== null && Date.parse(key.expires_at) <= now.getTime())) {
    return "CIC's public key has expired. Upload the new key CIC issued in CIC Settings.";
  }
  if (key.status !== "valid" || key.verified_at === null) {
    return "Verify CIC's public key in CIC Settings: check its fingerprint against the one CIC gave you.";
  }
  return null;
}
