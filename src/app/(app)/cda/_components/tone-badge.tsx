import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { STATUS_META, TONE_CLASS } from "../_lib/labels";
import type { CdaReportStatus } from "@/types/cda";

export function ToneBadge({ tone, label }: { tone: keyof typeof TONE_CLASS; label: string }) {
  return (
    <Badge variant="outline" className={cn("font-medium", TONE_CLASS[tone])}>
      {label}
    </Badge>
  );
}

export function ReportStatusBadge({ status }: { status: CdaReportStatus }) {
  const meta = STATUS_META[status];
  return <ToneBadge tone={meta.tone} label={meta.label} />;
}
