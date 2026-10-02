/**
 * Plain copy for a role save the API refused because of the permissions it
 * named.
 *
 * `PUT /roles/{id}` validates each permission against the ones the server
 * seeds and refuses the whole save with `permissions.N` errors ("The selected
 * permissions.11 is invalid."), which staff can't act on. This names the
 * refused permissions instead, read back from the list that was sent. Any
 * other error returns null and goes to the shared handler.
 */

const PERMISSION_KEY = /^permissions\.(\d+)$/;

function titleCase(key: string): string {
  return key
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** "credit_scoring:view" → "Credit Scoring: View". */
export function describePermission(permission: string): string {
  const [module, action] = permission.split(":");
  return action ? `${titleCase(module)}: ${titleCase(action)}` : titleCase(module);
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export function roleSaveErrorMessage(
  err: unknown,
  sentPermissions: string[],
  describe: (permission: string) => string = describePermission
): string | null {
  if (!err || typeof err !== "object" || !("response" in err)) return null;
  const response = (err as { response?: { status?: number; data?: { errors?: unknown } } }).response;
  if (response?.status !== 422) return null;

  const errors = response.data?.errors;
  if (!errors || typeof errors !== "object") return null;

  const refused: string[] = [];
  for (const key of Object.keys(errors)) {
    const match = PERMISSION_KEY.exec(key);
    if (!match) continue;
    const permission = sentPermissions[Number(match[1])];
    if (permission !== undefined && !refused.includes(permission)) refused.push(permission);
  }
  if (refused.length === 0) return null;

  const names = joinNames(refused.map(describe));
  const pronoun = refused.length === 1 ? "it" : "them";
  return `This server doesn't offer ${names} yet, so nothing was saved. Untick ${pronoun} and save again.`;
}
