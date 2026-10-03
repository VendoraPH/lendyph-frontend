"use client";

import { useCallback, useState } from "react";
import { Mail, MessageSquare, Plus } from "lucide-react";
import { DataState } from "@/components/common/data-state";
import { PermissionButton } from "@/components/common/permission-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useApiResource } from "@/hooks";
import { formatDate } from "@/lib/format";
import { TEMPLATE_TYPES, TEMPLATE_TYPE_LABELS } from "@/lib/reminders";
import { reminderService } from "@/services";
import type { ReminderTemplate } from "@/types/reminder";
import { TemplateFormDialog } from "./_components/template-form-dialog";

function TemplateCard({ template, onEdit }: { template: ReminderTemplate; onEdit: () => void }) {
  const Icon = template.channel === "sms" ? MessageSquare : Mail;
  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          {template.name}
        </p>
        {!template.is_active && (
          <Badge variant="outline" className="text-muted-foreground">
            Inactive
          </Badge>
        )}
      </div>
      {template.subject && <p className="text-xs font-medium">{template.subject}</p>}
      <p className="line-clamp-3 whitespace-pre-wrap text-xs text-muted-foreground">{template.body}</p>
      <div className="mt-auto flex items-center justify-between pt-1 text-xs text-muted-foreground">
        <span>
          {template.language.toUpperCase()}
          {template.updated_at ? ` · updated ${formatDate(template.updated_at)}` : ""}
        </span>
        <PermissionButton permission="reminders:settings" size="sm" variant="ghost" onClick={onEdit}>
          Edit
        </PermissionButton>
      </div>
    </div>
  );
}

export default function ReminderTemplatesPage() {
  const fetchTemplates = useCallback(() => reminderService.listTemplates(), []);
  const templates = useApiResource(fetchTemplates);
  const [dialog, setDialog] = useState<{ template: ReminderTemplate | null } | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          One template per reminder type and channel. Amounts and dates are filled in from the loan when it sends.
        </p>
        <PermissionButton
          permission="reminders:settings"
          // Nothing to save to while the reminder service is not connected.
          disabled={templates.unavailable}
          onClick={() => setDialog({ template: null })}
        >
          <Plus className="mr-1.5 h-4 w-4" /> New template
        </PermissionButton>
      </div>

      <DataState
        resource={templates}
        summary="SMS and email templates will be listed here once the reminder service is connected."
        endpoints={["GET /reminders/templates", "POST /reminders/templates", "PUT /reminders/templates/{id}", "POST /reminders/templates/preview"]}
        isEmpty={(rows) => rows.length === 0}
        emptyMessage="No templates yet. Create one for each reminder type you send."
      >
        {(rows) => (
          <div className="space-y-4">
            {TEMPLATE_TYPES.map((type) => {
              const group = rows.filter((t) => t.type === type);
              if (group.length === 0) return null;
              return (
                <Card key={type}>
                  <CardContent className="pt-6">
                    <p className="mb-3 text-sm font-semibold">{TEMPLATE_TYPE_LABELS[type]}</p>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {group.map((t) => (
                        <TemplateCard key={t.id} template={t} onEdit={() => setDialog({ template: t })} />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </DataState>

      <TemplateFormDialog
        open={dialog !== null}
        onOpenChange={(open) => !open && setDialog(null)}
        template={dialog?.template ?? null}
        onSaved={templates.refetch}
      />
    </div>
  );
}
