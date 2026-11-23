"use client";

import { useState } from "react";
import { AlertTriangle, Eye, Plus } from "lucide-react";
import { DataState } from "@/components/common/data-state";
import { DisabledReason } from "@/components/common/disabled-reason";
import { ToneBadge } from "@/components/loan-origination/badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiResource, usePermission } from "@/hooks";
import { formatDateTime } from "@/lib/format";
import { loanOriginationService } from "@/services";
import type { NoticeType, OriginationNotice, OriginationNotices } from "@/types/loan-origination";
import { NOTICE_TYPES, publishBlocker, versionsOf } from "../../_lib/notices";
import { NoticeTextDialog, PublishNoticeDialog } from "./notice-dialogs";

function Published({ notice }: { notice: OriginationNotice }) {
  return (
    <span className="text-xs text-muted-foreground">
      {notice.published_at && <>Published {formatDateTime(notice.published_at)}</>}
      {notice.published_by && <> by {notice.published_by.name}</>}
    </span>
  );
}

const finalBadge = (notice: OriginationNotice) => (
  <ToneBadge tone={notice.final ? "success" : "warning"}>{notice.final ? "Final" : "Draft"}</ToneBadge>
);

function NoticeCard({
  label,
  current,
  history,
  blocker,
  onPublish,
  onView,
}: {
  label: string;
  current: OriginationNotice | null;
  history: OriginationNotice[];
  blocker: string | null;
  onPublish: () => void;
  onView: (notice: OriginationNotice) => void;
}) {
  const earlier = history.filter((n) => n.id !== current?.id);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {current ? (
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">Version {current.version}</span>
              {finalBadge(current)}
            </div>
            {current.title && <p>{current.title}</p>}
            <Published notice={current} />
          </div>
        ) : (
          <p className="text-muted-foreground">Not published yet.</p>
        )}
        <div className="flex flex-wrap gap-2">
          {current && (
            <Button size="sm" variant="outline" onClick={() => onView(current)}>
              <Eye className="mr-1 h-4 w-4" /> Read the text
            </Button>
          )}
          <DisabledReason reason={blocker}>
            <Button size="sm" variant="outline" disabled={blocker !== null} onClick={onPublish}>
              <Plus className="mr-1 h-4 w-4" /> Publish a new version
            </Button>
          </DisabledReason>
        </div>
        {earlier.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Earlier versions</p>
            <ul className="divide-y rounded-lg border">
              {earlier.map((n) => (
                <li key={n.id} className="flex flex-wrap items-center gap-2 px-2 py-1.5">
                  <span className="font-medium">Version {n.version}</span>
                  {finalBadge(n)}
                  <Published notice={n} />
                  <Button size="sm" variant="ghost" className="ml-auto" onClick={() => onView(n)}>
                    Read
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function NoticesView({ data, onChanged }: { data: OriginationNotices; onChanged: () => void }) {
  const blocker = publishBlocker(usePermission().can("branches:view_all"));
  const [publishing, setPublishing] = useState<{ type: NoticeType | "" } | null>(null);
  const [viewing, setViewing] = useState<OriginationNotice | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          The texts an applicant reads and accepts. Each version is published once and never edited or removed; the
          newest one is the current text.
        </p>
        <DisabledReason reason={blocker}>
          <Button size="sm" disabled={blocker !== null} onClick={() => setPublishing({ type: "" })}>
            <Plus className="mr-1 h-4 w-4" /> Publish a new version
          </Button>
        </DisabledReason>
      </div>
      {data.missing.length > 0 && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Not published yet: {data.missing.join(", ")}. Every application link stays closed until they are.
          </span>
        </p>
      )}
      <div className="grid gap-4 xl:grid-cols-2">
        {NOTICE_TYPES.map((t) => (
          <NoticeCard
            key={t.type}
            label={data.current[t.type]?.type_label || t.label}
            current={data.current[t.type] ?? null}
            history={versionsOf(data.versions, t.type)}
            blocker={blocker}
            onPublish={() => setPublishing({ type: t.type })}
            onView={setViewing}
          />
        ))}
      </div>
      <PublishNoticeDialog
        type={publishing?.type ?? ""}
        open={publishing !== null}
        onOpenChange={(next) => !next && setPublishing(null)}
        onDone={onChanged}
      />
      <NoticeTextDialog notice={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}

/** The Notices tab: each notice's current version, the ones still missing, and every version. */
export function NoticesSection() {
  const notices = useApiResource(loanOriginationService.listNotices);
  return (
    <DataState
      resource={notices}
      summary="The privacy notice, terms, declaration and credit authorization applicants accept will be published here."
      endpoints={["GET /loan-origination/notices", "POST /loan-origination/notices"]}
    >
      {(data) => <NoticesView data={data} onChanged={notices.refetch} />}
    </DataState>
  );
}
