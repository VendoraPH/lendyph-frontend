"use client";

import { useState, type ReactNode } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { DataState } from "@/components/common/data-state";
import { IncompleteListNotice } from "@/components/common/incomplete-list-notice";
import { PermissionButton } from "@/components/common/permission-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { notifyError, notifySuccess } from "@/lib/notify";
import type { ApiResource } from "@/hooks";
import type { DrainResult } from "@/lib/paginate";
import type { Permission } from "@/types/rbac";
import { RecordFormDialog, type FileSlot } from "./record-form-dialog";
import type { RecordDraft, RecordField, RecordValues } from "../_lib/record-form";

export interface RegisterColumn<T> {
  header: string;
  cell: (row: T) => ReactNode;
  align?: "right";
}

interface RegisterTableProps<T extends { id: number }> {
  title: string;
  description?: string;
  /** Singular and plural, e.g. ["officer", "officers"]. */
  noun: [string, string];
  resource: ApiResource<DrainResult<T>>;
  endpoints: string[];
  columns: RegisterColumn<T>[];
  fields?: RecordField[];
  /** Who may add, edit and delete rows. */
  permission: Permission;
  file?: FileSlot;
  onCreate?: (values: RecordValues, file: File | null) => Promise<unknown>;
  onUpdate?: (id: number, values: RecordValues, file: File | null) => Promise<unknown>;
  onDelete?: (id: number) => Promise<unknown>;
  /** Extra per-row buttons (versions, view proof, …). */
  rowActions?: (row: T) => ReactNode;
  /** Locked registers (a finalized report) offer no changes. */
  readOnly?: boolean;
  /** A new row's starting values. */
  defaults?: RecordDraft;
  /** Fields for editing, when they differ from the new row's. */
  editFields?: RecordField[];
  /**
   * A form of the register's own in place of the field-list one (an officer's
   * member link). `submit` takes its request and says how it went.
   */
  renderForm?: (form: {
    open: boolean;
    record: T | null;
    onOpenChange: (open: boolean) => void;
    submit: (request: Promise<unknown>) => Promise<unknown>;
  }) => ReactNode;
}

/**
 * A CDA register (carried over from #510 by Augustin): a full list (drained,
 * with the incomplete notice) plus add, edit and delete through one
 * field-list form. The server's message says what went wrong.
 */
export function RegisterTable<T extends { id: number }>(props: RegisterTableProps<T>) {
  const { title, description, noun, resource, endpoints, columns, fields = [], permission, file, readOnly } = props;
  const [editing, setEditing] = useState<T | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<T | null>(null);
  const canEdit = !readOnly && (!!props.onUpdate || !!props.renderForm);
  const canCreate = !readOnly && (!!props.onCreate || !!props.renderForm);
  const canDelete = !readOnly && !!props.onDelete;
  const hasActions = canEdit || canDelete || !!props.rowActions;

  function save(values: RecordValues, attachment: File | null): Promise<unknown> {
    const request =
      editing && props.onUpdate
        ? props.onUpdate(editing.id, values, attachment)
        : (props.onCreate?.(values, attachment) ?? Promise.resolve());
    return submit(request);
  }

  function submit(request: Promise<unknown>): Promise<unknown> {
    return request
      .then(() => {
        notifySuccess(editing ? `${capitalize(noun[0])} updated` : `${capitalize(noun[0])} added`);
        resource.refetch();
      })
      .catch((err: unknown) => {
        notifyError(err, `Could not save the ${noun[0]}`);
        throw err;
      });
  }

  function closeForm(open: boolean) {
    if (!open) {
      setCreating(false);
      setEditing(null);
    }
  }

  function remove(row: T) {
    props
      .onDelete?.(row.id)
      .then(() => {
        notifySuccess(`${capitalize(noun[0])} deleted`);
        resource.refetch();
      })
      .catch((err: unknown) => notifyError(err, `Could not delete the ${noun[0]}`));
    setDeleting(null);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {canCreate && (
          <PermissionButton permission={permission} size="sm" onClick={() => setCreating(true)}>
            <Plus className="mr-1 h-4 w-4" /> Add {noun[0]}
          </PermissionButton>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <DataState
          resource={resource}
          endpoints={endpoints}
          summary={`The ${noun[1]} register`}
          isEmpty={(d) => d.rows.length === 0}
          emptyMessage={`No ${noun[1]} recorded yet.`}
        >
          {(data) => (
            <>
              {data.truncated && (
                <IncompleteListNotice
                  shown={data.rows.length}
                  total={data.total}
                  noun={noun[1]}
                  consequence={`Some ${noun[1]} are missing from this list and from the report totals shown here.`}
                />
              )}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {columns.map((c) => (
                        <TableHead key={c.header} className={c.align === "right" ? "text-right" : undefined}>
                          {c.header}
                        </TableHead>
                      ))}
                      {hasActions && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.rows.map((row) => (
                      <TableRow key={row.id}>
                        {columns.map((c) => (
                          <TableCell key={c.header} className={c.align === "right" ? "text-right tabular-nums" : undefined}>
                            {c.cell(row)}
                          </TableCell>
                        ))}
                        {hasActions && (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              {props.rowActions?.(row)}
                              {canEdit && (
                                <PermissionButton
                                  permission={permission}
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`Edit ${noun[0]}`}
                                  onClick={() => setEditing(row)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </PermissionButton>
                              )}
                              {canDelete && (
                                <PermissionButton
                                  permission={permission}
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`Delete ${noun[0]}`}
                                  onClick={() => setDeleting(row)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </PermissionButton>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </DataState>
      </CardContent>

      {props.renderForm ? (
        props.renderForm({ open: creating || editing !== null, record: editing, onOpenChange: closeForm, submit })
      ) : (
        <RecordFormDialog
          open={creating || editing !== null}
          onOpenChange={closeForm}
          title={editing ? `Edit ${noun[0]}` : `Add ${noun[0]}`}
          fields={editing && props.editFields ? props.editFields : fields}
          record={editing}
          defaults={props.defaults}
          file={file}
          onSubmit={save}
        />
      )}

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this {noun[0]}?</AlertDialogTitle>
            <AlertDialogDescription>
              It is removed from the register. Reports not yet finalized show Refresh to take it out of their figures.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => deleting && remove(deleting)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
