"use client";

import { Eye, Pencil, Power, PowerOff, Trash2 } from "lucide-react";
import { PermissionButton } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatRate } from "@/lib/format";
import type { PenaltyConfig } from "@/types/penalty";
import { describeRange } from "../_lib/penalty-form";
import { StatusBadge } from "./penalty-view-dialog";

interface PenaltyTableProps {
  configs: PenaltyConfig[];
  productName: (id: number) => string;
  /** False while loan products can't be listed: the form can't pick any. */
  canEdit: boolean;
  emptyMessage: string;
  onView: (c: PenaltyConfig) => void;
  onEdit: (c: PenaltyConfig) => void;
  onToggleStatus: (c: PenaltyConfig) => void;
  onDelete: (c: PenaltyConfig) => void;
}

const MAX_PRODUCTS_SHOWN = 2;

function productsLabel(ids: number[], productName: (id: number) => string): string {
  if (ids.length === 0) return "—";
  const shown = ids.slice(0, MAX_PRODUCTS_SHOWN).map(productName).join(", ");
  return ids.length > MAX_PRODUCTS_SHOWN ? `${shown} +${ids.length - MAX_PRODUCTS_SHOWN} more` : shown;
}

export function PenaltyTable({
  configs, productName, canEdit, emptyMessage, onView, onEdit, onToggleStatus, onDelete,
}: PenaltyTableProps) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Penalty Name</TableHead>
                <TableHead>Applicable Products</TableHead>
                <TableHead>Conditions</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {configs.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="max-w-56 truncate text-sm text-muted-foreground" title={c.applicable_product_ids.map(productName).join(", ")}>
                    {productsLabel(c.applicable_product_ids, productName)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {c.conditions.map((x) => `${describeRange(x)}: ${formatRate(x.rate)}%`).join(" · ")}
                  </TableCell>
                  <TableCell><StatusBadge status={c.status} /></TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button variant="outline" size="sm" className="h-7 text-xs" aria-label={`View ${c.name}`} onClick={() => onView(c)}>
                        <Eye className="h-3 w-3" />
                      </Button>
                      <PermissionButton
                        permission="penalties:update"
                        disabled={!canEdit}
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1 text-xs"
                        onClick={() => onEdit(c)}
                      >
                        <Pencil className="h-3 w-3" />
                        Edit
                      </PermissionButton>
                      <PermissionButton
                        permission="penalties:update"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        aria-label={`${c.status === "active" ? "Deactivate" : "Activate"} ${c.name}`}
                        disabled={c.status === "inactive" && c.applicable_product_ids.length === 0}
                        title={c.status === "inactive" && c.applicable_product_ids.length === 0 ? "Assign a loan product before activating" : undefined}
                        onClick={() => onToggleStatus(c)}
                      >
                        {c.status === "active" ? <PowerOff className="h-3 w-3" /> : <Power className="h-3 w-3" />}
                      </PermissionButton>
                      {!c.in_use && (
                        <PermissionButton
                          permission="penalties:delete"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/5"
                          aria-label={`Delete ${c.name}`}
                          onClick={() => onDelete(c)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </PermissionButton>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {configs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">{emptyMessage}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
