"use client";

import { useMemo } from "react";
import { moduleHidden, moduleForPath } from "@/constants/menu-modules";
import { SIDEBAR_NAV, visibleNav, type NavItem } from "@/constants/navigation";
import { useMenuVisibilityStore } from "@/store/menu-visibility-store";

export interface MenuVisibility {
  /** True once the first load has answered or failed. */
  loaded: boolean;
  /** Whether a module is hidden (it, or its parent). */
  isHidden: (key: string | null | undefined) => boolean;
  /** Whether the page at `pathname` belongs to a hidden module. */
  isPathHidden: (pathname: string) => boolean;
}

/**
 * Which modules Menu Visibility hides, from the visibility source the (app)
 * layout loads. Re-renders when the list changes.
 */
export function useMenuVisibility(): MenuVisibility {
  const hidden = useMenuVisibilityStore((s) => s.hidden);
  const loaded = useMenuVisibilityStore((s) => s.loaded);
  return useMemo(() => {
    const set = new Set(hidden);
    const isHidden = (key: string | null | undefined) => moduleHidden(key, set);
    return { loaded, isHidden, isPathHidden: (pathname: string) => isHidden(moduleForPath(pathname)) };
  }, [hidden, loaded]);
}

/** The side menu without hidden modules; permissions are still checked by each consumer. */
export function useVisibleNav(): NavItem[] {
  const { isHidden } = useMenuVisibility();
  return useMemo(() => visibleNav(SIDEBAR_NAV, isHidden), [isHidden]);
}
