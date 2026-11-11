import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { COMPONENT_LABELS, labelOf } from "../_lib/labels";
import { ReadinessMeter } from "./readiness-meter";
import type { CdaReadinessBreakdown, CdaSection } from "@/types/cda";

/**
 * The server's readiness breakdown: each check counts once, and each line is
 * the server's passed, total and percent, by component and by section.
 */
export function ReadinessBreakdown({ breakdown, sections }: { breakdown: CdaReadinessBreakdown; sections: CdaSection[] }) {
  const titles = Object.fromEntries(sections.map((s) => [s.key, s.title]));
  const components = Object.entries(breakdown.by_component ?? {});
  const bySection = Object.entries(breakdown.by_section ?? {});
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Readiness checks</CardTitle>
        <CardDescription>
          {breakdown.passed} of {breakdown.total} checks pass.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {components.map(([key, bucket]) => (
          <ReadinessMeter
            key={`c-${key}`}
            value={bucket.percent}
            label={`${labelOf(COMPONENT_LABELS, key)} · ${bucket.passed} of ${bucket.total}`}
          />
        ))}
        {bySection.length > 0 && <p className="pt-1 text-xs font-medium text-muted-foreground">By section</p>}
        {bySection.map(([key, bucket]) => (
          <ReadinessMeter key={`s-${key}`} value={bucket.percent} label={`${titles[key] ?? "Other"} · ${bucket.passed} of ${bucket.total}`} />
        ))}
      </CardContent>
    </Card>
  );
}
