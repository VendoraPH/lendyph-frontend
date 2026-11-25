"use client";

import type { ReactNode } from "react";
import { env } from "@/config/env";
import { usePermission } from "@/hooks";
import { useMenuVisibility } from "@/hooks/use-menu-visibility";
import { lindaAvailable } from "@/lib/linda";

/**
 * True when Linda shows for the signed-in user: the build flag, `linda:use`,
 * and Menu Visibility not hiding her (her floating button, panel and chat go).
 */
export function useLindaAvailable(): boolean {
  const { can } = usePermission();
  const { isHidden } = useMenuVisibility();
  return lindaAvailable(env.features.linda, can, isHidden("linda"));
}

/**
 * Renders Linda's entries only for a user who may ask Linda. With
 * NEXT_PUBLIC_ENABLE_LINDA off it returns before any hook runs, so the app is
 * exactly as it is without Linda.
 */
export function LindaGate({ children }: { children: ReactNode }) {
  if (!env.features.linda) return null;
  return <LindaUseGate>{children}</LindaUseGate>;
}

function LindaUseGate({ children }: { children: ReactNode }) {
  return useLindaAvailable() ? <>{children}</> : null;
}
