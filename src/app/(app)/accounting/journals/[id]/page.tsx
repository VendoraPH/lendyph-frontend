"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { RouteGuard } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { usePermission } from "@/hooks";
import { accountingService } from "@/services";
import { getErrorMessage, httpStatusOf } from "@/lib/api-error";
import { previewIsBalanced } from "@/lib/accounting/journal";
import { notifyError, notifySuccess } from "@/lib/notify";
import type { JournalEntry, JournalEntryDraft, JournalPreviewLine } from "@/types";
import { AccountingPageHeader } from "../../_components/page-header";
import { JournalActionButton } from "../_components/journal-action-button";
import { JournalDetails } from "../_components/journal-details";
import { JournalEntryForm } from "../_components/journal-entry-form";
import { PostJournalDialog } from "../_components/post-journal-dialog";
import { ReverseJournalDialog } from "../_components/reverse-journal-dialog";
import { useJournalPreview } from "../_components/use-journal-preview";
import { journalActions } from "../_lib/journal-actions";
import { draftFromEntry } from "../_lib/journal-edit";
import { journalTitle } from "../_lib/journal-register";

/** One load of the journal: the entry, or why there is none. */
interface JournalAnswer {
  key: string;
  entry: JournalEntry | null;
  /** 404: missing, or in a branch the caller can't see. */
  missing: boolean;
  error: string | null;
}

function BackButton() {
  return (
    <Button variant="outline" nativeButton={false} render={<Link href="/accounting/journals" />}>
      <ArrowLeft className="mr-2 h-4 w-4" />
      Journal Entries
    </Button>
  );
}

function NotAvailable() {
  return (
    <Card>
      <CardContent className="space-y-3 py-12 text-center">
        <p className="font-medium">This journal entry isn&apos;t available</p>
        <p className="text-sm text-muted-foreground">
          It may not exist, or it belongs to a branch you can&apos;t see.
        </p>
        <Link
          href="/accounting/journals"
          className="text-sm font-medium underline underline-offset-4"
        >
          Back to Journal Entries
        </Link>
      </CardContent>
    </Card>
  );
}

function JournalContent({ id }: { id: number }) {
  const router = useRouter();
  const { can } = usePermission();
  const [reload, setReload] = useState(0);
  const [answer, setAnswer] = useState<JournalAnswer | null>(null);
  const [editing, setEditing] = useState(false);
  const [posting, setPosting] = useState(false);
  const [reversing, setReversing] = useState(false);

  const key = `${id}#${reload}`;

  useEffect(() => {
    let current = true;
    accountingService
      .journal(id)
      .then((entry) => {
        if (current) setAnswer({ key, entry, missing: false, error: null });
      })
      .catch((err: unknown) => {
        if (!current) return;
        const missing = httpStatusOf(err) === 404;
        setAnswer({
          key,
          entry: null,
          missing,
          error: missing ? null : getErrorMessage(err, "This journal entry couldn't be loaded."),
        });
      });
    return () => {
      current = false;
    };
  }, [id, key]);

  const loading = answer?.key !== key;
  const entry = answer?.entry ?? null;

  // A draft's stored lines, checked by the server's preview so Post waits
  // until they balance. The preview needs journals:create; without it the
  // server decides when posting.
  const isDraft = entry?.status === "draft";
  const canPreview = isDraft && can("journals:create");
  const storedLines = useMemo<JournalPreviewLine[]>(
    () =>
      (entry?.status === "draft" ? entry.lines : []).map((line) => ({
        account_id: line.account_id,
        debit: line.debit,
        credit: line.credit,
      })),
    [entry],
  );
  const stored = useJournalPreview(storedLines, canPreview);
  const balanced = canPreview && stored.preview ? previewIsBalanced(stored.preview) : null;

  const actions = entry ? journalActions(entry, can, { editing, balanced }) : null;

  const showEntry = (saved: JournalEntry) =>
    setAnswer({ key, entry: saved, missing: false, error: null });

  const saveDraft = async (draft: JournalEntryDraft) => {
    try {
      showEntry(await accountingService.updateJournal(id, draft));
      setEditing(false);
      notifySuccess("Draft saved");
    } catch (err) {
      notifyError(err, "Could not save this draft.");
    }
  };

  const post = async () => {
    showEntry(await accountingService.postJournal(id));
    setPosting(false);
    notifySuccess("Entry posted");
  };

  const reverse = async (date: string, reason: string) => {
    const reversal = await accountingService.reverseJournal(id, date, reason);
    setReversing(false);
    notifySuccess("Reversing entry posted. The original is unchanged.");
    router.push(`/accounting/journals/${reversal.id}`);
  };

  if (!entry) {
    return (
      <div className="space-y-6">
        <AccountingPageHeader
          title="Journal Entry"
          description="One entry in the books, with every line."
          actions={<BackButton />}
        />
        {loading ? (
          <p className="text-sm text-muted-foreground" role="status">
            Loading the journal entry…
          </p>
        ) : answer?.missing ? (
          <NotAvailable />
        ) : (
          <Card>
            <CardContent className="space-y-3 py-12 text-center">
              <p className="text-sm text-destructive">{answer?.error}</p>
              <Button variant="outline" onClick={() => setReload((n) => n + 1)}>
                Try again
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AccountingPageHeader
        title={journalTitle(entry)}
        description={
          entry.status === "draft"
            ? "A draft. Nothing moves in the books until it is posted."
            : "Posted entries can't be edited, only reversed."
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <BackButton />
            {actions?.edit.shown && !editing && (
              <JournalActionButton
                state={actions.edit}
                variant="outline"
                onClick={() => setEditing(true)}
              >
                Edit draft
              </JournalActionButton>
            )}
            {actions?.post.shown && (
              <JournalActionButton state={actions.post} onClick={() => setPosting(true)}>
                Post entry
              </JournalActionButton>
            )}
            {actions?.reverse.shown && (
              <JournalActionButton
                state={actions.reverse}
                variant="outline"
                onClick={() => setReversing(true)}
              >
                Reverse
              </JournalActionButton>
            )}
          </div>
        }
      />

      {editing ? (
        <JournalEntryForm
          initial={draftFromEntry(entry)}
          onSave={saveDraft}
          saveLabel="Save changes"
          cancel={
            <Button variant="outline" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          }
        />
      ) : (
        <div className={loading ? "opacity-60" : undefined} aria-busy={loading}>
          <JournalDetails entry={entry} />
        </div>
      )}

      <PostJournalDialog open={posting} onOpenChange={setPosting} onConfirm={post} />
      <ReverseJournalDialog open={reversing} onOpenChange={setReversing} onConfirm={reverse} />
    </div>
  );
}

export default function JournalEntryPage() {
  const params = useParams();
  const raw = typeof params.id === "string" ? params.id : "";
  const id = /^\d+$/.test(raw) ? Number(raw) : 0;

  return (
    <RouteGuard permission="journals:view" pageName="Journal Entries">
      {id > 0 ? (
        <JournalContent key={id} id={id} />
      ) : (
        <div className="space-y-6">
          <AccountingPageHeader
            title="Journal Entry"
            description="One entry in the books, with every line."
            actions={<BackButton />}
          />
          <NotAvailable />
        </div>
      )}
    </RouteGuard>
  );
}
