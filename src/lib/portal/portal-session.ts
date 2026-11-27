import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { PortalFeatures, PortalMember } from "./types";
import { portalTokens } from "./portal-client";

/** The persisted member store's key, in sessionStorage. */
export const PORTAL_SESSION_STORE_KEY = "lendy-member-session";

interface PortalSessionState {
  member: PortalMember | null;
  /** The server's idle timeout for this session, in minutes. */
  idleMinutes: number;
  /** The portal parts the cooperative switched on, from `/portal/auth/me`. */
  features: PortalFeatures;
  /** True while the member owes the new terms. */
  termsRequired: boolean;
  signIn: (token: string, expiresIn: number | null, member: PortalMember, idleMinutes: number, termsRequired: boolean) => void;
  refresh: (member: PortalMember, features: PortalFeatures, idleMinutes: number, termsRequired: boolean) => void;
  setTermsRequired: (required: boolean) => void;
  /** Forgets the member and the token; the caller sends them to sign-in. */
  signOut: () => void;
}

/**
 * The signed-in member (carried over from #511 by Augustin). Separate from
 * the staff `useAuthStore`, so a staff sign-out never ends a member session
 * and the other way round. Persisted to `sessionStorage`, like the token, and
 * it holds names and switches only: never a balance.
 */
export const usePortalSession = create<PortalSessionState>()(
  persist(
    (set) => ({
      member: null,
      idleMinutes: 15,
      features: {},
      termsRequired: false,
      signIn: (token, expiresIn, member, idleMinutes, termsRequired) => {
        portalTokens.set(token, expiresIn);
        set({ member, idleMinutes, termsRequired });
      },
      refresh: (member, features, idleMinutes, termsRequired) => set({ member, features, idleMinutes, termsRequired }),
      setTermsRequired: (termsRequired) => set({ termsRequired }),
      signOut: () => {
        portalTokens.clear();
        set({ member: null, features: {}, termsRequired: false });
      },
    }),
    {
      name: PORTAL_SESSION_STORE_KEY,
      version: 1,
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
