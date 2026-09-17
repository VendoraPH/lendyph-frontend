"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, LogOut, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { BrandLogo, PoweredByLendy } from "@/components/common";
import { ChangePasswordForm } from "@/components/common/change-password-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks";
import { tokenManager } from "@/lib/axios-client";
import { notifyError } from "@/lib/notify";
import { RETURN_PATH_PARAM, safeReturnPath } from "@/lib/password-change-required";
import { authService } from "@/services";

/**
 * The forced password change.
 *
 * Lives under `(auth)` rather than `(app)` for one structural reason: that
 * group has no layout of its own, so it renders inside the root layout alone —
 * no sidebar, no header, no command palette, no breadcrumb. There is no nav to
 * suppress because none is ever mounted. The only two ways off this page are
 * completing the change and the Log out button below.
 *
 * The other half of the lock lives in `(app)/layout.tsx`, which refuses to
 * render any authenticated route while the flag is set. This page is where a
 * locked user is sent; that layout is what stops them going anywhere else.
 */
export default function ChangePasswordPage() {
  const router = useRouter();
  const { user, setUser, clearAuth } = useAuth();

  const [checking, setChecking] = useState(true);

  /**
   * Where to go once the lock lifts, read at the moment of leaving.
   *
   * Read straight off `window.location` rather than `useSearchParams()`,
   * because that hook forces a client page into a Suspense boundary at build
   * time or fails the prerender outright. Read on demand rather than into
   * state, because this page never navigates until it is leaving for good, so
   * the query string cannot have changed — and holding it in state would mean
   * a setState in an effect body, and a render for a value nothing renders.
   */
  const readReturnPath = useCallback(
    () =>
      safeReturnPath(
        new URLSearchParams(window.location.search).get(RETURN_PATH_PARAM)
      ),
    []
  );

  const leaveFor = useCallback(
    (path: string) => {
      // `replace`, never `push`: the locked screen must not sit in history as
      // somewhere Back can return to once the password has been changed.
      router.replace(path);
    },
    [router]
  );

  // Confirm the lock is real before showing the form. A user who reaches this
  // URL by hand, or who keeps it open after changing their password elsewhere,
  // is waved through to the app rather than trapped on a screen with nothing
  // to do. `GET /auth/me` is allowlisted by the backend while locked, so this
  // is the one call that still works.
  useEffect(() => {
    let cancelled = false;

    const verify = async () => {
      if (!tokenManager.getAccessToken()) {
        leaveFor("/login");
        return;
      }

      if (user) {
        if (user.must_change_password === true) {
          if (!cancelled) setChecking(false);
        } else {
          leaveFor(readReturnPath());
        }
        return;
      }

      // No user in the store — a hard refresh straight onto this URL. The
      // (auth) group has no layout fetching /auth/me, so it is fetched here.
      try {
        const fresh = await authService.me();
        if (cancelled) return;
        setUser(fresh);
        if (fresh.must_change_password === true) {
          setChecking(false);
        } else {
          leaveFor(readReturnPath());
        }
      } catch {
        if (cancelled) return;
        // Even /auth/me failed, so the token is gone or dead — there is no
        // session left to change a password on.
        tokenManager.clearTokens();
        clearAuth();
        toast.info("Your session has expired. Please sign in again.");
        leaveFor("/login");
      }
    };

    verify();
    return () => {
      cancelled = true;
    };
  }, [user, setUser, clearAuth, leaveFor, readReturnPath]);

  /**
   * The token stays valid across the change, so there is no re-login: refetch
   * the canonical user to clear the flag and carry on where they were headed.
   */
  const handleChanged = async () => {
    try {
      const fresh = await authService.me();
      setUser(fresh);
      if (fresh.must_change_password === true) {
        // The API accepted the change but still reports the lock. Say so
        // plainly rather than bouncing them into an app that will 423.
        toast.error(
          "Your password changed, but this account is still locked. Please contact your administrator."
        );
        return;
      }
      leaveFor(readReturnPath());
    } catch (err) {
      notifyError(
        err,
        "Your password was changed, but we couldn't reload your account. Please sign in again."
      );
    }
  };

  const handleLogout = async () => {
    // Mirrors the header's logout: the backend call is best-effort (and is one
    // of the three routes still allowed while locked), local cleanup is not.
    try {
      await authService.logout();
    } catch {
      /* ignore — local cleanup runs unconditionally below */
    }
    tokenManager.clearTokens();
    localStorage.removeItem("lendy_remember_me");
    clearAuth();
    toast.success("Logged out");
    router.replace("/login");
  };

  if (checking) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        role="status"
        aria-label="Checking your account"
      >
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
      </div>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-muted/40 px-4 py-10">
      <div className="flex flex-col items-center gap-2">
        <BrandLogo className="h-16 w-auto" />
        <p className="text-sm text-muted-foreground">Lending Management Platform</p>
      </div>

      <Card className="w-full max-w-md">
        <CardContent className="space-y-6 pt-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-orange/10">
              <ShieldAlert className="h-6 w-6 text-brand-orange" aria-hidden="true" />
            </div>
            <div className="space-y-1.5">
              <h1 className="text-xl font-bold tracking-tight">
                Set a new password
              </h1>
              {/* The explanation is ours, not the server's. The 423 body says
                  the same thing, but it arrives on requests the user never sees
                  and it is a toast, not a page. */}
              <p className="text-sm text-muted-foreground">
                Your password was reset by an administrator. Choose a new one to
                continue — until you do, the rest of the app is unavailable.
              </p>
            </div>
            {user && (
              <p className="text-xs text-muted-foreground">
                Signed in as <span className="font-medium">{user.email || user.username}</span>
              </p>
            )}
          </div>

          <ChangePasswordForm
            layout="stacked"
            autoFocus
            currentPasswordLabel="Temporary Password"
            currentPasswordPlaceholder="The password your administrator gave you"
            submitLabel="Update password and continue"
            submitVariant="default"
            submitFullWidth
            submitClassName="h-11 bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
            successMessage="Password updated. Other active sessions have been signed out."
            onSuccess={handleChanged}
            footerNote={
              // The length rule is already on the field that enforces it; this
              // says only the thing the form cannot show, and says it before
              // the button rather than under it.
              <div className="flex items-start gap-2 rounded-lg border border-border bg-background p-3">
                <KeyRound
                  className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <p className="text-xs text-muted-foreground">
                  Your other signed-in sessions will be signed out.
                </p>
              </div>
            }
          />
        </CardContent>
      </Card>

      {/* The only way off this page other than finishing. Deliberately present
          and deliberately the quieter of the two actions. */}
      <Button variant="ghost" size="sm" className="gap-2" onClick={handleLogout}>
        <LogOut className="h-4 w-4" aria-hidden="true" />
        Log out
      </Button>

      <PoweredByLendy />
    </main>
  );
}
