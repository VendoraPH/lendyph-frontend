// The modules a permission list covers, named as users read them. Dependency-free,
// so it runs under `tsx --test`.

/** Permission module keys whose name on screen isn't the key in words. */
const MODULE_NAMES: Record<string, string> = {
  borrowers: "Members",
  gcash: "GCash",
  cda: "CDA Compliance",
};

/** A permission module key as users read it ("auto_pay" → "Auto Pay", "borrowers" → "Members"). */
export function permissionModuleName(key: string): string {
  return MODULE_NAMES[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
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
