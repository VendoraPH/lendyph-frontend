"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  addColumn,
  addRow,
  moveColumn,
  removeColumn,
  removeRow,
  renameColumn,
  setColumnRequired,
  updateCell,
} from "@/lib/data-template/draft";
import { DATA_DICTIONARY } from "@/lib/data-template/template";
import type { TemplateColumn, TemplateSheet } from "@/lib/data-template/types";
import type { TemplateIssue } from "@/lib/data-template/validate";
import { ColumnHeaderCell } from "./column-header-cell";

/**
 * The spreadsheet. Raw `<table>` rather than `components/ui/table`: that one is
 * built for reading rows, and every one of its paddings and hover states would
 * have to be unset to get cells an input can fill edge to edge.
 *
 * The column stays wide enough to read its own header and no wider — 22 columns
 * that each fit their contents is a grid nobody can scan, so the sheet scrolls
 * horizontally with the row number pinned.
 */

export interface SheetEditorProps {
  sheet: TemplateSheet;
  issues: TemplateIssue[];
  onChange: (fn: (sheet: TemplateSheet) => TemplateSheet) => void;
}

export function SheetEditor({ sheet, issues, onChange }: SheetEditorProps) {
  // `row:columnId` for cells, `col:columnId` for headers.
  const flagged = useMemo(() => {
    const set = new Set<string>();
    for (const issue of issues) {
      if (!issue.columnId) continue;
      set.add(issue.row === null ? `col:${issue.columnId}` : `${issue.row}:${issue.columnId}`);
    }
    return set;
  }, [issues]);

  return (
    <TooltipProvider>
      <div className="overflow-hidden rounded-lg border">
        <div className="overflow-x-auto">
          <table className="w-max border-collapse text-sm">
            <thead>
              <tr className="bg-muted/40">
                <th
                  scope="col"
                  className="sticky left-0 z-20 w-12 border-r border-b bg-muted/40 px-2 py-1 text-[11px] font-medium text-muted-foreground"
                >
                  #
                </th>
                {sheet.columns.map((column, index) => (
                  <th
                    key={column.id}
                    scope="col"
                    className="min-w-[190px] border-r border-b text-left align-top last:border-r-0"
                  >
                    <ColumnHeaderCell
                      column={column}
                      isFirst={index === 0}
                      isLast={index === sheet.columns.length - 1}
                      invalid={flagged.has(`col:${column.id}`)}
                      onRename={(header) =>
                        onChange((s) => renameColumn(s, column.id, header))
                      }
                      onToggleRequired={() =>
                        onChange((s) =>
                          setColumnRequired(s, column.id, !column.required)
                        )
                      }
                      onMove={(direction) =>
                        onChange((s) => moveColumn(s, column.id, direction))
                      }
                      onInsertAfter={() => onChange((s) => addColumn(s, column.id))}
                      onRemove={() => onChange((s) => removeColumn(s, column.id))}
                    />
                  </th>
                ))}
                <th scope="col" className="border-b px-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 whitespace-nowrap text-xs text-muted-foreground"
                    onClick={() => onChange(addColumn)}
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Column
                  </Button>
                </th>
              </tr>
            </thead>

            <tbody>
              {sheet.rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="group/row">
                  <td className="sticky left-0 z-10 border-r border-b bg-background px-1 py-1 text-center align-middle">
                    <span className="text-[11px] text-muted-foreground group-hover/row:hidden">
                      {rowIndex + 1}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="hidden h-6 w-6 text-muted-foreground group-hover/row:inline-flex hover:text-destructive"
                      aria-label={`Remove row ${rowIndex + 1}`}
                      disabled={sheet.rows.length === 1}
                      onClick={() => onChange((s) => removeRow(s, rowIndex))}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </td>

                  {sheet.columns.map((column) => (
                    <td
                      key={column.id}
                      className="border-r border-b p-0 align-middle last:border-r-0"
                    >
                      <SheetCell
                        column={column}
                        value={row[column.id] ?? ""}
                        invalid={flagged.has(`${rowIndex}:${column.id}`)}
                        onChange={(value) =>
                          onChange((s) => updateCell(s, rowIndex, column.id, value))
                        }
                      />
                    </td>
                  ))}
                  <td className="border-b" />
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between gap-3 border-t bg-muted/20 px-3 py-2">
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onChange(addRow)}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add row
          </Button>
          <span className="text-[11px] text-muted-foreground">
            {sheet.columns.length} columns · {sheet.rows.length}{" "}
            {sheet.rows.length === 1 ? "row" : "rows"}
          </span>
        </div>
      </div>
    </TooltipProvider>
  );
}

function SheetCell({
  column,
  value,
  invalid,
  onChange,
}: {
  column: TemplateColumn;
  value: string;
  invalid: boolean;
  onChange: (value: string) => void;
}) {
  const label = `${column.header || "Column"} value`;
  const ring = invalid ? "bg-destructive/5" : "";

  if (column.dictionary) {
    const { values } = DATA_DICTIONARY[column.dictionary];
    return (
      <NativeSelect
        size="sm"
        value={value}
        aria-label={label}
        aria-invalid={invalid || undefined}
        onChange={(e) => onChange(e.target.value)}
        className={cn("w-full rounded-none", ring)}
      >
        <NativeSelectOption value="">—</NativeSelectOption>
        {values.map((option) => (
          <NativeSelectOption key={option} value={option}>
            {option}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    );
  }

  return (
    <Input
      value={value}
      aria-label={label}
      aria-invalid={invalid || undefined}
      placeholder={column.hint}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "h-8 rounded-none border-0 bg-transparent px-2 text-sm shadow-none focus-visible:ring-1 focus-visible:ring-inset",
        ring
      )}
    />
  );
}
