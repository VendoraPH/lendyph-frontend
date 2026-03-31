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

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, clearAuth } = useAuthStore();
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(60);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const timeoutMs = env.auth.sessionTimeout * 60 * 1000; // Convert minutes to ms

  const isRememberMe =
    typeof window !== "undefined" &&
    localStorage.getItem("lendyph_remember_me") === "true";

  const clearTimers = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  const performLogout = useCallback(() => {
    clearTimers();
    setShowWarning(false);
    tokenManager.clearTokens();
    clearAuth();
    toast.info("Session expired due to inactivity");
    router.replace("/login");
  }, [clearTimers, clearAuth, router]);

  const resetTimer = useCallback(() => {
    if (!isAuthenticated || isRememberMe) return;

    clearTimers();
    setShowWarning(false);

    // Set warning timer (fires 1 min before timeout)
    warningRef.current = setTimeout(() => {
      setShowWarning(true);
      setCountdown(60);

      // Start countdown
      countdownRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            performLogout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, timeoutMs - WARNING_BEFORE_MS);

    // Set absolute timeout as safety net
    timeoutRef.current = setTimeout(() => {
      performLogout();
    }, timeoutMs);
  }, [isAuthenticated, isRememberMe, timeoutMs, performLogout, clearTimers]);

  const handleStaySignedIn = () => {
    setShowWarning(false);
    resetTimer();
  };

  const handleLogoutNow = () => {
    performLogout();
  };

  // Listen for user activity
  useEffect(() => {
    if (!isAuthenticated || isRememberMe) return;

    const handleActivity = () => {
      if (!showWarning) {
        resetTimer();
      }
    };

    ACTIVITY_EVENTS.forEach((event) => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    // Start initial timer on next tick to avoid setState-in-effect lint warning
    const id = setTimeout(() => resetTimer(), 0);
    const cleanup = () => clearTimeout(id);

    return () => {
      cleanup();
      ACTIVITY_EVENTS.forEach((event) => {
        document.removeEventListener(event, handleActivity);
      });
      clearTimers();
    };
  }, [isAuthenticated, isRememberMe, showWarning, resetTimer, clearTimers]);

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
