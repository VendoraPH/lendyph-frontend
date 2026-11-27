"use client";

import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { MenuVisibilityRow } from "../_lib/menu-visibility-view";

interface ModuleSwitchListProps {
  rows: readonly MenuVisibilityRow[];
  /** Every switch is locked (no override, or a save is on its way). */
  locked: boolean;
  onToggle: (key: string, shown: boolean) => void;
}

/**
 * One switch per menu, in the side menu's order, each submenu indented under
 * its parent. Settings closes the list, always on.
 */
export function ModuleSwitchList({ rows, locked, onToggle }: ModuleSwitchListProps) {
  return (
    <ul className="divide-y rounded-lg border bg-card" aria-label="Menus">
      {rows.map((row) => {
        const noteId = `menu-visibility-note-${row.key}`;
        return (
          <li key={row.key} className={cn("px-4 py-2", row.depth === 1 && "pl-10")}>
            <label className="flex items-center justify-between gap-4 text-sm">
              <span className="min-w-0">
                <span className={cn("block", row.depth === 0 && "font-medium")}>{row.label}</span>
                {row.note && (
                  <span id={noteId} className="block text-xs text-muted-foreground">
                    {row.note}
                  </span>
                )}
              </span>
              <span className="flex shrink-0 items-center gap-3">
                <span className="w-12 text-right text-xs text-muted-foreground" aria-hidden="true">
                  {row.shown ? "Shown" : "Hidden"}
                </span>
                <Switch
                  checked={row.shown}
                  disabled={locked || row.disabled}
                  aria-describedby={row.note ? noteId : undefined}
                  onCheckedChange={(shown) => onToggle(row.key, shown)}
                />
              </span>
            </label>
          </li>
        );
      })}
      <li className="px-4 py-2">
        <label className="flex items-center justify-between gap-4 text-sm">
          <span>
            <span className="block font-medium">Settings</span>
            <span id="menu-visibility-note-settings" className="block text-xs text-muted-foreground">
              Always on
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-3">
            <span className="w-12 text-right text-xs text-muted-foreground" aria-hidden="true">
              Shown
            </span>
            <Switch checked disabled aria-describedby="menu-visibility-note-settings" />
          </span>
        </label>
      </li>
    </ul>
  );
}
