"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { MemberSearchPicker } from "@/components/common/member-search-picker";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useApiResource, usePermission } from "@/hooks";
import { useDialogOpening } from "@/hooks/use-dialog-opening";
import type { MemberOption } from "@/hooks/use-member-search";
import { useSubmitGuard } from "@/hooks/use-submit-guard";
import { amlaScreeningAccess } from "@/lib/amla/screening-access";
import { amlaScreeningApi } from "@/lib/amla/screening-api";
import { AMLA_ORDER_AUTHORITY_OPTIONS, amlaOrderBody, type AmlaOrderForm } from "@/lib/amla/screening-view";
import { formatCurrency, todayISO } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/notify";
import { savingsService } from "@/services/savings.service";
import { HoldRows } from "./hold-rows";

const EMPTY: AmlaOrderForm = {
  reference: "",
  authority: "",
  receivedOn: "",
  memberId: null,
  requiredAction: "",
  details: "",
  returnDueOn: "",
  holds: [],
};

/**
 * Record an order, with or without savings holds on the member's own accounts.
 * The holds have no end date; only the order's release lifts them. Sent with
 * the form's Idempotency-Key, so a retry never records it twice.
 */
export function RecordOrderDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { can } = usePermission();
  const access = amlaScreeningAccess(can);
  const [form, setForm] = useState<AmlaOrderForm>(EMPTY);
  const [member, setMember] = useState<MemberOption | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { submitting, run } = useSubmitGuard();

  const memberId = member?.id ?? null;
  const accountsFetcher = useCallback(
    () => savingsService.accounts({ borrower_id: memberId, per_page: 100 }).then((page) => page.data),
    [memberId],
  );
  const accounts = useApiResource(accountsFetcher, open && memberId !== null && access.pickAccounts);
  const accountOptions = (accounts.data ?? []).map((a) => ({
    value: String(a.id),
    label: `${a.account_number} · ${a.product.name} · ${formatCurrency(a.available_balance)} available`,
  }));

  if (useDialogOpening(open, EMPTY)) {
    setForm(EMPTY);
    setMember(null);
    setError(null);
  }

  const set = <K extends keyof AmlaOrderForm>(key: K, value: AmlaOrderForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError(null);
  };

  function record() {
    const result = amlaOrderBody({ ...form, memberId }, todayISO());
    if ("error" in result) return setError(result.error);
    run((key) => amlaScreeningApi.placeOrder(result.body, key))
      ?.then((order) => {
        notifySuccess("Order recorded", result.body.holds.length > 0 ? "Its holds are placed." : undefined);
        onClose();
        router.push(`/amla/orders/${order.id}`);
      })
      .catch((err: unknown) => notifyError(err, "The order couldn't be recorded."));
  }

  const text = (key: "reference" | "requiredAction" | "details", label: string, multiline = false, max = 150) => (
    <div className="space-y-1 sm:col-span-2">
      <Label htmlFor={`order-${key}`}>{label}</Label>
      {multiline ? (
        <Textarea id={`order-${key}`} value={form[key]} maxLength={max} disabled={submitting} onChange={(e) => set(key, e.target.value)} />
      ) : (
        <Input id={`order-${key}`} value={form[key]} maxLength={max} disabled={submitting} onChange={(e) => set(key, e.target.value)} />
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !submitting && onClose()}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>Record an order</DialogTitle>
          <DialogDescription>
            Record the order as received. Holds stack on any others and have no end date; while the order is in force the
            member&apos;s time deposits can&apos;t be ended early or paid out. Only this order&apos;s release lifts its holds.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
          <div className="grid gap-3 sm:grid-cols-2">
            {text("reference", "Order reference")}
            <div className="space-y-1">
              <Label htmlFor="order-authority">Issued by</Label>
              <NativeSelect id="order-authority" className="w-full" value={form.authority} disabled={submitting} onChange={(e) => set("authority", e.target.value)}>
                <NativeSelectOption value="">Pick who issued it</NativeSelectOption>
                {AMLA_ORDER_AUTHORITY_OPTIONS.map((o) => (
                  <NativeSelectOption key={o.value} value={o.value}>
                    {o.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1">
              <Label htmlFor="order-received">Received on</Label>
              <Input id="order-received" type="date" max={todayISO()} value={form.receivedOn} disabled={submitting} onChange={(e) => set("receivedOn", e.target.value)} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="order-member">Member</Label>
              {access.pickMember ? (
                <MemberSearchPicker
                  id="order-member"
                  value={member}
                  onChange={(next) => {
                    setMember(next);
                    set("holds", []);
                  }}
                  canSearch
                  showCode
                  placeholder="Search members"
                />
              ) : (
                <p className="text-sm text-muted-foreground">Picking the member needs access to member records.</p>
              )}
            </div>
            {text("requiredAction", "What the order requires", true, 2000)}
            {text("details", "Details (optional)", true, 5000)}
            <div className="space-y-1">
              <Label htmlFor="order-return">Return due (optional)</Label>
              <Input id="order-return" type="date" min={form.receivedOn || undefined} value={form.returnDueOn} disabled={submitting} onChange={(e) => set("returnDueOn", e.target.value)} />
            </div>
          </div>
          <HoldRows
            holds={form.holds}
            options={accountOptions}
            state={!access.pickAccounts ? "no_access" : memberId === null ? "no_member" : accounts.loading ? "loading" : accounts.error ? "failed" : "ready"}
            disabled={submitting}
            onChange={(holds) => set("holds", holds)}
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={record} disabled={submitting}>
            {submitting && <Spinner className="mr-2 h-4 w-4" />}
            Record the order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
