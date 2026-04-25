"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ShieldCheck,
  Plus,
  PencilLine,
  Trash2,
  ArrowUp,
  ArrowDown,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";
import { RouteGuard } from "@/components/common";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Spinner } from "@/components/ui/spinner";
import { collateralTypeService } from "@/services";
import type { CollateralSource, CollateralType } from "@/types";

interface FormState {
  name: string;
  detail_field_label: string;
  amount_field_label: string;
  source: CollateralSource;
  is_visible: boolean;
}

const EMPTY_FORM: FormState = {
  name: "",
  detail_field_label: "",
  amount_field_label: "",
  source: "manual",
  is_visible: true,
};

export default function CollateralTypesSettingsPage() {
  const [types, setTypes] = useState<CollateralType[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CollateralType | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<CollateralType | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await collateralTypeService.list();
      setTypes(rows);
    } catch {
      toast.error("Failed to load collateral types");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  };

  const openEdit = (t: CollateralType) => {
    setEditing(t);
    setForm({
      name: t.name,
      detail_field_label: t.detail_field_label,
      amount_field_label: t.amount_field_label,
      source: t.source,
      is_visible: t.is_visible,
    });
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (
      !form.name.trim() ||
      !form.detail_field_label.trim() ||
      !form.amount_field_label.trim()
    ) {
      toast.error("Please fill in all fields");
      return;
    }
    setSubmitting(true);
    try {
      if (editing) {
        await collateralTypeService.update(editing.id, form);
        toast.success("Collateral type updated");
      } else {
        const order = types.length + 1;
        await collateralTypeService.create({ ...form, display_order: order });
        toast.success("Collateral type created");
      }
      setFormOpen(false);
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await collateralTypeService.delete(deleting.id);
      toast.success("Collateral type deleted");
      setDeleting(null);
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete";
      toast.error(msg);
    }
  };

  const handleToggleVisible = async (t: CollateralType) => {
    try {
      await collateralTypeService.update(t.id, { is_visible: !t.is_visible });
      await load();
    } catch {
      toast.error("Failed to update visibility");
    }
  };

  const handleMove = async (index: number, direction: -1 | 1) => {
    const next = [...types];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    try {
      await collateralTypeService.reorder(next.map((t) => t.id));
      setTypes(next.map((t, i) => ({ ...t, display_order: i + 1 })));
    } catch {
      toast.error("Failed to reorder");
    }
  };

  return (
    <RouteGuard permission="settings:view" pageName="Collateral Types">
      <div className="space-y-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Collateral Types
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage the collateral kinds available across the system.
            </p>
          </div>
          <Button onClick={openAdd}>
            <Plus className="mr-2 h-4 w-4" />
            New Type
          </Button>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Configured Types
            </CardTitle>
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Spinner className="size-6 text-muted-foreground" />
              </div>
            ) : types.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No collateral types yet.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Order</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Detail Label</TableHead>
                    <TableHead>Amount Label</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Visible</TableHead>
                    <TableHead className="w-1"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {types.map((t, i) => (
                    <TableRow key={t.id}>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            disabled={i === 0}
                            onClick={() => handleMove(i, -1)}
                            aria-label="Move up"
                          >
                            <ArrowUp className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            disabled={i === types.length - 1}
                            onClick={() => handleMove(i, 1)}
                            aria-label="Move down"
                          >
                            <ArrowDown className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {t.name}
                          {t.is_seed && (
                            <Badge variant="outline" className="text-xs">
                              Default
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {t.detail_field_label}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {t.amount_field_label}
                      </TableCell>
                      <TableCell>
                        {t.source === "share_capital" ? (
                          <Badge className="bg-blue-500/10 text-blue-700 hover:bg-blue-500/10">
                            Share Capital
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Manual</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleToggleVisible(t)}
                          aria-label={t.is_visible ? "Hide" : "Show"}
                        >
                          {t.is_visible ? (
                            <Eye className="h-4 w-4" />
                          ) : (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => openEdit(t)}
                            aria-label="Edit"
                          >
                            <PencilLine className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            disabled={t.is_seed}
                            title={
                              t.is_seed
                                ? "Default types can't be deleted — hide them instead"
                                : "Delete"
                            }
                            onClick={() => setDeleting(t)}
                            aria-label="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Add / Edit Dialog */}
        <Dialog open={formOpen} onOpenChange={setFormOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editing ? "Edit Collateral Type" : "New Collateral Type"}
              </DialogTitle>
              <DialogDescription>
                Define the labels that members and loan officers will see when
                registering or attaching a collateral of this kind.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="e.g. Vehicle OR/CR"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Detail field label</Label>
                  <Input
                    value={form.detail_field_label}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        detail_field_label: e.target.value,
                      }))
                    }
                    placeholder="e.g. OR Number"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Amount field label</Label>
                  <Input
                    value={form.amount_field_label}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        amount_field_label: e.target.value,
                      }))
                    }
                    placeholder="e.g. Estimated Value"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Source</Label>
                <Select
                  value={form.source}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, source: v as CollateralSource }))
                  }
                  disabled={editing?.is_seed}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual entry</SelectItem>
                    <SelectItem value="share_capital">
                      Share Capital (auto-derived)
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {form.source === "share_capital"
                    ? "Amount is pulled live from the member's share capital balance."
                    : "Amount is entered by the user during collateral registration."}
                </p>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Visible</p>
                  <p className="text-xs text-muted-foreground">
                    Hidden types won&apos;t appear in the collateral picker.
                  </p>
                </div>
                <Switch
                  checked={form.is_visible}
                  onCheckedChange={(v) =>
                    setForm((f) => ({ ...f, is_visible: v }))
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setFormOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={submitting}>
                {submitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {editing ? "Save Changes" : "Create Type"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog
          open={Boolean(deleting)}
          onOpenChange={(o) => !o && setDeleting(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this collateral type?</AlertDialogTitle>
              <AlertDialogDescription>
                Existing collaterals of this type will keep their data, but the
                type will no longer appear in the picker. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={handleDelete}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </RouteGuard>
  );
}
