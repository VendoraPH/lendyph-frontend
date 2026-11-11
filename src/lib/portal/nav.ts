import type { PortalFeature, PortalFeatures } from "./types";

export type PortalNavIcon =
  | "home"
  | "loans"
  | "savings"
  | "share_capital"
  | "requests"
  | "documents"
  | "announcements"
  | "notifications"
  | "membership"
  | "profile"
  | "security"
  | "payments";

export interface PortalNavItem {
  href: string;
  label: string;
  icon: PortalNavIcon;
  /** Shown only while any of these parts of the portal is on. */
  features?: readonly PortalFeature[];
  /** One of the four phone tabs; the rest sit under "More". */
  tab?: boolean;
}

/** The member portal's pages (carried over from #511 by Augustin, cut to v1). */
export const PORTAL_NAV: readonly PortalNavItem[] = [
  { href: "/member", label: "Home", icon: "home", tab: true },
  { href: "/member/loans", label: "Loans", icon: "loans", features: ["loans"], tab: true },
  { href: "/member/savings", label: "Savings", icon: "savings", features: ["savings", "time_deposits"], tab: true },
  { href: "/member/requests", label: "Requests", icon: "requests", tab: true },
  { href: "/member/share-capital", label: "Share Capital", icon: "share_capital", features: ["share_capital"] },
  { href: "/member/payments", label: "Payments", icon: "payments", features: ["loans"] },
  { href: "/member/documents", label: "Documents", icon: "documents", features: ["documents"] },
  { href: "/member/announcements", label: "Announcements", icon: "announcements", features: ["announcements"] },
  { href: "/member/notifications", label: "Notifications", icon: "notifications" },
  { href: "/member/membership", label: "Membership", icon: "membership" },
  { href: "/member/profile", label: "Profile", icon: "profile" },
  { href: "/member/security", label: "Security", icon: "security" },
];

/** A part of the portal is on unless the server says it's off. */
export function featureOn(features: PortalFeatures, feature: PortalFeature): boolean {
  return features[feature] !== false;
}

export function visibleNav(features: PortalFeatures): PortalNavItem[] {
  return PORTAL_NAV.filter((item) => !item.features || item.features.some((f) => featureOn(features, f)));
}

export function isActivePath(pathname: string, href: string): boolean {
  return href === "/member" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}
