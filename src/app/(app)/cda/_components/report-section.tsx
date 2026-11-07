"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FieldInput } from "./field-input";
import {
  currentValue,
  draftKey,
  formatFieldValue,
  formatTableValue,
  type FieldDrafts,
} from "../_lib/report-values";
import type { CdaField, CdaFieldValue, CdaSection } from "@/types/cda";

interface ReportSectionProps {
  section: CdaSection;
  drafts: FieldDrafts;
  /** False when the report is locked or the user cannot prepare it. */
  editable: boolean;
  onEdit: (key: string, value: CdaFieldValue, remarks?: string | null) => void;
}

function FieldRow({ section, field, drafts, editable, onEdit }: ReportSectionProps & { field: CdaField }) {
  const key = draftKey(section.key, field.key);
  const value = currentValue(section.key, field, drafts);
  const remarks = drafts[key]?.remarks ?? field.remarks ?? null;
  const id = `cda-${key}`;
  const canEdit = editable && field.editable;

  return (
    <div className="grid gap-2 py-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:items-start">
      <div>
        <Label htmlFor={canEdit ? id : undefined}>
          {field.label} {field.required && <span className="text-destructive">*</span>}
        </Label>
        {field.help && <p className="text-xs text-muted-foreground">{field.help}</p>}
      </div>
      <div className="space-y-1">
        {canEdit ? (
          <FieldInput id={id} field={field} value={value} onChange={(v) => onEdit(key, v, remarks)} />
        ) : (
          <p className="text-sm font-medium">{formatFieldValue({ ...field, value })}</p>
        )}
        {field.source && <p className="text-xs text-muted-foreground">Source: {field.source}</p>}
        {field.type === "compliance" &&
          (canEdit ? (
            <Input
              aria-label={`${field.label} remarks`}
              placeholder="Evidence / remarks"
              value={remarks ?? ""}
              onChange={(e) => onEdit(key, value, e.target.value || null)}
            />
          ) : (
            remarks && <p className="text-xs text-muted-foreground">Remarks: {remarks}</p>
          ))}
      </div>
    </div>
  );
}

/** One template section: a list of fields, or a read-only table of pulled rows. */
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
              <FieldRow key={field.key} {...props} field={field} />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {section.columns.map((c) => (
                    <TableHead key={c.key} className={c.format && c.format !== "text" ? "text-right" : undefined}>
                      {c.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {section.rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={section.columns.length} className="text-center text-muted-foreground">
                      No rows for this year.
                    </TableCell>
                  </TableRow>
                ) : (
                  section.rows.map((row, i) => (
                    <TableRow key={i}>
                      {section.columns.map((c) => (
                        <TableCell
                          key={c.key}
                          className={c.format && c.format !== "text" ? "text-right tabular-nums" : undefined}
                        >
                          {formatTableValue(row[c.key] ?? null, c)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
