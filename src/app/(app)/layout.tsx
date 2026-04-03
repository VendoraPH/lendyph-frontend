"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks";
import { authService } from "@/services";
import { tokenManager } from "@/lib/axios-client";
import { SessionProvider } from "@/components/providers/session-provider";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user, isAuthenticated, setUser, clearAuth } = useAuth();
  const router = useRouter();

  const initAuth = useCallback(async () => {
    const token = tokenManager.getAccessToken();

    if (!token) {
      setLoading(false);
      router.replace("/login");
      return;
    }

    // Already have user in store — no need to fetch
    if (user && isAuthenticated) {
      setLoading(false);
      return;
    }

    // Have token but no user — fetch from API
    try {
      const userData = await authService.me();
      setUser(userData);
    } catch {
      tokenManager.clearTokens();
      clearAuth();
      router.replace("/login");
    } finally {
      setLoading(false);
    }
  }, [user, isAuthenticated, setUser, clearAuth, router]);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-orange border-t-transparent" />
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
          <main className="flex-1 overflow-auto bg-muted/40 p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </SessionProvider>
  );
}
