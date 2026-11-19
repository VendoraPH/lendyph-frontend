"use client";

import { useState } from "react";
import { useApiResource } from "@/hooks";
import { amlaMonitoringApi } from "@/lib/amla/monitoring-api";
import { once } from "@/lib/amla/once";
import type { AmlaRuleBaselines } from "@/lib/amla/settings-view";
import type { AmlaChangeRequest } from "@/types/amla";

/**
 * The rule versions a rule change is compared with, so approvers see current
 * → proposed. Each is read once, and only while the listed requests include a
 * change of its kind (both reads are logged by the server). Until they load,
 * or if they can't, the lines show the proposal alone.
 */
export function useRuleBaselines(requests: AmlaChangeRequest[] | null | undefined): AmlaRuleBaselines {
  const needsDetection = (requests ?? []).some((r) => r.type === "detection_rules");
  const needsRisk = (requests ?? []).some((r) => r.type === "risk_rules");
  const [detectionFetcher] = useState(() => once(() => amlaMonitoringApi.detectionRuleVersions()));
  const [riskFetcher] = useState(() => once(() => amlaMonitoringApi.riskRules()));
  const detection = useApiResource(detectionFetcher, needsDetection);
  const risk = useApiResource(riskFetcher, needsRisk);
  return { detection: detection.data ?? undefined, risk: risk.data?.versions };
}
