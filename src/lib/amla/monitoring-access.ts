import type { Permission } from "@/types";

/**
 * Who sees what of AMLA monitoring, decided as lendyph-backend's detection and
 * risk-rules endpoints decide it (Phase 6, AMLA-B3 and B4). Every /amla page
 * also needs `amla:view` (amla/layout.tsx). The server still decides every
 * read: alerts and candidates are branch-scoped, and a hidden one answers 404.
 */

type Can = (permission: Permission) => boolean;

export const AMLA_ALERTS_PERMISSION: Permission = "amla:alerts";
export const AMLA_CTR_PERMISSION: Permission = "amla:ctr";
/** `GET /amla/risk-rules`: any of these, with every branch. */
export const AMLA_RISK_RULES_PERMISSIONS: readonly Permission[] = ["amla:cdd", "amla:settings", "amla:audit"];

export interface AmlaMonitoringAccess {
  /** Monitoring status (`amla:view`). */
  status: boolean;
  alerts: boolean;
  ctr: boolean;
  /** The detection rules in force: `amla:view`, `amla:alerts` or `amla:settings`, with every branch. */
  detectionRules: boolean;
  /** Every detection rules version: `amla:settings` with every branch. */
  ruleHistory: boolean;
  /** Asking for a detection or risk rules change: `amla:settings` with every branch. */
  askRuleChange: boolean;
  riskRules: boolean;
  /** Linking an alert's subject to its CDD profile (`amla:cdd`). */
  customerLinks: boolean;
}

export function amlaMonitoringAccess(can: Can): AmlaMonitoringAccess {
  const view = can("amla:view");
  const headOffice = view && can("branches:view_all");
  const settingsHolder = headOffice && can("amla:settings");
  return {
    status: view,
    alerts: view && can(AMLA_ALERTS_PERMISSION),
    ctr: view && can(AMLA_CTR_PERMISSION),
    detectionRules: headOffice,
    ruleHistory: settingsHolder,
    askRuleChange: settingsHolder,
    riskRules: headOffice && AMLA_RISK_RULES_PERMISSIONS.some(can),
    customerLinks: view && can("amla:cdd"),
  };
}
