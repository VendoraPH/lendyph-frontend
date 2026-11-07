import { permissionModuleName } from "@/lib/permission-module-names";

/** An example the API's `alpha_dash` username rule accepts: no dots or spaces. */
export const USERNAME_PLACEHOLDER = "juan_dc";

function actionName(action: string): string {
  return action
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** A permission key as users read it: "borrowers:view" → "Members: View". */
export function permissionChipLabel(permission: string): string {
  const [module, action] = permission.split(":");
  const name = permissionModuleName(module);
  return action ? `${name}: ${actionName(action)}` : name;
}
