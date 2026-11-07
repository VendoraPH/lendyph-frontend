import { formatDateTime } from "@/lib/format";
import { humanize } from "@/lib/portal/labels";
import type { PortalTimelineEntry } from "@/types/portal";

/** The steps a request or application has been through, oldest first. */
export function RequestTimeline({
  entries,
  labels,
}: {
  entries: PortalTimelineEntry[];
  /** Status labels for entries the server sent without one. */
  labels?: Record<string, { label: string }>;
}) {
  if (entries.length === 0) return null;
  return (
    <ol className="space-y-2 border-l pl-4">
      {entries.map((e, i) => (
        <li key={`${e.at}-${i}`} className="relative text-sm">
          <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-brand-orange" aria-hidden />
          <p>{e.label || labels?.[e.status]?.label || humanize(e.status)}</p>
          <p className="text-xs text-muted-foreground">{formatDateTime(e.at)}</p>
        </li>
      ))}
    </ol>
  );
}
