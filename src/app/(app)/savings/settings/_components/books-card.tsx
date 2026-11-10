"use client";

import { useState } from "react";
import { BookCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePermission } from "@/hooks";
import { useSubmitGuard } from "@/hooks/use-submit-guard";
import { notifyError, notifySuccess, notifyWarning } from "@/lib/notify";
import { savingsService } from "@/services";
import type { PrepareBooksResult, SavingsSettings } from "@/types";
import { ActionButton } from "../../_components/action-button";
import { prepareBooksBlocker, prepareBooksSummary } from "../_lib/settings-form";

interface BooksCardProps {
  settings: SavingsSettings;
  onPrepared: () => void;
}

/**
 * Savings needs its accounts (2050, 2060, 5160, 2210) and posting roles in
 * the chart before a product can be turned on. While `books_ready` is false
 * this lists what's missing, in the server's words, and offers to set it up.
 * Servers before S6 send no `books_ready`, and the card stays hidden.
 */
export function BooksCard({ settings, onPrepared }: BooksCardProps) {
  const { can } = usePermission();
  const { submitting, run } = useSubmitGuard();
  const [result, setResult] = useState<PrepareBooksResult | null>(null);
  const blocker = prepareBooksBlocker(can);

  if (settings.books_ready !== false && result === null) return null;

  function prepare() {
    run(() => savingsService.prepareBooks())
      ?.then((done) => {
        setResult(done);
        if (done.books_ready) notifySuccess("Savings is set up in the books");
        else notifyWarning("Some of the savings books still need setting up", (done.books_missing ?? []).join(" "));
        onPrepared();
      })
      .catch((err: unknown) => {
        // 422 (no chart yet) and 409 (pressed twice at once) come in the server's words.
        notifyError(err, "Couldn't set up savings in the books.");
        onPrepared();
      });
  }

  const summary = result ? prepareBooksSummary(result) : [];
  const missing = settings.books_missing ?? [];

  return (
    <Card className="border-amber-300 dark:border-amber-800 lg:col-span-2" role="region" aria-labelledby="books-title">
      <CardHeader>
        <CardTitle id="books-title" className="text-base">
          {settings.books_ready === false ? "Savings isn't set up in the books yet" : "Savings books"}
        </CardTitle>
        <CardDescription>
          A savings product can be turned on only once the chart of accounts has its savings accounts and posting
          roles.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {settings.books_ready === false && missing.length > 0 && (
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {missing.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
        {summary.length > 0 && (
          <div className="space-y-3 rounded-md border bg-muted/40 p-3 text-sm" aria-live="polite">
            {summary.map((group) => (
              <div key={group.heading}>
                <p className="font-medium">{group.heading}</p>
                <ul className="list-disc space-y-0.5 pl-5">
                  {group.lines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
        {settings.books_ready === false && (
          <ActionButton
            permission="savings:settings"
            onClick={prepare}
            disabled={submitting}
            blockedReason={blocker}
          >
            <BookCheck className="h-4 w-4" /> {submitting ? "Setting up…" : "Set up savings in the books"}
          </ActionButton>
        )}
      </CardContent>
    </Card>
  );
}
