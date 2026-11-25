/** Menu Visibility (finish run round 6): the server's answers, by `menu-visibility-contract.md`. */

/** `GET /menu-visibility/hidden`: the hidden keys, a hidden parent's children included. */
export interface MenuVisibilityHidden {
  hidden: string[];
}

/** One switchable module, as `GET` and `PUT /menu-visibility` list it. */
export interface MenuVisibilityModule {
  key: string;
  label: string;
  parent: string | null;
  /** Its own switch: off. A child of a hidden parent may still read false. */
  hidden: boolean;
}

/** `GET` and `PUT /menu-visibility`. */
export interface MenuVisibilitySettings {
  modules: MenuVisibilityModule[];
  /** When this sign-in's administrator override ends (ISO 8601). */
  override_expires_at: string | null;
}

/** `POST /menu-visibility/override`. */
export interface MenuVisibilityOverride {
  expires_at: string;
}
