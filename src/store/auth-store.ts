import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User, Permission } from "@/types";
import { authService } from "@/services/auth.service";
import { withUserBranches } from "@/lib/user-branches";

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

/** What actually survives to localStorage: the plain data, not the actions. */
type AuthPersistedState = Partial<Pick<AuthState, "user" | "isAuthenticated">>;

/** @see the `version` note on the persist config below. */
const AUTH_PERSIST_VERSION = 1;

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      // Normalised on the way in so the store's `user` always carries
      // `branches`, whichever shape the API answered with. Readers should
      // still go through `userBranches()` — this narrows the window, it does
      // not close it.
      setUser: (user) => set({ user: withUserBranches(user), isAuthenticated: true }),
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
          set({ user: withUserBranches(fresh), isAuthenticated: true });
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
      /**
       * Bumped from the implicit 0 when `user.branch` became `user.branches[]`.
       *
       * Without this, a session that signed in before multi-branch keeps its
       * old `{ branch: {...} }` blob in localStorage for as long as the tab
       * lives — there is no expiry on this key and nothing rewrites it until
       * the next login or `/auth/me`. So "the backend shipped `branches`"
       * would still not be true for already-signed-in users, and every reader
       * that assumed it would crash on them.
       */
      version: AUTH_PERSIST_VERSION,
      /**
       * v0 -> v1: map the single `branch` forward to `branches: [branch]`.
       * Runs once per stale blob; zustand re-persists the result, so the old
       * shape is gone from storage afterwards.
       */
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as AuthPersistedState;
        if (version >= AUTH_PERSIST_VERSION) return state;
        return { ...state, user: withUserBranches(state.user ?? null) };
      },
      /**
       * `migrate` only fires on a version mismatch, which is not enough on its
       * own: a user who signs in *after* this ships, against a backend that
       * still answers `branch`, persists the old shape under the CURRENT
       * version. Normalising here covers that too, since `merge` runs on every
       * rehydration.
       *
       * Spreading `currentState` first is required, not stylistic — zustand
       * calls `set(merged, true)`, replacing state wholesale, so anything this
       * drops (every action on the store) is gone.
       */
      merge: (persisted, currentState) => {
        const merged = { ...currentState, ...((persisted ?? {}) as AuthPersistedState) };
        return { ...merged, user: withUserBranches(merged.user ?? null) };
      },
    }
  )
);
