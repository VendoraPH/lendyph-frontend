import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * The member portal's own sources, for the guard tests: every page under
 * /member, the portal library and the member-side components. Tests are left
 * out, and so is this folder's helper. A file added later is scanned too.
 */
export const SRC = join(process.cwd(), "src");
export const MEMBER_ROOTS = ["app/member", "lib/portal", "components/portal"] as const;

function walk(path: string): string[] {
  if (!existsSync(path)) return [];
  if (!statSync(path).isDirectory()) return [path];
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const child = join(path, entry.name);
    if (entry.isDirectory()) return walk(child);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [child] : [];
  });
}

export interface Source {
  /** Relative to src/, e.g. "app/member/(auth)/login/page.tsx". */
  file: string;
  text: string;
}

export function memberSources(roots: readonly string[] = MEMBER_ROOTS): Source[] {
  return roots
    .flatMap((root) => walk(join(SRC, root)))
    .filter((path) => !path.includes(join("lib", "portal", "guards")))
    .map((path) => ({ file: relative(SRC, path), text: readFileSync(path, "utf8") }));
}

/** A line with its comments taken off; comments may name what they guard against. */
export function codeOf(line: string): string {
  const trimmed = line.trim();
  if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return "";
  return line.replace(/\s\/\/\s.*$/, "");
}

/** Every line of `text` that `pattern` finds in code, as "line N". */
export function linesMatching(text: string, pattern: RegExp): string[] {
  const found: string[] = [];
  text.split("\n").forEach((line, index) => {
    if (pattern.test(codeOf(line))) found.push(`line ${index + 1}`);
  });
  return found;
}
