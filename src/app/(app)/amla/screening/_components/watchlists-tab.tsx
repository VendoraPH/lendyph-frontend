"use client";

import { useState } from "react";
import { DataState } from "@/components/common/data-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useApiResource } from "@/hooks";
import { useSubmitGuard } from "@/hooks/use-submit-guard";
import { once } from "@/lib/amla/once";
import { amlaScreeningApi } from "@/lib/amla/screening-api";
import { AMLA_WATCHLIST_TEMPLATE, amlaUploadErrors, amlaWatchlistFileError, amlaWatchlistView } from "@/lib/amla/screening-view";
import { formatDateTime } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/notify";
import { saveBlob } from "@/lib/save-blob";
import type { AmlaWatchlist } from "@/types/amla-screening";

/**
 * The uploaded lists: the UN consolidated list (its XML), AMLC designations
 * and the internal list (CSV from the template). Lists come from uploads
 * only; each upload is a new version that supersedes the last.
 */
export function WatchlistsTab() {
  const [fetcher, setFetcher] = useState(() => once(() => amlaScreeningApi.lists()));
  const resource = useApiResource(fetcher);
  const reload = () => setFetcher(() => once(() => amlaScreeningApi.lists()));
  const rescreen = useSubmitGuard();

  function askRescreen() {
    rescreen
      .run(() => amlaScreeningApi.rescreen())
      ?.then(() => {
        notifySuccess("Rescreen queued", "Everyone will be screened against the lists in force on the next screening run.");
        reload();
      })
      .catch((err: unknown) => notifyError(err, "The rescreen couldn't be queued."));
  }

  return (
    <DataState resource={resource} summary="The watchlists and their versions." endpoints={["GET /amla/screening/lists"]}>
      {(lists) => (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              No list is fetched from outside: each comes from a file uploaded here.
            </p>
            <Button size="sm" variant="outline" onClick={askRescreen} disabled={rescreen.submitting}>
              {rescreen.submitting && <Spinner className="mr-2 h-4 w-4" />}
              Rescreen everyone
            </Button>
          </div>
          {lists.map((list) => (
            <WatchlistCard key={list.source} list={list} onUploaded={reload} />
          ))}
        </>
      )}
    </DataState>
  );
}

function WatchlistCard({ list, onUploaded }: { list: AmlaWatchlist; onUploaded: () => void }) {
  const view = amlaWatchlistView(list);
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState("");
  // The form's own problem, or every reason the server refused the file. They stay until the next upload or Cancel.
  const [errors, setErrors] = useState<string[]>([]);
  const { submitting, run } = useSubmitGuard();
  const inputId = `watchlist-${list.source}`;
  const [inputKey, setInputKey] = useState(0);

  function cancel() {
    setFile(null);
    setLabel("");
    setErrors([]);
    setInputKey((k) => k + 1);
  }

  function upload() {
    setErrors([]);
    const problem = amlaWatchlistFileError(list.format, file?.name ?? null);
    if (problem || !file) return setErrors([problem ?? "Pick a file."]);
    run(() => amlaScreeningApi.upload(list.source, file, file.name, label))
      ?.then((version) => {
        notifySuccess("List uploaded", `${version.entry_count} ${version.entry_count === 1 ? "entry" : "entries"}; everyone will be rescreened against it.`);
        cancel();
        onUploaded();
      })
      .catch((err: unknown) => setErrors(amlaUploadErrors(err)));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{view.title}</CardTitle>
        <CardDescription>
          {view.inForce}
          {view.rescreen ? ` ${view.rescreen}` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            upload();
          }}
        >
          <div className="space-y-1">
            <Label htmlFor={inputId}>{view.file}</Label>
            <Input
              key={inputKey}
              id={inputId}
              type="file"
              accept={list.format === "xml" ? ".xml" : ".csv"}
              disabled={submitting}
              aria-invalid={errors.length > 0}
              aria-describedby={errors.length > 0 ? `${inputId}-errors` : undefined}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${inputId}-label`}>Version label (optional)</Label>
            <Input id={`${inputId}-label`} value={label} maxLength={150} disabled={submitting} className="w-56" onChange={(e) => setLabel(e.target.value)} />
          </div>
          <Button type="submit" disabled={submitting}>
            {submitting && <Spinner className="mr-2 h-4 w-4" />}
            Upload
          </Button>
          {(file !== null || errors.length > 0) && (
            <Button type="button" variant="ghost" disabled={submitting} onClick={cancel}>
              Cancel
            </Button>
          )}
          {list.format === "csv" && (
            <Button type="button" variant="outline" onClick={() =>
                // No byte-order mark: the server reads the header row exactly.
                saveBlob(new Blob([AMLA_WATCHLIST_TEMPLATE.content], { type: "text/csv" }), AMLA_WATCHLIST_TEMPLATE.fileName)
              }>
              Download the template
            </Button>
          )}
        </form>
        {errors.length > 0 && (
          <div id={`${inputId}-errors`} role="alert" className="rounded-md border border-destructive/40 p-3 text-destructive">
            <p className="font-medium">The file wasn&apos;t accepted, and nothing from it was kept:</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {errors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </div>
        )}
        {list.versions.length > 0 && (
          <details>
            <summary className="cursor-pointer text-muted-foreground">Version history</summary>
            <ul className="mt-2 space-y-1">
              {list.versions.map((version) => (
                <li key={version.id} className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{version.version_label ?? `Version #${version.id}`}</span>
                  <Badge variant={version.status === "active" ? "secondary" : "outline"}>{version.status_words}</Badge>
                  <span className="text-muted-foreground">
                    {version.entry_count} {version.entry_count === 1 ? "entry" : "entries"}, by {version.uploaded_by?.name ?? "a former user"},{" "}
                    {formatDateTime(version.uploaded_at)}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
