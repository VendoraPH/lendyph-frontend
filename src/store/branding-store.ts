import { create } from "zustand";
import { brandingService } from "@/services/branding.service";
import type { BrandingSettings } from "@/services/branding.service";

// Organization identity — the logo shared by every <BrandLogo> (sidebar, login,
// register) plus the name, address, and contact line that letterhead a report,
// a printable, or a legal document.
//
// This is a store rather than per-hook state because branding has one writer
// (settings) and several readers mounted elsewhere in the tree — on public
// pages that sit outside the app providers, so a context would have to wrap the
// root to reach them. A store reaches all of them with no provider at all, and
// an upload updates every logo on screen without a reload. Non-React callers
// (report chrome, printable builders) read it with `getState()`.
//
// Deliberately NOT persisted (unlike auth/ui): a cached logo from a previous
// session would render stale on first paint before the fetch resolves. The same
// argument applies to the organization name — on a shared machine, printing the
// previous deployment's name on a document is worse than printing nothing.

/** The organization fields, normalized to the camelCase the app reads. */
export interface BrandingIdentity {
  logoUrl: string | null;
  organizationName: string | null;
  address: string | null;
  contact: string | null;
}

interface BrandingState extends BrandingIdentity {
  loading: boolean;
  loaded: boolean;
  // Bumped on every mutation and appended to the image URL as `?v=`. The
  // backend may reuse the same storage path when a logo is replaced, so the
  // URL string alone can be identical across uploads — without this the
  // browser would serve the cached old image and the upload would still look
  // like it did nothing.
  version: number;
  load: () => Promise<void>;
  hydrate: (branding: BrandingIdentity) => void;
  updateLogo: (logoUrl: string | null) => void;
  updateOrganization: (org: Omit<BrandingIdentity, "logoUrl">) => void;
}

/**
 * API payload → store shape. The three organization keys are optional on the
 * response, so an API that predates them yields nulls rather than undefined
 * leaking into the store.
 */
export function toBrandingIdentity(
  res: BrandingSettings | null | undefined
): BrandingIdentity {
  return {
    logoUrl: res?.logo_url ?? null,
    organizationName: res?.organization_name ?? null,
    address: res?.organization_address ?? null,
    contact: res?.organization_contact ?? null,
  };
}

const EMPTY: BrandingIdentity = {
  logoUrl: null,
  organizationName: null,
  address: null,
  contact: null,
};

// Shared across every concurrent caller so N mounted <BrandLogo>s issue one
// request, not N (the login page alone renders two).
let inFlight: Promise<void> | null = null;

export const useBrandingStore = create<BrandingState>()((set, get) => ({
  ...EMPTY,
  loading: true,
  loaded: false,
  version: 0,

  load: async () => {
    if (get().loaded) return;
    if (inFlight) return inFlight;

    inFlight = brandingService
      .getPublic()
      .then((res) => {
        set(toBrandingIdentity(res));
      })
      .catch(() => {
        // Fall back to no branding — <BrandLogo> renders the bundled default
        // and letterheads fall back to siteConfig.name.
        set(EMPTY);
      })
      .finally(() => {
        set({ loading: false, loaded: true });
        inFlight = null;
      });

    return inFlight;
  },

  // Seed from a read. No version bump: nothing changed, so there is no cached
  // image to defeat.
  hydrate: (branding) => set({ ...branding, loading: false, loaded: true }),

  // Apply the result of an upload/delete. Bumps the version so mounted <img>
  // tags refetch even when the URL is byte-identical.
  updateLogo: (logoUrl) =>
    set((s) => ({
      logoUrl,
      loading: false,
      loaded: true,
      version: s.version + 1,
    })),

  // Apply the result of a details save. No version bump — text has no cache to
  // bust, and bumping would make every mounted logo refetch for nothing.
  updateOrganization: (org) => set({ ...org, loading: false, loaded: true }),
}));
