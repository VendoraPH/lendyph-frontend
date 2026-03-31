"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks";
import { authService } from "@/services";
import { tokenManager } from "@/lib/axios-client";
import { SessionProvider } from "@/components/providers/session-provider";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Spinner } from "@/components/ui/spinner";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user, isAuthenticated, setUser, clearAuth } = useAuth();
  const router = useRouter();

  // Initialize auth from token on mount
  useEffect(() => {
    const initAuth = async () => {
      const token = tokenManager.getAccessToken();
      if (!token) {
        setLoading(false);
        router.replace("/login");
        return;
      }

      // If we have a token but no user in store, fetch user
      if (!user) {
        try {
          const userData = await authService.me();
          setUser(userData);
        } catch {
          // Token invalid, clear and redirect
          tokenManager.clearTokens();
          clearAuth();
          router.replace("/login");
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Redirect if not authenticated (after loading)
  useEffect(() => {
    if (!loading && !isAuthenticated && !tokenManager.getAccessToken()) {
      router.replace("/login");
    }
  }, [loading, isAuthenticated, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Spinner className="size-8 text-brand-orange" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <SessionProvider>
      <div className="flex min-h-screen">
        <Sidebar
          mobileOpen={sidebarOpen}
          onMobileClose={() => setSidebarOpen(false)}
        />
        <div className="flex flex-1 flex-col min-w-0">
          <Header onMenuClick={() => setSidebarOpen(true)} />
          <main className="flex-1 overflow-auto p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </SessionProvider>
  );
}
