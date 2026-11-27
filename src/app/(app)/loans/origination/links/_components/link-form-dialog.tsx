"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { useBranches } from "@/hooks";
import { useDialogOpening } from "@/hooks/use-dialog-opening";
import { branchPicker } from "@/lib/user-branches";
import { loanOriginationService } from "@/services";
import { useWorkingBranch } from "@/hooks/use-working-branch";
import { useAuthStore } from "@/store";
import type { ApplicationLink, ApplicationLinkInput } from "@/types/loan-origination";
import { useLoanProducts } from "../../../reminders/_hooks/use-loan-products";
import { ActionDialog } from "../../_components/action-dialog";
import { TEST_LINK_NOTE, TEST_LOCKED_NOTE, emptyLinkInput, linkInputFrom, testSettingLocked } from "../../_lib/links";

const orNull = (v: string) => (v.trim() === "" ? null : v);

/** Creates a link, or edits one (`link` set). The server makes the token; links have no logo. */
export function LinkFormDialog({
  link,
  open,
  onOpenChange,
  onDone,
}: {
  link: ApplicationLink | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const { products, error: productsError } = useLoanProducts();
  const { branches } = useBranches();
  const caller = useAuthStore((s) => s.user);
  const viewAll = useAuthStore((s) => s.hasPermission("branches:view_all"));
  const picker = branchPicker(branches, caller, viewAll);
  const { branchId: working } = useWorkingBranch();
  const [form, setForm] = useState<ApplicationLinkInput>(() => emptyLinkInput(null));
  // Without branches:view_all a link belongs to one of the caller's branches;
  // a link for every branch needs view_all.
  const ownBranchOnly = !viewAll;
  if (useDialogOpening(open, link)) {
    // A new link starts in the working branch (multi-branch flag), else as before.
    setForm(link ? linkInputFrom(link) : emptyLinkInput(working ?? (ownBranchOnly ? (picker.branches[0]?.id ?? null) : null)));
  }
  const set = (patch: Partial<ApplicationLinkInput>) => setForm((f) => ({ ...f, ...patch }));
  // Once the link has applications the server keeps its Test setting.
  const testLocked = testSettingLocked(link);
  const toggleProduct = (id: number, on: boolean) =>
    set({ loan_product_ids: on ? [...form.loan_product_ids, id] : form.loan_product_ids.filter((x) => x !== id) });

  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title={link ? "Edit application link" : "New application link"}
      description="Applicants open this link to apply online. Leave the products empty to offer every product enabled for online applications."
      confirmLabel={link ? "Save link" : "Create link"}
      successMessage={link ? "Link saved" : "Link created"}
      errorMessage="Could not save the link"
      canConfirm={form.name.trim() !== "" && (!ownBranchOnly || form.branch_id !== null)}
      onConfirm={() => (link ? loanOriginationService.updateLink(link.id, form) : loanOriginationService.createLink(form))}
      onDone={onDone}
      size="lg"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="link-name">Name (staff only)</Label>
          <Input id="link-name" maxLength={100} value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="Facebook campaign, June" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="link-branch">Branch</Label>
          <NativeSelect
            id="link-branch"
            className="w-full"
            value={form.branch_id ?? ""}
            onChange={(e) => set({ branch_id: e.target.value ? Number(e.target.value) : null })}
          >
            {ownBranchOnly ? (
              <NativeSelectOption value="" disabled>
                Choose a branch
              </NativeSelectOption>
            ) : (
              <NativeSelectOption value="">Every branch</NativeSelectOption>
            )}
            {picker.branches.map((b) => (
              <NativeSelectOption key={b.id} value={b.id}>
                {b.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="link-expires">Expires on (optional)</Label>
          <Input
            id="link-expires"
            type="date"
            value={form.expires_at ?? ""}
            onChange={(e) => set({ expires_at: e.target.value || null })}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="link-display">Name shown to applicants</Label>
          <Input
            id="link-display"
            maxLength={100}
            value={form.display_name ?? ""}
            onChange={(e) => set({ display_name: orNull(e.target.value) })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="link-phone">Contact phone</Label>
          <Input id="link-phone" maxLength={30} value={form.contact_phone ?? ""} onChange={(e) => set({ contact_phone: orNull(e.target.value) })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="link-email">Contact email</Label>
          <Input
            id="link-email"
            type="email"
            maxLength={150}
            value={form.contact_email ?? ""}
            onChange={(e) => set({ contact_email: orNull(e.target.value) })}
          />
        </div>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Loan products</legend>
        {productsError ? (
          <p className="text-sm text-muted-foreground">{productsError}</p>
        ) : (
          <div className="grid gap-1.5 sm:grid-cols-2">
            {products.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm">
                <Checkbox checked={form.loan_product_ids.includes(p.id)} onCheckedChange={(on) => toggleProduct(p.id, on)} />
                {p.name}
              </label>
            ))}
          </div>
        )}
      </fieldset>
      <label className="flex items-center gap-2 text-sm">
        <Switch checked={form.active} onCheckedChange={(active) => set({ active })} />
        Accepting applications
      </label>
      <label className="flex items-start gap-2 text-sm">
        <Switch
          className="mt-0.5"
          checked={form.is_test}
          disabled={testLocked}
          aria-describedby={testLocked ? "link-test-locked" : undefined}
          onCheckedChange={(is_test) => set({ is_test })}
        />
        <span>
          Test link
          <span className="block text-xs text-muted-foreground">{TEST_LINK_NOTE}</span>
          {testLocked && (
            <span id="link-test-locked" className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
              <Lock className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {TEST_LOCKED_NOTE}
            </span>
          )}
        </span>
      </label>
    </ActionDialog>
  );
}
