import type { Permission } from "@/types";

/**
 * The Executive Dashboard's permission (Phase 6 decision 4). The backend seeds
 * it (X0); the role editor's action list gains `analytics` with the wave 0
 * screens, so until then the key is typed here by a cast. Nobody holds it
 * before X0, and the page's build flag is off anyway. The page's layout and
 * its menu item (`EXECUTIVE_DASHBOARD_NAV`) both gate on it.
 */
export const EXECUTIVE_DASHBOARD_PERMISSION = "dashboard:analytics" as Permission;
