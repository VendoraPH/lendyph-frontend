"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { DEFAULT_PASSWORD_RULES } from "@/lib/portal/password-rules";
import { portalService } from "@/lib/portal/portal-api";
import type { PortalConfig } from "@/lib/portal/types";

interface PortalConfigValue {
  config: PortalConfig | null;
  /** True once `/portal/config` has answered or failed. */
  loaded: boolean;
  /** The portal name to show, with a plain default. */
  name: string;
}

const DEFAULT_NAME = "Member Portal";

const PortalConfigContext = createContext<PortalConfigValue>({ config: null, loaded: false, name: DEFAULT_NAME });

/** The cooperative's public portal settings, loaded once for every /member page (carried over from #511 by Augustin). */
export function PortalConfigProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ config: PortalConfig | null; loaded: boolean }>({ config: null, loaded: false });

  useEffect(() => {
    let cancelled = false;
    portalService
      .config()
      .then((config) => {
        if (!cancelled) setState({ config, loaded: true });
      })
      .catch(() => {
        if (!cancelled) setState({ config: null, loaded: true });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const name = state.config?.portal_name?.trim() || DEFAULT_NAME;
  return <PortalConfigContext.Provider value={{ ...state, name }}>{children}</PortalConfigContext.Provider>;
}

export function usePortalConfig(): PortalConfigValue {
  return useContext(PortalConfigContext);
}

export function usePasswordRules() {
  return usePortalConfig().config?.password_rules ?? DEFAULT_PASSWORD_RULES;
}
