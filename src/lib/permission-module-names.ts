// The modules a permission list covers, named as users read them. Dependency-free,
// so it runs under `tsx --test`.

/** Permission module keys whose name on screen isn't the key in words. */
const MODULE_NAMES: Record<string, string> = {
  borrowers: "Members",
  gcash: "GCash",
  cda: "CDA Compliance",
  amla: "AMLA Compliance",
};

/**
 * Permissions whose action reads differently from its key: the roles screen's
 * own label, so the users dialog, the audit trail and a refusal name each one
 * the same way.
 */
export const PERMISSION_ACTION_WORDS: Readonly<Record<string, string>> = {
  "loans:edit_in_approval": "Edit loans at their approval step",
  "menu_visibility:manage": "Manage menu visibility",
};

/** Short words that stay lower case in a title, unless they come first. */
const SMALL_WORDS = new Set(["of", "and", "the", "to", "for", "in", "on"]);

/**
 * A snake_case key in title case: "chart_of_accounts" → "Chart of Accounts".
 * Short words (of, and, the, to, for, in, on) stay lower case except first.
 */
export function titleCaseKey(key: string): string {
  return key
    .split("_")
    .filter(Boolean)
    .map((word, i) => (i > 0 && SMALL_WORDS.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(" ");
}

/** A permission module key as users read it ("auto_pay" → "Auto Pay", "borrowers" → "Members"). */
export function permissionModuleName(key: string): string {
  return MODULE_NAMES[key] ?? titleCaseKey(key);
}

/**
 * Modules that open only with more than their `<module>:view`, as their menu
 * section requires (`NavItem.alsoRequires` reads this): CDA Compliance covers
 * the whole cooperative, so it also needs every branch.
 */
export const MODULE_ALSO_REQUIRES: Readonly<Record<string, readonly string[]>> = {
  cda: ["branches:view_all"],
};

/**
 * The modules a user can view, from their `<module>:view` permissions, leaving
 * out a module whose other requirements they lack.
 */
export function viewableModuleNames(permissions: readonly string[]): string[] {
  const held = new Set(permissions);
  return permissions
    .filter((p) => p.endsWith(":view"))
    .map((p) => p.split(":")[0])
    .filter((module) => (MODULE_ALSO_REQUIRES[module] ?? []).every((required) => held.has(required)))
    .map((module) => permissionModuleName(module));
}
