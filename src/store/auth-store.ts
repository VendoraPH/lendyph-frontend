import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User, Permission, Role } from "@/types";
import { ROLES } from "@/constants/rbac";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  setUser: (user: User) => void;
  clearAuth: () => void;
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
      getPermissions: () => {
        const user = get().user;
        if (!user) return [];
        // Combine user-level permissions with role-based defaults
        const userPerms = user.permissions ?? [];
        const primaryRole = user.roles?.[0] as Role | undefined;
        const rolePerms = primaryRole
          ? (ROLES[primaryRole]?.permissions ?? [])
          : [];
        const combined = new Set([...userPerms, ...rolePerms]);
        return Array.from(combined);
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
