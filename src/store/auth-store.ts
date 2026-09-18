import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User, Permission } from "@/types";
import { authService } from "@/services/auth.service";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  setUser: (user: User) => void;
  clearAuth: () => void;
  flagPasswordChangeRequired: () => void;
  refreshUser: () => Promise<void>;
  getPermissions: () => Permission[];
  hasPermission: (permission: Permission) => boolean;
  hasAnyPermission: (permissions: Permission[]) => boolean;
  hasRole: (role: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      setUser: (user) => set({ user, isAuthenticated: true }),
      clearAuth: () => set({ user: null, isAuthenticated: false }),
      /**
       * Record that the API has told us (via 423) the password must change.
       *
       * Needed because the flag can become true while the user is already
       * sitting in the app — an owner resets the password mid-session, or a
       * tab is reopened and rehydrates a persisted user from before the reset.
       * In both cases the store says `false` and only the 423 knows better.
       * Clearing it is deliberately NOT a setter: the only thing allowed to
       * say the lock is over is a fresh `GET /auth/me`.
       */
      flagPasswordChangeRequired: () =>
        set((state) =>
          state.user && state.user.must_change_password !== true
            ? { user: { ...state.user, must_change_password: true } }
            : state
        ),
      refreshUser: async () => {
        try {
          const fresh = await authService.me();
          set({ user: fresh, isAuthenticated: true });
        } catch {
          // swallow; caller decides whether to redirect
        }
      },
      getPermissions: () => {
        const user = get().user;
        if (!user) return [];
        return user.permissions ?? [];
      },
      hasPermission: (permission) => {
        return get().getPermissions().includes(permission);
      },
      hasAnyPermission: (permissions) => {
        const userPerms = get().getPermissions();
        return permissions.some((p) => userPerms.includes(p));
      },
      hasRole: (role) => {
        return get().user?.roles?.includes(role) ?? false;
      },
    }),
    {
      name: "lendy-auth",
    }
  )
);
