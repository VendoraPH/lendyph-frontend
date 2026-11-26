import { api } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/config/api-endpoints";
import type {
  MenuVisibilityHidden,
  MenuVisibilityOverride,
  MenuVisibilitySettings,
} from "@/types/menu-visibility";

const E = API_ENDPOINTS.MENU_VISIBILITY;

/**
 * Menu Visibility. The administrator password goes only in the override's
 * request body; nothing here keeps it, and no answer carries it.
 */
export const menuVisibilityService = {
  /** The modules this deployment hides; any signed-in staff user may read it. */
  hidden: () => api.get<MenuVisibilityHidden>(E.HIDDEN),

  /** Opens Menu Visibility for this sign-in until `expires_at`. */
  override: (password: string) => api.post<MenuVisibilityOverride>(E.OVERRIDE, { password }),

  /** Ends this sign-in's override (the Lock button). */
  lock: () => api.delete<void>(E.OVERRIDE),

  /** Every module with its switch; 403 `override_required` without an override. */
  settings: () => api.get<MenuVisibilitySettings>(E.SETTINGS),

  /** Saves the switched-off keys; answers what `settings` answers. */
  save: (hidden: string[]) => api.put<MenuVisibilitySettings>(E.SETTINGS, { hidden }),
};
