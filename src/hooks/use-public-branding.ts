// src/hooks/use-public-branding.ts
import { useEffect } from "react";
import { useBrandingStore } from "@/store/branding-store";

// Unauthenticated branding lookup used by the public register/login pages and
// the app sidebar to resolve the organization logo. Falls back to a null logo
// on error — <BrandLogo> then renders the bundled default asset.
//
// State lives in the branding store, not here, so that uploading a logo in
// settings updates every mounted logo immediately instead of only after a
// reload. The store also de-dupes the fetch across concurrent consumers.
export function usePublicBranding() {
  const logoUrl = useBrandingStore((s) => s.logoUrl);
  const loading = useBrandingStore((s) => s.loading);
  const version = useBrandingStore((s) => s.version);

  useEffect(() => {
    // Read the action off the store rather than subscribing to it, so the
    // dependency array stays empty — the fetch runs once and the store
    // de-dupes across every mounted consumer.
    void useBrandingStore.getState().load();
  }, []);

  return { logoUrl, loading, version };
}
