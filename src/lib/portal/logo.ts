import { publicAssetUrl } from "./portal-client";

/** The bundled logo, shown when the cooperative has none. */
export const DEFAULT_LOGO = "/Logo/Lendy_logo.png";

const MISSING_KEY = "lendy_member_logo_missing";

function store(): Storage | null {
  return typeof sessionStorage === "undefined" ? null : sessionStorage;
}

/**
 * The logo to show for the config's `logo_url`. Without one, the bundled logo
 * straight away and no request. With one, its address, until it has answered
 * 404 once: from then on this tab shows the bundled logo without asking again.
 */
export function logoToShow(logoUrl: string | null | undefined): string {
  const src = publicAssetUrl(logoUrl);
  if (!src || store()?.getItem(MISSING_KEY) === src) return DEFAULT_LOGO;
  return src;
}

/** The logo at `src` failed to load: don't ask for it again in this tab. */
export function rememberLogoMissing(src: string): void {
  if (src !== DEFAULT_LOGO) store()?.setItem(MISSING_KEY, src);
}
