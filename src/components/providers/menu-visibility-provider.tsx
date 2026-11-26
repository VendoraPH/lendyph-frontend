"use client";

import { useEffect, type ReactNode } from "react";
import { useMenuVisibilityStore } from "@/store/menu-visibility-store";

/**
 * Loads which modules Menu Visibility hides: once the (app) layout renders
 * (after sign-in), and again whenever the window regains focus, so a change
 * made in another tab or by another administrator shows on return. A failed
 * load keeps the last list and retries by itself (the store).
 */
export function MenuVisibilityProvider({ children }: { children: ReactNode }) {
  const load = useMenuVisibilityStore((s) => s.load);
  const stop = useMenuVisibilityStore((s) => s.stop);

  useEffect(() => {
    void load();
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      stop();
    };
  }, [load, stop]);

  return children;
}
