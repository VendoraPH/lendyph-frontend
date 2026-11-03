"use client";

import { History, MoreHorizontal, Pencil, ToggleLeft, ToggleRight, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { decimalInputValue } from "@/lib/percent";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { postingFrequencyLabel } from "../_lib/product-form";
import type { SavingsProduct } from "@/types/savings";

export type ProductAction = "edit" | "history" | "status" | "delete";

interface ProductTableProps {
  products: SavingsProduct[];
  onAction: (action: ProductAction, product: SavingsProduct) => void;
}

function StatusBadge({ status }: { status: SavingsProduct["status"] }) {
  return status === "active" ? (
    <Badge className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">Active</Badge>
  ) : (
    <Badge variant="secondary">Inactive</Badge>
  );
}

function RowActions({ product, onAction }: { product: SavingsProduct; onAction: ProductTableProps["onAction"] }) {
  const active = product.status === "active";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded p-1 outline-none hover:bg-muted" aria-label={`Actions for ${product.name}`}>
        <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onAction("edit", product)}>
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAction("history", product)}>
          <History className="mr-2 h-4 w-4" />
          Change history
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onAction("status", product)}>
          {active ? <ToggleLeft className="mr-2 h-4 w-4" /> : <ToggleRight className="mr-2 h-4 w-4" />}
          {active ? "Deactivate" : "Activate"}
        </DropdownMenuItem>
        {/* Only the server knows whether accounts were ever opened on it. */}
        {product.can_delete && (
          <DropdownMenuItem className="text-destructive" onClick={() => onAction("delete", product)}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const rate = (p: SavingsProduct) => `${decimalInputValue(p.interest_rate) || "0"}% p.a.`;

export function ProductTable({ products, onAction }: ProductTableProps) {
  if (products.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No savings products match. Add one to get started.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Mobile */}
      <div className="space-y-3 md:hidden">
        {products.map((p) => (
          <Card key={p.id}>
            <CardContent className="space-y-3 py-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.code} · {p.product_type}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={p.status} />
                  <RowActions product={p} onAction={onAction} />
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <dt className="text-muted-foreground">Interest</dt>
                  <dd>
                    {rate(p)} · {postingFrequencyLabel(p.posting_frequency)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Initial deposit</dt>
                  <dd>{formatCurrency(p.min_initial_deposit)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Maintaining</dt>
                  <dd>{formatCurrency(p.min_maintaining_balance)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Accounts</dt>
                  <dd>{p.accounts_count ?? "—"}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Desktop */}
      <Card className="hidden min-w-0 overflow-hidden md:block">
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Interest</TableHead>
                <TableHead className="text-right">Initial deposit</TableHead>
                <TableHead className="text-right">Maintaining</TableHead>
                <TableHead className="text-right">To earn interest</TableHead>
                <TableHead className="text-right">Accounts</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.code}</p>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.product_type}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm">
                    {rate(p)}
                    <span className="ml-1 text-muted-foreground">{postingFrequencyLabel(p.posting_frequency)}</span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(p.min_initial_deposit)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(p.min_maintaining_balance)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(p.min_balance_to_earn_interest)}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.accounts_count ?? "—"}</TableCell>
                  <TableCell>
                    <StatusBadge status={p.status} />
                  </TableCell>
                  <TableCell>
                    <RowActions product={p} onAction={onAction} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
