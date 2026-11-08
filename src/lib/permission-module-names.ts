// The modules a permission list covers, named as users read them. Dependency-free,
// so it runs under `tsx --test`.

/** Permission module keys whose name on screen isn't the key in words. */
const MODULE_NAMES: Record<string, string> = {
  borrowers: "Members",
  gcash: "GCash",
};

/** A permission module key as users read it ("auto_pay" → "Auto Pay", "borrowers" → "Members"). */
export function permissionModuleName(key: string): string {
  return MODULE_NAMES[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** The modules a user can view, from their `<module>:view` permissions. */
export function viewableModuleNames(permissions: readonly string[]): string[] {
  return permissions
    .filter((p) => p.endsWith(":view"))
    .map((p) => permissionModuleName(p.split(":")[0]));
}
