"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { useAuth, usePasswordChangeGuard } from "@/hooks";
import { useAuthStore } from "@/store";
import { authService } from "@/services";
import { tokenManager } from "@/lib/axios-client";
import { isSessionRejection, isTokenExpired } from "@/lib/session-token";
import { SessionProvider } from "@/components/providers/session-provider";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const { isAuthenticated, setUser, clearAuth } = useAuth();
  const router = useRouter();

  // This layout wraps every authenticated route, which makes it the one place
  // a "you cannot be here yet" rule can be enforced once and hold everywhere.
  const { locked } = usePasswordChangeGuard();

  const initAuth = useCallback(async () => {
    const token = tokenManager.getAccessToken();

    // No token, but the persisted user can outlive it: a session that ended
    // (the interceptor clears the tokens and leaves the user for the "Session
    // Expired" dialog) and was then reloaded, or a logout in another tab.
    // Left authenticated, this layout would render the page for a moment and
    // every one of its requests would go out with no token and 401.
    if (!token) {
      clearAuth();
      setLoading(false);
      router.replace("/login");
      return;
    }

    // A token we know has expired, e.g. a tab reopened or reloaded after the
    // user walked away. Rendering the page would fire every one of its
    // requests with it and collect a 401 from each, so go straight to login
    // without asking the API anything.
    if (isTokenExpired(tokenManager.getAccessTokenLifetime(), Date.now())) {
      tokenManager.clearTokens();
      clearAuth();
      setLoading(false);
      router.replace("/login");
      return;
    }

    // Already have the user — no need to fetch. Read from the store itself, not
    // this render's `user`: on a full page load the first render is React
    // hydrating from the store's initial, empty state, so `user` is still null
    // here even when a signed-in user is persisted, and this used to call
    // /auth/me on every load because of it.
    const stored = useAuthStore.getState();
    if (stored.user && stored.isAuthenticated) {
      setLoading(false);
      return;
    }

    // Have token but no user — fetch from API
    try {
      const userData = await authService.me();
      setUser(userData);
    } catch (err) {
      // Only a refused token ends the session. A throttled (429), failing or
      // dropped /auth/me says nothing about it, and clearing the tokens over
      // one signed people out mid-session; the next load simply asks again.
      if (isSessionRejection(axios.isAxiosError(err) ? err.response?.status : undefined)) {
        tokenManager.clearTokens();
        clearAuth();
      }
      router.replace("/login");
    } finally {
      setLoading(false);
    }
  }, [setUser, clearAuth, router]);

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
