import { useAuthStore } from "@/store";

export function useAuth() {
  const { user, isAuthenticated, setUser, clearAuth } = useAuthStore();

  return {
    user,
    isAuthenticated,
    setUser,
    clearAuth,
  };
}
