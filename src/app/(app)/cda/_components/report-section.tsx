"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { currentValue, formatCell, formatFieldValue, isOverriding, type FieldDraft, type FieldDrafts } from "../_lib/report-fields";
import { FieldInput } from "./field-input";
import { ToneBadge } from "./tone-badge";
import type { CdaField, CdaSection, CdaTableSection } from "@/types/cda";

interface ReportSectionProps {
  section: CdaSection;
  drafts: FieldDrafts;
  /** False when the report is locked or the user can't prepare it. */
  canEdit: boolean;
  onEdit: (fieldKey: string, draft: FieldDraft | null) => void;
}

const RIGHT = new Set(["money", "percent", "number"]);

function SourceLine({ field }: { field: CdaField }) {
  if (!field.source && !field.source_error) return null;
  return (
    <p className="text-xs text-muted-foreground">
      {field.source_error ? (
        <span className="text-amber-700 dark:text-amber-400">{field.source_error}</span>
      ) : (
        <>Source: {field.source}</>
      )}
      {field.overridden && field.source_value !== null && (
        <> · The system&apos;s figure: {formatFieldValue(field, field.source_value)}</>
      )}
    </p>
  );
}

function FieldRow({ field, drafts, canEdit, onEdit }: Omit<ReportSectionProps, "section"> & { field: CdaField }) {
  const draft = drafts[field.field_key];
  const value = currentValue(field, drafts);
  const id = `cda-${field.field_key}`;
  const overriding = isOverriding(field, drafts);
  const editable = canEdit && (field.editable || overriding);
  const remarks = draft && "remarks" in draft ? (draft.remarks ?? "") : (field.remarks ?? "");
  const reverting = draft?.revert === true;

  return (
    <div className="grid gap-2 py-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:items-start">
      <div className="space-y-1">
        <Label htmlFor={editable ? id : undefined}>
          {field.label} {field.required && <span className="text-destructive">*</span>}
        </Label>
        {field.help && <p className="text-xs text-muted-foreground">{field.help}</p>}
        <div className="flex flex-wrap gap-1">
          {field.calculated && <ToneBadge tone="neutral" label="Calculated" />}
          {field.provisional && <ToneBadge tone="warning" label="Provisional" />}
          {field.overridden && !reverting && <ToneBadge tone="info" label="Overridden" />}
        </div>
      </div>
      <div className="space-y-1">
        {editable ? (
          <FieldInput id={id} field={field} value={value} onChange={(v) => onEdit(field.field_key, { ...draft, value: v, revert: false })} />
        ) : (
          <p className="text-sm font-medium">
            {reverting ? "Back to the system's figure when saved" : formatFieldValue(field, value)}
          </p>
        )}
        <SourceLine field={field} />
        {field.as_of && <p className="text-xs text-muted-foreground">As of {formatDate(field.as_of)}</p>}
        {field.note && <p className="text-xs text-muted-foreground">{field.note}</p>}
        {field.overridden && field.override_reason && !overriding && (
          <p className="text-xs text-muted-foreground">Overridden because: {field.override_reason}</p>
        )}

        {overriding && (
          <Input
            aria-label={`Reason for overriding ${field.label}`}
            placeholder="Reason for overriding the system's figure (required)"
            value={draft?.override_reason ?? field.override_reason ?? ""}
            onChange={(e) => onEdit(field.field_key, { ...draft, override_reason: e.target.value })}
          />
        )}

        {canEdit && (field.overridable || field.overridden) && (
          <div className="flex flex-wrap gap-2">
            {field.overridable && !overriding && (
              <Button
                variant="outline"
                size="xs"
                onClick={() => onEdit(field.field_key, { value: field.value, override_reason: field.override_reason ?? "" })}
              >
                Override
              </Button>
            )}
            {overriding && (
              <Button variant="ghost" size="xs" onClick={() => onEdit(field.field_key, null)}>
                Cancel override
              </Button>
            )}
            {field.overridden && !overriding && !reverting && (
              <Button variant="ghost" size="xs" onClick={() => onEdit(field.field_key, { revert: true })}>
                Use the system&apos;s figure
              </Button>
            )}
            {reverting && (
              <Button variant="ghost" size="xs" onClick={() => onEdit(field.field_key, null)}>
                Keep the override
              </Button>
            )}
          </div>
        )}

        {editable ? (
          <Input
            aria-label={`${field.label} remarks`}
            placeholder={field.type === "compliance" ? "Evidence or remarks" : "Remarks (optional)"}
            value={remarks}
            onChange={(e) => onEdit(field.field_key, { ...draft, remarks: e.target.value || null })}
          />
        ) : (
          remarks && <p className="text-xs text-muted-foreground">Remarks: {remarks}</p>
        )}
      </div>
    </div>
  );
}

function TableBlock({ section }: { section: CdaTableSection }) {
  return (
    <div className="space-y-2">
      {(section.source || section.source_error) && (
        <p className="text-xs text-muted-foreground">
          {section.source_error ? (
            <span className="text-amber-700 dark:text-amber-400">{section.source_error}</span>
          ) : (
            <>Source: {section.source}</>
          )}
          {section.provisional && " · Provisional"}
        </p>
      )}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {section.columns.map((c) => (
                <TableHead key={c.key} className={RIGHT.has(c.format ?? "") ? "text-right" : undefined}>
                  {c.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {section.rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={section.columns.length || 1} className="text-center text-muted-foreground">
                  No rows for this year.
                </TableCell>
              </TableRow>
            ) : (
              section.rows.map((row, i) => (
                <TableRow key={i}>
                  {section.columns.map((c) => (
                    <TableCell key={c.key} className={RIGHT.has(c.format ?? "") ? "text-right tabular-nums" : undefined}>
                      {formatCell(c.format, row[c.key] ?? null)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/** One template section as the server lays it out: fields, or a table of figures from the system. */
export function ReportSection(props: ReportSectionProps) {
  const { section } = props;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{section.title}</CardTitle>
        {section.description && <CardDescription>{section.description}</CardDescription>}
      </CardHeader>
      <CardContent>
        {section.kind === "fields" ? (
          <div className="divide-y">
            {section.fields.map((field) => (
              <FieldRow key={field.field_key} field={field} drafts={props.drafts} canEdit={props.canEdit} onEdit={props.onEdit} />
            ))}
          </div>
        ) : (
          <TableBlock section={section} />
        )}
      </CardContent>
    </Card>
  );
}
