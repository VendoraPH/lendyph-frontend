"use client";

import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { amlaSettingRow } from "@/lib/amla/settings-view";
import type { AmlaSetting } from "@/types/amla";

/** One version's settings in words: the value as the server words it, and whether it is still to verify. */
export function AmlaSettingsTable({ settings }: { settings: AmlaSetting[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Setting</TableHead>
          <TableHead>Value</TableHead>
          <TableHead>Checked</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {settings.map(amlaSettingRow).map((row) => (
          <TableRow key={row.key}>
            <TableCell className="whitespace-normal">{row.label}</TableCell>
            <TableCell className="font-medium whitespace-normal">{row.value}</TableCell>
            <TableCell className="whitespace-normal">
              {row.toVerify ? <Badge variant="outline">{row.check}</Badge> : <span className="text-sm">{row.check}</span>}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
