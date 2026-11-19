"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useApiResource, usePermission } from "@/hooks";
import { useDialogOpening } from "@/hooks/use-dialog-opening";
import { useSubmitGuard } from "@/hooks/use-submit-guard";
import { amlaCaseAccess } from "@/lib/amla/case-access";
import { amlaCaseApi } from "@/lib/amla/case-api";
import { amlaEscalateBody, type AmlaEscalateForm } from "@/lib/amla/case-view";
import { once } from "@/lib/amla/once";
import { notifyError, notifySuccess } from "@/lib/notify";
import type { AmlaPage } from "@/types/amla";
import type { AmlaCaseRow } from "@/types/amla-cases";
import type { AmlaAlertDetail } from "@/types/amla-monitoring";
import { CddFormDialog } from "../customers/_components/cdd-form-dialog";

/** `AmlaAlert::WORKABLE`: statuses a person can still act on. */
const WORKABLE = ["open", "assigned", "under_review"];

/** The alert's case, or "Open a case" for head-office case holders while the alert can still be worked. */
export function AlertCaseLine({ alert }: { alert: AmlaAlertDetail }) {
  const { can } = usePermission();
  const access = amlaCaseAccess(can);
  const [open, setOpen] = useState(false);
  if (alert.case) {
    return (
      <p className="rounded-md border bg-muted/40 p-3 text-sm">
        Escalated to case{" "}
        {access.cases ? (
          <Link href={`/amla/cases/${alert.case.id}`} className="font-medium underline-offset-4 hover:underline">
            {alert.case.reference}
          </Link>
        ) : (
          alert.case.reference
        )}
        .
      </p>
    );
  }
  if (!access.escalate || !WORKABLE.includes(alert.status)) return null;
  return (
    <>
      <div>
        <Button size="sm" onClick={() => setOpen(true)}>
          Open a case
        </Button>
      </div>
      <EscalateDialog open={open} alert={alert} onClose={() => setOpen(false)} />
    </>
  );
}

const START: AmlaEscalateForm = { mode: "new", title: "", caseId: null, note: "" };
const NOTHING = () => Promise.resolve<AmlaPage<AmlaCaseRow>>({ data: [], meta: { current_page: 1, per_page: 25, total: 0, last_page: 1 } });
const ACTIVE = ["open", "investigating"];

function EscalateDialog({ open, alert, onClose }: { open: boolean; alert: AmlaAlertDetail; onClose: () => void }) {
  const router = useRouter();
  const [form, setForm] = useState(START);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [finder, setFinder] = useState<(() => Promise<AmlaPage<AmlaCaseRow>>) | null>(null);
  const found = useApiResource(finder ?? NOTHING, finder !== null);
  const { submitting, run } = useSubmitGuard();
  if (useDialogOpening(open, alert.id)) {
    setForm(START);
    setSearch("");
    setError(null);
    setFinder(null);
  }
  const set = (next: Partial<AmlaEscalateForm>) => {
    setForm({ ...form, ...next });
    setError(null);
  };
  const same = (row: AmlaCaseRow) => ACTIVE.includes(row.status) && row.subject.type === alert.subject.type && row.subject.id === alert.subject.id;
  const matches = (found.data?.data ?? []).filter(same);
  const find = () => {
    if (search.trim() === "") return setError("Type the case's reference to find it.");
    // One read per Find: the server logs each list read.
    setFinder(() => once(() => amlaCaseApi.cases({ status: "", search, page: 1 })));
  };

  return (
    <CddFormDialog
      open={open}
      title="Open a case from this alert"
      description={`Start an investigation of ${alert.subject.name}, or add this alert to an open case about them. Nothing is filed by itself.`}
      submitLabel={form.mode === "new" ? "Open case" : "Add to case"}
      submitting={submitting}
      error={error}
      onClose={onClose}
      onSubmit={() => {
        const result = amlaEscalateBody(form);
        if ("error" in result) return setError(result.error);
        run(() => amlaCaseApi.escalate(alert.id, result.body))
          ?.then((record) => {
            notifySuccess(`Alert added to case ${record.reference}`);
            router.push(`/amla/cases/${record.id}`);
          })
          .catch((err: unknown) => notifyError(err, "The case couldn't be opened."));
      }}
    >
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Case</legend>
        {(
          [
            ["new", "A new case"],
            ["existing", "An open case about the same person"],
          ] as const
        ).map(([mode, label]) => (
          <label key={mode} className="flex items-center gap-2 text-sm">
            <input type="radio" name="amla-escalate-mode" checked={form.mode === mode} disabled={submitting} onChange={() => set({ mode, caseId: null })} />
            {label}
          </label>
        ))}
      </fieldset>
      {form.mode === "new" ? (
        <div className="space-y-1">
          <Label htmlFor="amla-escalate-title">Title (optional)</Label>
          <Input id="amla-escalate-title" value={form.title} maxLength={200} disabled={submitting} onChange={(e) => set({ title: e.target.value })} />
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="amla-escalate-search">Case reference</Label>
          <div className="flex gap-2">
            <Input id="amla-escalate-search" value={search} maxLength={40} disabled={submitting} onChange={(e) => setSearch(e.target.value)} />
            <Button type="button" variant="outline" disabled={submitting} onClick={find}>
              Find
            </Button>
          </div>
          {finder !== null && found.loading && <p className="text-sm text-muted-foreground">Finding…</p>}
          {finder !== null && found.error && <p className="text-sm text-destructive">{found.error}</p>}
          {finder !== null && found.data && matches.length === 0 && (
            <p className="text-sm text-muted-foreground">No open case about {alert.subject.name} has that reference.</p>
          )}
          {matches.map((row) => (
            <label key={row.id} className="flex items-center gap-2 text-sm">
              <input type="radio" name="amla-escalate-case" checked={form.caseId === row.id} disabled={submitting} onChange={() => set({ caseId: row.id })} />
              {row.reference} · {row.title} · {row.status_words}
            </label>
          ))}
        </div>
      )}
      <div className="space-y-1">
        <Label htmlFor="amla-escalate-note">Note (optional)</Label>
        <Textarea id="amla-escalate-note" value={form.note} maxLength={2000} disabled={submitting} onChange={(e) => set({ note: e.target.value })} />
      </div>
    </CddFormDialog>
  );
}
