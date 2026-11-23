"use client";

import { RouteGuard } from "@/components/common/route-guard";
import { AMLA_RISK_RULES_PERMISSIONS } from "@/lib/amla/monitoring-access";
import { RiskRulesScreen } from "../_components/risk-rules-screen";

/** Any of amla:cdd, amla:settings or amla:audit, with every branch, as `GET /amla/risk-rules` needs. */
export default function AmlaRiskRulesPage() {
  return (
    <RouteGuard permission={[...AMLA_RISK_RULES_PERMISSIONS]} pageName="Risk Rules">
      <RouteGuard permission="branches:view_all" pageName="Risk Rules">
        <RiskRulesScreen />
      </RouteGuard>
    </RouteGuard>
  );
}
