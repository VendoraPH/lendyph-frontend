"use client";

import { usePublicBranding } from "@/hooks/use-public-branding";
import { fileUrl } from "@/lib/file-url";
import { siteConfig } from "@/config/site";

interface BrandLogoProps {
  className?: string;
}

/**
 * Organization logo. Resolves the admin-configured logo via the public
 * branding endpoint and falls back to the bundled default asset when none is
 * set (fresh deployment / backend unavailable / read error) — so the
 * register, login, and sidebar logos always render correctly.
 *
 * Renders a plain <img> rather than next/image on purpose: next.config.ts
 * `remotePatterns` only whitelists a single storage host, so next/image would
 * break for logos served from other deployments or localhost.
 */
export function BrandLogo({ className }: BrandLogoProps) {
  const { logoUrl } = usePublicBranding();
  const src = logoUrl ? fileUrl(logoUrl) : "/Logo/Lendy_logo.png";

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={siteConfig.name} className={className} />
  );
}
