"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store";
import { tokenManager } from "@/lib/axios-client";
import { authService } from "@/services";
import { env } from "@/config/env";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Timer, LogOut } from "lucide-react";
import { toast } from "sonner";

const ACTIVITY_EVENTS = [
  "mousedown",
  "keydown",
  "scroll",
  "touchstart",
  "mousemove",
] as const;

const WARNING_BEFORE_MS = 60 * 1000; // Show warning 1 minute before timeout

// Proactively refresh the access token every N minutes while the user is
// active, so the backend token never expires mid-session and triggers a
// jarring 401 redirect. Set to 5 minutes — well within most backend token
// lifetimes (typically 15–60 min).
const TOKEN_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, clearAuth } = useAuthStore();
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(60);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Track last activity timestamp so we can decide whether to refresh
  const lastActivityRef = useRef<number>(Date.now());

  const timeoutMs = env.auth.sessionTimeout * 60 * 1000; // Convert minutes to ms

  const isRememberMe =
    typeof window !== "undefined" &&
    localStorage.getItem("lendy_remember_me") === "true";

  const clearTimers = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  const performLogout = useCallback(
    (reason: "inactivity" | "token_expired" = "inactivity") => {
      clearTimers();
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
      setShowWarning(false);
      tokenManager.clearTokens();
      clearAuth();
      toast.info(
        reason === "inactivity"
          ? "Session expired due to inactivity"
          : "Your session has expired. Please log in again."
      );
      router.replace("/login");
    },
    [clearTimers, clearAuth, router]
  );

  const resetTimer = useCallback(() => {
    if (!isAuthenticated || isRememberMe) return;

    clearTimers();
    setShowWarning(false);
    // Record activity
    lastActivityRef.current = Date.now();

    // Set warning timer (fires 1 min before timeout)
    warningRef.current = setTimeout(() => {
      setShowWarning(true);
      setCountdown(60);

      // Start countdown
      countdownRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            performLogout("inactivity");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, timeoutMs - WARNING_BEFORE_MS);

    // Set absolute timeout as safety net
    timeoutRef.current = setTimeout(() => {
      performLogout("inactivity");
    }, timeoutMs);
  }, [isAuthenticated, isRememberMe, timeoutMs, performLogout, clearTimers]);

  const handleStaySignedIn = () => {
    setShowWarning(false);
    resetTimer();
    // Immediately refresh the token when user clicks "Stay Signed In"
    // so the backend token is extended too
    refreshTokenSilently();
  };

  const handleLogoutNow = () => {
    performLogout("inactivity");
  };

  // Silently refresh the access token. Called periodically while the user
  // is active so the backend token never expires during an active session.
  const refreshTokenSilently = useCallback(async () => {
    try {
      const refreshToken = tokenManager.getRefreshToken();
      if (!refreshToken) return;
      const result = await authService.refresh();
      const data = result as unknown as {
        token?: string;
        data?: { token?: string; refreshToken?: string };
      };
      const newToken = data.token ?? data.data?.token;
      if (newToken) {
        tokenManager.setAccessToken(newToken);
      }
      const newRefresh = data.data?.refreshToken;
      if (newRefresh) {
        tokenManager.setRefreshToken(newRefresh);
      }
    } catch {
      // Refresh failed silently — the 401 interceptor will handle the
      // actual logout if the token is truly expired. Don't disrupt the
      // user here.
    }
  }, []);

  // Listen for user activity
  useEffect(() => {
    if (!isAuthenticated || isRememberMe) return;

    const handleActivity = () => {
      lastActivityRef.current = Date.now();
      if (!showWarning) {
        resetTimer();
      }
    };

    ACTIVITY_EVENTS.forEach((event) => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    // Start initial timer on next tick
    const id = setTimeout(() => resetTimer(), 0);

    return () => {
      clearTimeout(id);
      ACTIVITY_EVENTS.forEach((event) => {
        document.removeEventListener(event, handleActivity);
      });
      clearTimers();
    };
  }, [isAuthenticated, isRememberMe, showWarning, resetTimer, clearTimers]);

  // Proactive token refresh while active — prevents 401 from firing
  // during normal use. Refresh runs every 5 minutes, but only if the
  // user was active within the last refresh interval (don't refresh
  // tokens for idle users — let the inactivity timer handle those).
  useEffect(() => {
    if (!isAuthenticated) return;

    refreshIntervalRef.current = setInterval(() => {
      const msSinceActivity = Date.now() - lastActivityRef.current;
      // Only refresh if user was active in the last interval
      if (msSinceActivity < TOKEN_REFRESH_INTERVAL_MS) {
        refreshTokenSilently();
      }
    }, TOKEN_REFRESH_INTERVAL_MS);

    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    };
  }, [isAuthenticated, refreshTokenSilently]);

  // Listen for forced logout from the 401 interceptor. When the axios
  // client's token refresh fails, it dispatches "auth:session-expired"
  // instead of hard-redirecting. We handle it here so the user sees a
  // proper toast and the auth state is cleaned up gracefully.
  useEffect(() => {
    const handleSessionExpired = () => {
      performLogout("token_expired");
    };

    window.addEventListener("auth:session-expired", handleSessionExpired);
    return () => {
      window.removeEventListener("auth:session-expired", handleSessionExpired);
    };
  }, [performLogout]);

  if (!isAuthenticated) return <>{children}</>;

  return (
    <>
      {children}

      <Dialog open={showWarning} onOpenChange={(open) => {
        if (!open) handleStaySignedIn();
      }}>
        <DialogContent size="sm" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Timer className="h-5 w-5 text-brand-orange" />
              Session Expiring
            </DialogTitle>
            <DialogDescription>
              Your session will expire due to inactivity. You will be
              automatically logged out.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-center py-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-brand-orange">
              <span className="text-2xl font-bold text-brand-orange">
                {countdown}
              </span>
            </div>
          </div>

          <p className="text-center text-sm text-muted-foreground">
            seconds remaining
          </p>

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleLogoutNow}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout Now
            </Button>
            <Button
              className="flex-1 bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
              onClick={handleStaySignedIn}
            >
              Stay Signed In
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
