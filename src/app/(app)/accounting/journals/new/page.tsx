"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { RouteGuard } from "@/components/common";
import { Button } from "@/components/ui/button";
import { accountingService } from "@/services";
import { emptyLine } from "@/lib/accounting/journal";
import { todayISO } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/notify";
import type { JournalEntryDraft } from "@/types";
import { AccountingPageHeader } from "../../_components/page-header";
import { JournalEntryForm } from "../_components/journal-entry-form";

function NewJournalEntryContent() {
  const router = useRouter();
  const [initial] = useState<JournalEntryDraft>(() => ({
    date: todayISO(),
    reference: "",
    branch_id: null,
    description: "",
    lines: [emptyLine(), emptyLine()],
  }));

  const save = async (draft: JournalEntryDraft) => {
    try {
      const saved = await accountingService.createJournal(draft);
      notifySuccess("Draft saved");
      router.push(`/accounting/journals/${saved.id}`);
    } catch (err) {
      notifyError(err, "Could not save this entry.");
    }
  };

  return (
    <div className="space-y-6">
      <AccountingPageHeader
        title="New Journal Entry"
        description="Saves as a draft. Nothing moves in the books until it is posted."
        actions={
          <Button variant="outline" nativeButton={false} render={<Link href="/accounting/journals" />}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        }
      />

      <JournalEntryForm
        initial={initial}
        onSave={save}
        saveLabel="Save draft"
        cancel={
          <Button variant="outline" nativeButton={false} render={<Link href="/accounting/journals" />}>
            Cancel
          </Button>
        }
      />
    </div>
  );
}

export default function NewJournalEntryPage() {
  return (
    <RouteGuard permission="journals:create" pageName="New Journal Entry">
      <NewJournalEntryContent />
    </RouteGuard>
  );
}
