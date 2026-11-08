import { permissionModuleName } from "@/lib/permission-module-names";

/** An example the API's `alpha_dash` username rule accepts: no dots or spaces. */
export const USERNAME_PLACEHOLDER = "juan_dc";

/** Modules whose menu name isn't `permissionModuleName`'s. */
const MENU_MODULE_NAMES: Record<string, string> = { auto_pay: "Auto-Pay" };

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
  const name = MENU_MODULE_NAMES[module] ?? permissionModuleName(module);
  return action ? `${name}: ${actionName(action)}` : name;
}

/** A user's stored status in words: "active" → "Active". */
export function userStatusLabel(status: string): string {
  return actionName(status);
}
