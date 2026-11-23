import type { Permission } from "@/types";

/**
 * Who opens and exports each AMLA report, decided as lendyph-backend's
 * `ComplianceReport::canSee` decides it (Phase 6, AMLA-B7): any of the
 * report's own keys, plus every branch for the confidential ones; exporting
 * also needs `amla:export`. The server still decides every view and file.
 */

type Can = (permission: Permission) => boolean;

export interface AmlaReportGate {
  permissions: readonly Permission[];
  headOffice: boolean;
  available: boolean;
}

export function amlaReportAccess(report: AmlaReportGate, can: Can): "open" | "no_access" | "not_found" {
  if (!report.available) return "not_found";
  const opens = report.permissions.some(can) && (!report.headOffice || can("branches:view_all"));
  return opens ? "open" : "no_access";
}

export function amlaExportAllowed(report: AmlaReportGate, can: Can): boolean {
  return amlaReportAccess(report, can) === "open" && can("amla:export");
}
