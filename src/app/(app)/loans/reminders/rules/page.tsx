"use client";

import { useCallback, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { DataState } from "@/components/common/data-state";
import { PermissionButton } from "@/components/common/permission-button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApiResource, usePermission } from "@/hooks";
import { notifyError, notifySuccess } from "@/lib/notify";
import {
  CONTACT_HOURS_LIMIT,
  DEFAULT_RULES,
  TEMPLATE_TYPE_LABELS,
  describeRule,
} from "@/lib/reminders";
import { reminderService } from "@/services";
import type { ReminderRule, ReminderRuleInput } from "@/types/reminder";
import { RuleFormDialog } from "./_components/rule-form-dialog";

const BORROWER_TYPE_LABELS: Record<ReminderRule["borrower_type"], string> = {
  all: "All borrowers",
  member: "Members",
  non_member: "Walk-ins",
};

/** Shown while no rule exists: the defaults the server seeds a new tenant with. */
function SuggestedRules({ onUse }: { onUse: (draft: Partial<ReminderRuleInput>) => void }) {
  return (
    <div className="space-y-3 rounded-xl border border-dashed p-6">
      <div>
        <p className="font-medium">No reminder rules yet</p>
        <p className="text-sm text-muted-foreground">
          These are the recommended starting rules. Add the ones you want; each can be edited later.
        </p>
      </div>
      <ul className="divide-y rounded-lg border">
        {DEFAULT_RULES.map((rule) => (
          <li key={rule.name} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">{rule.name}</p>
              <p className="text-xs text-muted-foreground">{describeRule(rule)}</p>
            </div>
            <PermissionButton permission="reminders:settings" size="sm" variant="outline" onClick={() => onUse(rule)}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Add
            </PermissionButton>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ReminderRulesPage() {
  const { can } = usePermission();
  const canManage = can("reminders:settings");
  const fetchRules = useCallback(() => reminderService.listRules(), []);
  const rules = useApiResource(fetchRules);
  // Contact hours bound the send time. Settings are only readable with
  // `reminders:settings`, which editing needs anyway; until they load, the
  // legal limit applies and the server checks the tenant's own window.
  const fetchSettings = useCallback(() => reminderService.getSettings(), []);
  const settings = useApiResource(fetchSettings, canManage);
  const contactHours = settings.data?.contact_hours ?? CONTACT_HOURS_LIMIT;

  const [dialog, setDialog] = useState<{ rule: ReminderRule | null; draft?: Partial<ReminderRuleInput> } | null>(null);
  const [deactivating, setDeactivating] = useState<number | null>(null);

  const deactivate = (rule: ReminderRule) => {
    setDeactivating(rule.id);
    reminderService
      .deactivateRule(rule.id)
      .then(() => {
        setDeactivating(null);
        notifySuccess("Rule deactivated", "Reminders already scheduled by it are cancelled.");
        rules.refetch();
      })
      .catch((err) => {
        setDeactivating(null);
        notifyError(err, "Could not deactivate the rule.");
      });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Rules decide when reminders go out. A rule never sends for an installment that is already paid.
        </p>
        <PermissionButton
          permission="reminders:settings"
          // Nothing to save to while the reminder service is not connected.
          disabled={rules.unavailable}
          onClick={() =>
            // Settings promise their default send time to new rules.
            setDialog({ rule: null, draft: settings.data ? { send_time: settings.data.default_send_time } : undefined })
          }
        >
          <Plus className="mr-1.5 h-4 w-4" /> New rule
        </PermissionButton>
      </div>

      <DataState
        resource={rules}
        summary="Reminder rules will be listed here once the reminder service is connected."
        endpoints={["GET /reminders/rules", "POST /reminders/rules", "PUT /reminders/rules/{id}"]}
      >
        {(rows) =>
          rows.length === 0 ? (
            <SuggestedRules onUse={(draft) => setDialog({ rule: null, draft })} />
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rule</TableHead>
                    <TableHead>Schedule</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead>Applies to</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell className="font-medium">{rule.name}</TableCell>
                      <TableCell className="text-sm">{describeRule(rule)}</TableCell>
                      <TableCell className="text-sm">{TEMPLATE_TYPE_LABELS[rule.template_type]}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {[
                          rule.branch_name ?? "All branches",
                          rule.loan_product_name ?? "All products",
                          BORROWER_TYPE_LABELS[rule.borrower_type],
                        ].join(" · ")}
                      </TableCell>
                      <TableCell>
                        {rule.is_active ? (
                          <Badge variant="outline" className="border-green-200 bg-green-100 text-green-700 dark:border-green-800 dark:bg-green-500/15 dark:text-green-400">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            Inactive
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <PermissionButton
                          permission="reminders:settings"
                          size="sm"
                          variant="ghost"
                          onClick={() => setDialog({ rule })}
                        >
                          <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                        </PermissionButton>
                        {rule.is_active && (
                          <PermissionButton
                            permission="reminders:settings"
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            disabled={deactivating === rule.id}
                            onClick={() => deactivate(rule)}
                          >
                            {deactivating === rule.id ? "Deactivating…" : "Deactivate"}
                          </PermissionButton>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )
        }
      </DataState>

      <RuleFormDialog
        open={dialog !== null}
        onOpenChange={(open) => !open && setDialog(null)}
        rule={dialog?.rule ?? null}
        draft={dialog?.draft}
        contactHours={contactHours}
        onSaved={rules.refetch}
      />
    </div>
  );
}
