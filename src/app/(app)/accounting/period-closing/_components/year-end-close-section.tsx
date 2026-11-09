"use client";

import { useCallback, useMemo, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAccountingResource } from "@/hooks";
import { notifySuccess } from "@/lib/notify";
import { accountingService } from "@/services";
import type { AccountingPeriod, YearClose } from "@/types";
import { DataState } from "../../_components/data-state";
import {
  YEAR_CLOSE_FORBIDDEN,
  closeConfirmText,
  closeRefusalReasons,
  closeYearItems,
  defaultCloseYear,
  loadPreview,
  previewView,
  type PreviewLoad,
} from "../_lib/year-close";
import { YearClosePreviewPanel } from "./year-close-preview";

interface YearEndCloseSectionProps {
  periods: AccountingPeriod[];
  /** Year closes the screen has read, for the years already closed. */
  closes: YearClose[];
  /** After a close: the months, the history and this preview all change. */
  onChanged: () => void;
}

function Forbidden() {
  return (
    <div role="status" className="flex items-start gap-3 rounded-lg border bg-muted/40 p-4 text-sm">
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <p>{YEAR_CLOSE_FORBIDDEN}</p>
    </div>
  );
}

export function YearEndCloseSection({ periods, closes, onChanged }: YearEndCloseSectionProps) {
  const yearItems = useMemo(() => closeYearItems(periods, closes), [periods, closes]);
  const [picked, setPicked] = useState<string | null>(null);
  const selected =
    picked !== null && yearItems.some((item) => item.value === picked) ? picked : defaultCloseYear(yearItems);
  const year = selected === null ? null : Number(selected);

  const fetcher = useCallback(async (): Promise<PreviewLoad> => {
    if (year === null) throw new Error("No year to preview.");
    return loadPreview(year, accountingService.yearClosePreview);
  }, [year]);
  const preview = useAccountingResource(fetcher, year !== null);

  /** The confirm's words, taken from the preview it was opened on; null while closed. */
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<string[]>([]);

  const openConfirm = (text: string) => {
    setRefusal([]);
    setConfirming(text);
  };

  const close = async () => {
    if (year === null) return;
    setBusy(true);
    setRefusal([]);
    try {
      await accountingService.closeYear(year);
      setBusy(false);
      setConfirming(null);
      notifySuccess(`${year} closed.`, "Its closing entries are posted and its months closed.");
      onChanged();
    } catch (err) {
      setBusy(false);
      setRefusal(closeRefusalReasons(err, year));
      preview.refetch();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Year-end close</CardTitle>
        <CardDescription>
          Moves the year&apos;s income and expenses to net surplus, one closing entry per branch, then
          closes every month of the year.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {yearItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">Every year in the books is closed.</p>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="year-close-year">Year</Label>
              <Select
                value={selected}
                onValueChange={(value) => value != null && setPicked(value)}
                items={yearItems}
              >
                <SelectTrigger id="year-close-year" className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DataState
              resource={preview}
              summary="What closing the year would post for each branch, and anything that stops it."
              endpoints={["GET /accounting/year-closes/preview", "POST /accounting/year-closes"]}
            >
              {(load) => {
                if (load.kind === "forbidden") return <Forbidden />;
                const view = previewView(load.preview);
                return (
                  <div className="space-y-5">
                    <YearClosePreviewPanel view={view} />
                    <div className="flex justify-end">
                      <Button disabled={!view.canClose} onClick={() => openConfirm(closeConfirmText(load.preview))}>
                        Close {view.year}
                      </Button>
                    </div>
                  </div>
                );
              }}
            </DataState>
          </>
        )}

        <Dialog open={confirming !== null} onOpenChange={(open) => !open && !busy && setConfirming(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Close {year}?</DialogTitle>
              <DialogDescription>{confirming}</DialogDescription>
            </DialogHeader>
            {refusal.length > 0 && (
              <ul role="alert" className="list-disc space-y-1 pl-5 text-sm text-destructive">
                {refusal.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            )}
            <DialogFooter>
              <Button variant="outline" disabled={busy} onClick={() => setConfirming(null)}>
                Cancel
              </Button>
              <Button disabled={busy || refusal.length > 0} onClick={close}>
                {busy ? "Closing…" : `Close ${year}`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
