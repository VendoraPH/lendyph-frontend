"use client";

import type { ReactNode } from "react";
import { notFound, usePathname } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";
import { useMenuVisibility } from "@/hooks/use-menu-visibility";
import { routeVisibility } from "@/lib/menu-visibility";

/**
 * The page under the app shell. A page of a module Menu Visibility hides
 * renders the app's not-found screen, direct URLs included; until the first
 * answer arrives, the page waits, so a hidden page never flashes or fires its
 * requests.
 */
export function HiddenModuleGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { loaded, isPathHidden } = useMenuVisibility();
  const state = routeVisibility(pathname, loaded, isPathHidden);
  if (state === "not_found") notFound();
  if (state === "wait") {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="h-5 w-5 text-muted-foreground" />
      </div>
    );
  }
  return children;
}
