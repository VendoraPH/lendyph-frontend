import { getErrorMessage } from "@/lib/api-error";
import { CDA_PERMISSIONS } from "@/constants/rbac";
import { permissionChipLabel } from "@/app/(app)/users/_lib/user-labels";

/**
 * Some CDA refusals name a permission key ("Returning this report needs the
 * cda:review permission."). Users never see a key: a known one reads as the
 * role editor names it ("CDA Compliance: Review"), a key in brackets after
 * words that already say it is dropped, and a message that still holds an
 * unknown key gives way to the caller's own sentence.
 */

const KNOWN_KEYS: ReadonlySet<string> = new Set<string>([
  ...CDA_PERMISSIONS,
  "branches:view_all",
  "settings:view",
  "settings:update",
]);

const KEY = String.raw`[a-z][a-z_]*:[a-z][a-z_]*`;

/** The message with every permission key in words, or `fallback` when one has no words. */
export function refusalInWords(message: string, fallback: string): string {
  const text = message
    .replace(new RegExp(String.raw`\s*\(${KEY}\)`, "g"), "")
    .replace(new RegExp(String.raw`\b${KEY}\b`, "g"), (key) =>
      KNOWN_KEYS.has(key) ? `“${permissionChipLabel(key)}”` : key,
    );
  return new RegExp(String.raw`\b${KEY}\b`).test(text) ? fallback : text;
}

/** A failed CDA request in words: the server's message where it reads as one, never a raw key. */
export function cdaErrorMessage(err: unknown, fallback: string): string {
  return refusalInWords(getErrorMessage(err, fallback), fallback);
}
