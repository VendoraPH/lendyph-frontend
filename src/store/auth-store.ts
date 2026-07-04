import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User, Permission } from "@/types";
import { authService } from "@/services/auth.service";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  setUser: (user: User) => void;
  clearAuth: () => void;
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
