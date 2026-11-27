import Link from "next/link";
import { Pin } from "lucide-react";
import { ScrollBox } from "@/components/common/page-fill";
import { Money } from "@/components/portal/money";
import { SectionCard } from "@/components/portal/section-card";
import { formatDate } from "@/lib/format";
import { ACTIVITY_KIND, labelOf } from "@/lib/portal/labels";
import type { Dashboard } from "@/lib/portal/types";

/**
 * The latest announcements and the last money movements, as the server lists
 * them. At the `fit:` size the pair takes the height left under the cards and
 * each list scrolls inside its own card.
 */
export function DashboardLists({ data }: { data: Dashboard }) {
  const { announcements, recent_activity } = data;
  if (!announcements && !recent_activity) return null;
  return (
    <div className="grid gap-4 lg:grid-cols-2 fit:min-h-0 fit:flex-1 fit:grid-rows-[minmax(0,1fr)]">
      {recent_activity && (
        <SectionCard title="Recent activity" fill>
          {recent_activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No money has moved on your accounts yet.</p>
          ) : (
            <ScrollBox>
              <ul className="divide-y">
                {recent_activity.map((item, index) => (
                  <li key={`${item.date}-${index}`} className="flex items-start justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm break-words">{item.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {labelOf(ACTIVITY_KIND, item.kind)} · {formatDate(item.date)}
                      </p>
                    </div>
                    <Money value={item.amount} className="text-sm font-medium" />
                  </li>
                ))}
              </ul>
            </ScrollBox>
          )}
        </SectionCard>
      )}
      {announcements && (
        <SectionCard
          title="Announcements"
          fill
          action={
            <Link href="/member/announcements" className="text-xs font-medium text-primary hover:underline">
              See all
            </Link>
          }
        >
          {announcements.length === 0 ? (
            <p className="text-sm text-muted-foreground">No announcements right now.</p>
          ) : (
            <ScrollBox>
              <ul className="divide-y">
                {announcements.map((item) => (
                  <li key={item.id} className="flex items-start gap-2 py-2.5">
                    {item.pinned && <Pin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-orange" aria-label="Pinned" />}
                    <div className="min-w-0">
                      <Link href="/member/announcements" className="text-sm font-medium break-words hover:underline">
                        {item.title}
                      </Link>
                      {item.publish_at && <p className="text-xs text-muted-foreground">{formatDate(item.publish_at)}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </ScrollBox>
          )}
        </SectionCard>
      )}
    </div>
  );
}
