"use client";

import { useState } from "react";
import Link from "next/link";
import { RouteGuard } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronRight, RotateCcw, Table2 } from "lucide-react";
import { issuesForSheet } from "@/lib/data-template/validate";
import { useTemplateDraft } from "./_hooks/use-template-draft";
import { ExportActions } from "./_components/export-actions";
import { IssueList } from "./_components/issue-list";
import { SheetEditor } from "./_components/sheet-editor";
import {
  DataDictionaryPanel,
  GuidelinesPanel,
} from "./_components/reference-panels";

/**
 * The bulk data-import template: preview it, edit it, take it away.
 *
 * A static segment under `/printables`, so it wins over `[printableId]` — this
 * is not a printable. It produces no letterhead and no signature block; it is
 * the workbook a cooperative fills in to bring its existing book onto Lendyph,
 * and it sits here because this is where staff already come for "give me the
 * document for X".
 *
 * Nothing is persisted. The draft is one session's work, and the file it
 * produces is the record — a half-filled grid restored from storage three days
 * later would be a worse surprise than an empty one.
 */

export default function DataTemplatePage() {
  const { draft, issues, update, reset } = useTemplateDraft();
  const [tab, setTab] = useState<string>(draft.sheets[0].id);

  return (
    <RouteGuard permission="reports:view" pageName="Documents">
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link
            href="/printables"
            className="transition-colors hover:text-foreground"
          >
            Documents
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground">Data Import Template</span>
        </div>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-teal-50 ring-1 ring-teal-200">
              <Table2 className="h-6 w-6 text-teal-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Bulk import
              </p>
              <h1 className="mt-0.5 text-xl font-bold tracking-tight sm:text-2xl">
                Data Import Template
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                The workbook for migrating existing members and loans onto
                Lendyph. Download it blank, or fill it in here — adding, renaming
                and reordering columns as your records need — and export the CSVs.
              </p>
            </div>
          </div>

          <div className="shrink-0">
            <ExportActions draft={draft} />
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <TabsList>
              {draft.sheets.map((sheet) => {
                const count = issuesForSheet(issues, sheet.id).length;
                return (
                  <TabsTrigger key={sheet.id} value={sheet.id}>
                    {sheet.name}
                    {count > 0 && (
                      <Badge
                        variant="secondary"
                        className="ml-2 h-5 min-w-5 justify-center px-1 text-[10px]"
                      >
                        {count}
                      </Badge>
                    )}
                  </TabsTrigger>
                );
              })}
              <TabsTrigger value="dictionary">Data Dictionary</TabsTrigger>
              <TabsTrigger value="guidelines">Guidelines</TabsTrigger>
            </TabsList>

            {draft.sheets.some((s) => s.id === tab) && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={reset}
              >
                <RotateCcw className="mr-2 h-3.5 w-3.5" />
                Reset to template
              </Button>
            )}
          </div>

          {draft.sheets.map((sheet) => (
            <TabsContent key={sheet.id} value={sheet.id} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {sheet.description}
              </p>
              <SheetEditor
                sheet={sheet}
                issues={issuesForSheet(issues, sheet.id)}
                onChange={(fn) => update(sheet.id, fn)}
              />
              <IssueList issues={issuesForSheet(issues, sheet.id)} />
            </TabsContent>
          ))}

          <TabsContent value="dictionary">
            <DataDictionaryPanel />
          </TabsContent>
          <TabsContent value="guidelines">
            <GuidelinesPanel />
          </TabsContent>
        </Tabs>
      </div>
    </RouteGuard>
  );
}
