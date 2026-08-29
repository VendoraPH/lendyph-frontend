"use client";

import { usePublicBranding } from "@/hooks/use-public-branding";
import { fileUrl, withVersion } from "@/lib/file-url";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  className?: string;
}

/**
 * Organization logo. Resolves the admin-configured logo via the public
 * branding endpoint and falls back to the bundled default asset when none is
 * set (fresh deployment / backend unavailable / read error) — so the
 * register, login, and sidebar logos always render correctly.
 *
 * Nothing is rendered until that lookup settles. The store is deliberately not
 * persisted, so every reload starts with no logo — and a deployment that has
 * uploaded its own would otherwise paint the bundled Lendy.PH mark for the
 * length of one request and then visibly swap it for theirs. Holding the box
 * empty for that beat shows the right logo once instead of the wrong one first.
 *
 * Renders a plain <img> rather than next/image on purpose: next.config.ts
 * `remotePatterns` only whitelists a single storage host, so next/image would
 * break for logos served from other deployments or localhost.
 */
export function BrandLogo({ className }: BrandLogoProps) {
  const { logoUrl, loaded, version } = usePublicBranding();

  // Same className, so the space the logo will occupy is reserved and nothing
  // around it shifts when the image arrives.
  if (!loaded) return <span aria-hidden className={cn("inline-block", className)} />;

  const src = logoUrl
    ? withVersion(fileUrl(logoUrl), version)
    : "/Logo/Lendy_logo.png";

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={siteConfig.name} className={className} />
  );
}
