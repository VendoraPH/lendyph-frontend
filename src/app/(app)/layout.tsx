"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth, usePasswordChangeGuard } from "@/hooks";
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

  // This layout wraps every authenticated route, which makes it the one place
  // a "you cannot be here yet" rule can be enforced once and hold everywhere.
  const { locked } = usePasswordChangeGuard();

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

  // `locked` is the forced password change, and it is checked HERE rather than
  // inside each page for the same reason `isAuthenticated` is: a rule enforced
  // by the layout cannot be reached around. While it holds, this returns before
  // the sidebar, the header and `children` — so there is no nav to click, no
  // route that renders, and nothing on screen to interact with, whether the
  // user arrived by deep link, by reopening a tab, or by being locked out
  // mid-session. The guard hook is redirecting them to /change-password; this
  // is what makes the gap between that decision and the navigation landing
  // empty rather than a briefly usable app.
  if (loading || !isAuthenticated || locked) {
    return null;
  }

  return (
    <SessionProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar
          mobileOpen={sidebarOpen}
          onMobileClose={() => setSidebarOpen(false)}
        />
        <div className="flex flex-1 flex-col min-w-0">
          <Header onMenuClick={() => setSidebarOpen(true)} />
          <main className="flex-1 overflow-y-auto bg-muted/40 p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </SessionProvider>
  );
}
