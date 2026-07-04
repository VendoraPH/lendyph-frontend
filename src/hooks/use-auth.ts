import { useAuthStore } from "@/store";

export function useAuth() {
  const {
    user,
    isAuthenticated,
    setUser,
    clearAuth,
    hasPermission,
    hasAnyPermission,
    hasRole,
  } = useAuthStore();

  return {
    user,
    isAuthenticated,
    setUser,
    clearAuth,
    hasPermission,
    hasAnyPermission,
    hasRole,
  };
}
