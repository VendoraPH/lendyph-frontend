"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/store";
import {
  changePasswordUrl,
  CHANGE_PASSWORD_PATH,
  PASSWORD_CHANGE_REQUIRED_EVENT,
} from "@/lib/password-change-required";

/**
 * Holds a user whose password was reset by an administrator on
 * /change-password, and reports that fact so the caller can refuse to render
 * anything else.
 *
 * Mounted once, in the authenticated app layout, which is the only place that
 * sees every signed-in route. There are two ways in and both land here:
 *
 * 1. the store already knows — set from the login response or from
 *    `GET /auth/me`, which is how a deep link or a freshly opened tab arrives;
 * 2. the API says so mid-session — an owner resets the password while the user
 *    is working, or a tab wakes with a user persisted from before the reset. The
 *    store still says `false`; the 423 is the only thing that knows, and the
 *    axios interceptor turns it into the event listened for below.
 *
 * Returning `locked` rather than only redirecting matters. A redirect is a
 * request, not a guarantee — it is async, it can be raced by an in-flight
 * navigation, and until it lands the app would otherwise be on screen and
 * clickable. The caller uses `locked` to render nothing at all in the meantime,
 * so the lock holds from the first render rather than from the first effect.
 */
export function usePasswordChangeGuard(): { locked: boolean } {
  const router = useRouter();
  const pathname = usePathname();
  const mustChange = useAuthStore(
    // Read as `=== true`, never `!== false`: the store is persisted, so a
    // session that predates this field rehydrates with it undefined.
    (state) => state.user?.must_change_password === true
  );
  const flagPasswordChangeRequired = useAuthStore(
    (state) => state.flagPasswordChangeRequired
  );

  // Latched so that a 423 arriving before the user object is loaded is not
  // lost. `flagPasswordChangeRequired` is a no-op while `user` is null, and
  // that is exactly the window the app layout spends fetching /auth/me.
  const [sawLockedResponse, setSawLockedResponse] = useState(false);

  useEffect(() => {
    const handleLocked = () => {
      setSawLockedResponse(true);
      flagPasswordChangeRequired();
    };

    window.addEventListener(PASSWORD_CHANGE_REQUIRED_EVENT, handleLocked);
    return () => {
      window.removeEventListener(PASSWORD_CHANGE_REQUIRED_EVENT, handleLocked);
    };
  }, [flagPasswordChangeRequired]);

  const locked = mustChange || sawLockedResponse;
  const alreadyThere = pathname === CHANGE_PASSWORD_PATH;

  useEffect(() => {
    if (!locked || alreadyThere) return;

    // The query string comes off `window.location` rather than
    // `useSearchParams()` on purpose: that hook forces every page under this
    // layout into a Suspense boundary or out of static rendering at build time,
    // which is a heavy price for a string only ever read inside an effect.
    const returnTo = `${pathname}${window.location.search}`;
    router.replace(changePasswordUrl(returnTo));
  }, [locked, alreadyThere, pathname, router]);

  return { locked };
}
