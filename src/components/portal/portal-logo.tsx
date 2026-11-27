"use client";

import { useState } from "react";
import Image from "next/image";
import { DEFAULT_LOGO, logoToShow, rememberLogoMissing } from "@/lib/portal/logo";
import { cn } from "@/lib/utils";
import { usePortalConfig } from "./portal-config";

/**
 * The cooperative's logo on member pages, from the portal's own public config
 * (`logo_url`), never through the staff client or its branding store. No
 * `logo_url`, or one that already answered 404 in this tab: the bundled logo,
 * with no request. It fills a fixed box and keeps its own shape
 * (`object-contain`), so no width or height is stretched. Nothing shows until
 * the config has answered, so the wrong logo never flashes.
 */
export function PortalLogo({ size = "sm", align = "left" }: { size?: "sm" | "lg"; align?: "left" | "center" }) {
  const { config, loaded, name } = usePortalConfig();
  const [failed, setFailed] = useState<string | null>(null);
  const box = cn("relative inline-block shrink-0", size === "lg" ? "h-12 w-44" : "h-8 w-28");
  if (!loaded) return <span aria-hidden className={box} />;
  const wanted = logoToShow(config?.logo_url);
  const src = failed === wanted ? DEFAULT_LOGO : wanted;
  return (
    <span className={box}>
      {/* `unoptimized`: the API's own file, served as it is (next.config.ts allows no remote image hosts). */}
      <Image
        src={src}
        alt={name}
        fill
        unoptimized
        className={cn("object-contain", align === "left" ? "object-left" : "object-center")}
        onError={() => {
          rememberLogoMissing(src);
          setFailed(src);
        }}
      />
    </span>
  );
}
