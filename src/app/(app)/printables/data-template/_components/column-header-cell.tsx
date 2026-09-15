"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ArrowLeft,
  ArrowRight,
  Asterisk,
  MoreVertical,
  Plus,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { TemplateColumn } from "@/lib/data-template/types";

/**
 * One editable column header.
 *
 * The workbook says "required" with a blue fill and "optional" with yellow,
 * which is unreadable to anyone who did not receive the legend. Here the
 * required flag is an asterisk that is also the toggle, so the state and the
 * control are the same thing.
 */

export interface ColumnHeaderCellProps {
  column: TemplateColumn;
  isFirst: boolean;
  isLast: boolean;
  invalid: boolean;
  onRename: (header: string) => void;
  onToggleRequired: () => void;
  onMove: (direction: "left" | "right") => void;
  onInsertAfter: () => void;
  onRemove: () => void;
}

export function ColumnHeaderCell({
  column,
  isFirst,
  isLast,
  invalid,
  onRename,
  onToggleRequired,
  onMove,
  onInsertAfter,
  onRemove,
}: ColumnHeaderCellProps) {
  const requiredLabel = column.requiredWhen ?? "Required";

  return (
    <div className="flex flex-col gap-1 p-1.5">
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                onClick={onToggleRequired}
                aria-pressed={column.required}
                aria-label={`${column.header || "Column"}: ${
                  column.required ? requiredLabel : "Optional"
                }. Toggle.`}
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded transition-colors",
                  column.required
                    ? "text-brand-orange hover:bg-brand-orange/10"
                    : "text-muted-foreground/40 hover:bg-muted hover:text-muted-foreground"
                )}
              />
            }
          >
            <Asterisk className="h-3.5 w-3.5" />
          </TooltipTrigger>
          <TooltipContent>
            {column.required ? requiredLabel : "Optional"} — click to change
          </TooltipContent>
        </Tooltip>

        <Input
          value={column.header}
          onChange={(e) => onRename(e.target.value)}
          aria-label="Column header"
          aria-invalid={invalid || undefined}
          className="h-7 min-w-0 flex-1 border-transparent bg-transparent px-1.5 text-xs font-semibold shadow-none hover:border-input focus-visible:border-ring"
        />

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 text-muted-foreground"
                aria-label={`Options for ${column.header || "this column"}`}
              />
            }
          >
            <MoreVertical className="h-3.5 w-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem disabled={isFirst} onClick={() => onMove("left")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Move left
            </DropdownMenuItem>
            <DropdownMenuItem disabled={isLast} onClick={() => onMove("right")}>
              <ArrowRight className="mr-2 h-4 w-4" />
              Move right
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onInsertAfter}>
              <Plus className="mr-2 h-4 w-4" />
              Insert column after
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={onRemove}>
              <Trash2 className="mr-2 h-4 w-4" />
              Remove column
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {column.hint && (
        <span className="px-1.5 text-[10px] font-normal text-muted-foreground">
          {column.hint}
        </span>
      )}
    </div>
  );
}
