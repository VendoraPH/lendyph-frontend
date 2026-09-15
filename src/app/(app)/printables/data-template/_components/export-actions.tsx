"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Download, FileSpreadsheet, Loader2 } from "lucide-react";
import {
  downloadDraftZip,
  downloadSheetCsv,
  downloadTemplateWorkbook,
  sheetFilename,
} from "@/lib/data-template/export";
import { filledRows } from "@/lib/data-template/draft";
import type { TemplateDraft } from "@/lib/data-template/types";

/**
 * The two downloads, side by side, because they are not the same file.
 *
 * The workbook is the blank form; the CSVs are this session's work. Putting
 * them behind one button would make whichever staff got second a surprise.
 */

export function ExportActions({ draft }: { draft: TemplateDraft }) {
  const [busy, setBusy] = useState<string | null>(null);

  async function run(key: string, action: () => Promise<void>, done: string) {
    setBusy(key);
    try {
      await action();
      toast.success(done);
    } catch {
      toast.error("The download couldn't be prepared. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        disabled={busy !== null}
        onClick={() =>
          run(
            "workbook",
            downloadTemplateWorkbook,
            "Template workbook downloaded."
          )
        }
      >
        {busy === "workbook" ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <FileSpreadsheet className="mr-2 h-4 w-4" />
        )}
        Download template
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              disabled={busy !== null}
              className="bg-brand-orange text-brand-orange-foreground hover:bg-brand-orange-dark"
            />
          }
        >
          {busy && busy !== "workbook" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Export CSV
          <ChevronDown className="ml-2 h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          {draft.sheets.map((sheet) => {
            const count = filledRows(sheet).length;
            return (
              <DropdownMenuItem
                key={sheet.id}
                onClick={() =>
                  run(
                    sheet.id,
                    () => downloadSheetCsv(sheet),
                    `${sheetFilename(sheet)} downloaded.`
                  )
                }
              >
                <div className="flex min-w-0 flex-col">
                  <span>{sheetFilename(sheet)}</span>
                  <span className="text-xs text-muted-foreground">
                    {count === 0
                      ? "Headers only"
                      : `${count} ${count === 1 ? "row" : "rows"}`}
                  </span>
                </div>
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() =>
              run("zip", () => downloadDraftZip(draft), "Both CSVs downloaded.")
            }
          >
            Both files (.zip)
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-[11px] font-normal text-muted-foreground">
            Exports keep the header row. Guideline 3 asks for it to be removed
            before the files are submitted.
          </DropdownMenuLabel>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
