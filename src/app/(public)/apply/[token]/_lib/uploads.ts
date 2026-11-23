import type { PublicPortal } from "@/types/public-application";

/**
 * The file names each kind of content may carry (`OriginationFileStore::KINDS`):
 * the server takes JPEG, PNG or PDF only, never wider than the settings.
 */
const KINDS: readonly { kind: string; names: readonly string[] }[] = [
  { kind: "JPEG", names: ["jpg", "jpeg", "jpe", "jfif"] },
  { kind: "PNG", names: ["png"] },
  { kind: "PDF", names: ["pdf"] },
];

/** `OriginationFileStore::MAX_MB`: the most any setting allows. */
const SERVER_MAX_MB = 10;

export interface UploadRules {
  /** The file names the server takes here, lower case, without the dot. */
  extensions: string[];
  maxMb: number;
}

const normalize = (type: string) => type.trim().toLowerCase().replace(/^\./, "");

/** The link's accepted types the server takes, and its size, between 1 and 10 MB as the server reads it. */
export function uploadRules(portal: Pick<PublicPortal, "accepted_file_types" | "max_upload_mb">): UploadRules {
  const listed = portal.accepted_file_types.map(normalize);
  const known = KINDS.flatMap((k) => k.names);
  const extensions = listed.filter((t, i) => known.includes(t) && listed.indexOf(t) === i);
  const maxMb = Math.min(SERVER_MAX_MB, Math.max(1, Math.trunc(portal.max_upload_mb) || 1));
  return { extensions, maxMb };
}

/** The rule in words: "JPG, PNG, PDF, up to 5 MB each." */
export function uploadRulesText(rules: UploadRules): string {
  return `${rules.extensions.map((t) => t.toUpperCase()).join(", ")}, up to ${rules.maxMb} MB each.`;
}

/** For a file input's `accept`. */
export function uploadAccept(rules: UploadRules): string {
  return rules.extensions.map((t) => `.${t}`).join(",");
}

/** "JPEG, PNG or PDF": the kinds the extensions cover, as the server names them. */
function kindsInWords(extensions: readonly string[]): string {
  const kinds = KINDS.filter((k) => k.names.some((n) => extensions.includes(n))).map((k) => k.kind);
  return kinds.length > 1 ? `${kinds.slice(0, -1).join(", ")} or ${kinds[kinds.length - 1]}` : kinds.join("");
}

/**
 * Why the server would refuse this file, in its words, or null. The server
 * checks the content as well; this only saves an upload that can't pass.
 */
export function fileProblem(file: { name: string; size: number }, rules: UploadRules): string | null {
  if (rules.extensions.length === 0) return "Files can't be uploaded here right now. Please contact the office.";
  const dot = file.name.lastIndexOf(".");
  const extension = dot >= 0 ? file.name.slice(dot + 1).toLowerCase() : "";
  if (!rules.extensions.includes(extension)) return `Upload a ${kindsInWords(rules.extensions)} file.`;
  if (file.size === 0) return "This file is empty. Choose another.";
  if (file.size > rules.maxMb * 1024 * 1024) return `A file can be at most ${rules.maxMb} MB.`;
  return null;
}

/** How much of an upload has gone, as a whole percent, or null while its size is unknown. */
export function uploadPercent(sent: number, size: number | undefined): number | null {
  if (!size) return null;
  return Math.round((sent / size) * 100);
}
