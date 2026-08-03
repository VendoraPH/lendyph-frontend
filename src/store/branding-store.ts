import { create } from "zustand";
import { brandingService } from "@/services/branding.service";

// Organization logo, shared by every <BrandLogo> (sidebar, login, register) and
// the branding settings page.
//
// This is a store rather than per-hook state because the logo has one writer
// (settings) and several readers mounted elsewhere in the tree — on public
// pages that sit outside the app providers, so a context would have to wrap the
// root to reach them. A store reaches all of them with no provider at all, and
// an upload updates every logo on screen without a reload.
//
// Deliberately NOT persisted (unlike auth/ui): a cached logo from a previous
// session would render stale on first paint before the fetch resolves.
interface BrandingState {
  logoUrl: string | null;
  loading: boolean;
  loaded: boolean;
  // Bumped on every mutation and appended to the image URL as `?v=`. The
  // backend may reuse the same storage path when a logo is replaced, so the
  // URL string alone can be identical across uploads — without this the
  // browser would serve the cached old image and the upload would still look
  // like it did nothing.
  version: number;
  load: () => Promise<void>;
  hydrate: (logoUrl: string | null) => void;
  updateLogo: (logoUrl: string | null) => void;
}

// Shared across every concurrent caller so N mounted <BrandLogo>s issue one
// request, not N (the login page alone renders two).
let inFlight: Promise<void> | null = null;

export const useBrandingStore = create<BrandingState>()((set, get) => ({
  logoUrl: null,
  loading: true,
  loaded: false,
  version: 0,

  load: async () => {
    if (get().loaded) return;
    if (inFlight) return inFlight;

    inFlight = brandingService
      .getPublic()
      .then((res) => {
        set({ logoUrl: res?.logo_url ?? null });
      })
      .catch(() => {
        // Fall back to a null logo — <BrandLogo> renders the bundled default.
        set({ logoUrl: null });
      })
      .finally(() => {
        set({ loading: false, loaded: true });
        inFlight = null;
      });

    return inFlight;
  },

  // Seed from a read. No version bump: nothing changed, so there is no cached
  // image to defeat.
  hydrate: (logoUrl) => set({ logoUrl, loading: false, loaded: true }),

  // Apply the result of an upload/delete. Bumps the version so mounted <img>
  // tags refetch even when the URL is byte-identical.
  updateLogo: (logoUrl) =>
    set((s) => ({
      logoUrl,
      loading: false,
      loaded: true,
      version: s.version + 1,
    })),
}));
