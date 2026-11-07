"use client";

import { createContext, useCallback, useContext, useMemo } from "react";
import { useApiResource } from "@/hooks/use-api-resource";
import { portalService } from "@/services/portal.service";
import { DEFAULT_PORTAL_CONFIG, withConfigDefaults } from "@/lib/portal/default-config";
import type { PortalConfig } from "@/types/portal";

interface PortalConfigValue {
  config: PortalConfig;
  /** True once GET /portal/config has answered (or failed). */
  loaded: boolean;
  /** The endpoint is not built yet: sign-in cannot work, so say so. */
  unavailable: boolean;
}

const PortalConfigContext = createContext<PortalConfigValue>({
  config: DEFAULT_PORTAL_CONFIG,
  loaded: false,
  unavailable: false,
});

/** Loads the cooperative's portal settings once for every /member screen. */
export function PortalConfigProvider({ children }: { children: React.ReactNode }) {
  const fetcher = useCallback(() => portalService.config(), []);
  const { data, loading, unavailable } = useApiResource(fetcher);
  const value = useMemo(
    () => ({ config: withConfigDefaults(data), loaded: !loading, unavailable }),
    [data, loading, unavailable],
  );
  return <PortalConfigContext.Provider value={value}>{children}</PortalConfigContext.Provider>;
}

export function usePortalConfig(): PortalConfigValue {
  return useContext(PortalConfigContext);
}
