"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store";
import { tokenManager } from "@/lib/axios-client";
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

// mousemove fires dozens of times a second. Rebuilding the timers that often
// is pure waste, so ignore activity that lands within this window of the last
// reset — the idle deadline is minutes away, a second of slack costs nothing.
const ACTIVITY_THROTTLE_MS = 1000;

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, clearAuth } = useAuthStore();
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(60);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastActivityRef = useRef(0);
  // Read by the activity listener. Kept in a ref so that showing the warning
  // does not change the listener effect's dependencies — re-running it tore
  // down the very countdown the warning had just started.
  const showWarningRef = useRef(false);

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
      showWarningRef.current = false;
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
    showWarningRef.current = false;
    setShowWarning(false);
    lastActivityRef.current = Date.now();

    // Set warning timer (fires 1 min before timeout)
    warningRef.current = setTimeout(() => {
      showWarningRef.current = true;
      setShowWarning(true);
      setCountdown(WARNING_BEFORE_MS / 1000);

      // Count down for display only. The logout itself is owned by the
      // absolute timer below, which fires at the same moment — running it
      // from inside a state updater made it a side effect React is free to
      // replay.
      countdownRef.current = setInterval(() => {
        setCountdown((prev) => (prev <= 1 ? 0 : prev - 1));
      }, 1000);
    }, timeoutMs - WARNING_BEFORE_MS);

    // Set absolute timeout as safety net
    timeoutRef.current = setTimeout(() => {
      performLogout("inactivity");
    }, timeoutMs);
  }, [isAuthenticated, isRememberMe, timeoutMs, performLogout, clearTimers]);

  const handleStaySignedIn = () => {
    showWarningRef.current = false;
    setShowWarning(false);
    resetTimer();
    // Token refresh happens on-demand: the next API call will auto-refresh
    // via the 401 interceptor in axios-client if the access token has
    // expired. We deliberately do not proactively refresh here, to avoid
    // racing the interceptor on the token-rotation endpoint.
  };

  const handleLogoutNow = () => {
    performLogout("inactivity");
  };

  // Listen for user activity
  useEffect(() => {
    if (!isAuthenticated || isRememberMe) return;

    const handleActivity = () => {
      // While the warning is up the only way back is the dialog's own button,
      // so a stray mousemove must not silently extend the session.
      if (showWarningRef.current) return;
      if (Date.now() - lastActivityRef.current < ACTIVITY_THROTTLE_MS) return;
      resetTimer();
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
  }, [isAuthenticated, isRememberMe, resetTimer, clearTimers]);

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
