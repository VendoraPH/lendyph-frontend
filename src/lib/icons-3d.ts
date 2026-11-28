/**
 * The 3D icon set, made with Higgsfield in the same style as the app's
 * pictures (`@/lib/illustrations`). Each is a 192x192 WebP with a transparent
 * background, trimmed to the object, served from `public/icons/3d/`. GCash's
 * and AMLA's (`icon-gcash`, `icon-amla`) are the client's own pictures, with
 * their edges cleaned and trimmed the same way.
 *
 * They replace the decorative feature icons (the side menu, the dashboard
 * figure cards, the report and document cards and the module headers). Line
 * icons stay in buttons, inputs, menus, table actions, badges and other
 * controls. Every 3D icon is decorative: the visible label carries the meaning.
 */
export const ICON_3D_NAMES = [
  "icon-dashboard",
  "icon-credit-score",
  "icon-portal",
  "icon-users",
  "icon-audit",
  "icon-settings",
  "icon-wallet",
  "icon-alert",
  "icon-coin",
  "icon-pie",
  "icon-trend",
  "icon-hourglass",
  "icon-transfer",
  "icon-layers",
  "icon-scale",
  "icon-signed",
  "icon-moon",
  "icon-calendar",
  "icon-gcash",
  "icon-amla",
  "empty-loans",
  "empty-members",
  "empty-payments",
  "empty-savings",
  "empty-share-capital",
  "empty-collaterals",
  "empty-wallet",
  "empty-ledger",
  "empty-compliance",
  "empty-reminders",
  "empty-documents",
  "pick-report",
] as const;

export type Icon3DName = (typeof ICON_3D_NAMES)[number];

export const ICONS_3D: Readonly<Record<Icon3DName, `/icons/3d/${Icon3DName}.webp`>> = Object.fromEntries(
  ICON_3D_NAMES.map((name) => [name, `/icons/3d/${name}.webp`]),
) as Record<Icon3DName, `/icons/3d/${Icon3DName}.webp`>;

/** The served path of a 3D icon. */
export function icon3dSrc(name: Icon3DName): string {
  return ICONS_3D[name];
}

/**
 * The soft neutral tile a side-menu icon sits on, in place of the old coloured
 * circle: white on the off-white menu in light mode, the card colour on the
 * dark menu in dark mode.
 */
export const ICON_3D_TILE_CLASS = "bg-white ring-1 ring-black/5 dark:bg-card dark:ring-white/10";
