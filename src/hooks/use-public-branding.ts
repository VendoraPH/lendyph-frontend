// src/hooks/use-public-branding.ts
import { useEffect, useState } from "react";
import { brandingService } from "@/services/branding.service";

// Unauthenticated branding lookup used by the public register/login pages and
// the app sidebar to resolve the organization logo. Falls back to a null logo
// on error — <BrandLogo> then renders the bundled default asset.
export function usePublicBranding() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    brandingService
      .getPublic()
      .then((res) => {
        if (cancelled) return;
        setLogoUrl(res?.logo_url ?? null);
      })
      .catch(() => {
        if (cancelled) return;
        setLogoUrl(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { logoUrl, loading };
}
