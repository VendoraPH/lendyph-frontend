import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PortalMember } from "@/types/portal";
import { portalTokens } from "./portal-client";

interface PortalSessionState {
  member: PortalMember | null;
  signIn: (token: string, expiresIn: number, member: PortalMember) => void;
  setMember: (member: PortalMember) => void;
  /** Forget the member and the token; the caller sends them to sign-in. */
  signOut: () => void;
}

/**
 * The signed-in member. Separate from `useAuthStore` (staff) on purpose, with
 * its own storage key, so a staff sign-out never ends a member session and
 * the other way round.
 */
export const usePortalSession = create<PortalSessionState>()(
  persist(
    (set) => ({
      member: null,
      signIn: (token, expiresIn, member) => {
        portalTokens.set(token, expiresIn);
        set({ member });
      },
      setMember: (member) => set({ member }),
      signOut: () => {
        portalTokens.clear();
        set({ member: null });
      },
    }),
    { name: "lendy-member-auth", version: 1 },
  ),
);
