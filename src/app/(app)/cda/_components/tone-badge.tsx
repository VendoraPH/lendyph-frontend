import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TONE_CLASS, statusMeta, type Tone } from "../_lib/labels";

export function ToneBadge({ tone, label, className }: { tone: Tone; label: string; className?: string }) {
  return (
    <Badge variant="outline" className={cn("font-medium", TONE_CLASS[tone], className)}>
      {label}
    </Badge>
  );
}

/** A report's status in words: the server's `display_status` where it sent one. */
export function ReportStatusBadge({ status }: { status: string }) {
  const meta = statusMeta(status);
  return <ToneBadge tone={meta.tone} label={meta.label} />;
}

/** "In 12 days", "Due today", "3 days overdue", or "Filed", from the server's `days_remaining`. */
export function DeadlineBadge({ daysRemaining, filed = false }: { daysRemaining: number; filed?: boolean }) {
  if (filed) return <ToneBadge tone="success" label="Filed" />;
  if (daysRemaining === 0) return <ToneBadge tone="danger" label="Due today" />;
  if (daysRemaining < 0) {
    const late = String(daysRemaining).replace("-", "");
    return <ToneBadge tone="danger" label={`${late} ${late === "1" ? "day" : "days"} overdue`} />;
  }
  const tone: Tone = daysRemaining <= 15 ? "warning" : "neutral";
  return <ToneBadge tone={tone} label={`In ${daysRemaining} ${daysRemaining === 1 ? "day" : "days"}`} />;
}
