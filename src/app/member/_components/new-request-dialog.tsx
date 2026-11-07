"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useDialogOpening } from "@/hooks/use-dialog-opening";
import { formatCurrency } from "@/lib/format";
import { notifyError, notifySuccess, notifyValidation, notifyWarning } from "@/lib/notify";
import {
  REQUEST_TYPES,
  amountProblem,
  attachmentProblem,
  fieldVisible,
  maxWithdrawable,
  missingRequestFields,
  parseAmount,
  requestDetails,
  requestTypesFor,
  withdrawalProblem,
} from "@/lib/portal/requests";
import { toAmount } from "@/lib/portal/finance";
import { portalService } from "@/services/portal.service";
import type { PortalRequestType } from "@/types/portal";
import { useRequestPickers } from "../_hooks/use-request-pickers";
import { AttachmentsInput } from "./attachments-input";
import { usePortalConfig } from "./portal-config";
import { RequestFieldInput } from "./request-field-input";

interface NewRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Opens on this type, e.g. a withdrawal from the savings screen. */
  initialType?: PortalRequestType;
  /** Pre-filled answers, e.g. the account the member was looking at. */
  initialValues?: Record<string, string>;
  onSubmitted?: () => void;
}

/**
 * Every member request goes through here. The form is drawn from the type's
 * definition in lib/portal/requests; nothing posts money, staff act on it.
 */
export function NewRequestDialog({ open, onOpenChange, initialType, initialValues, onSubmitted }: NewRequestDialogProps) {
  const { config } = usePortalConfig();
  const types = requestTypesFor(config.features);
  const [type, setType] = useState<PortalRequestType | null>(initialType ?? null);
  const [values, setValues] = useState<Record<string, string>>(initialValues ?? {});
  const [remarks, setRemarks] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const pickers = useRequestPickers(open ? type : null);

  if (useDialogOpening(open, initialType)) {
    setType(initialType ?? null);
    setValues(initialValues ?? {});
    setRemarks("");
    setFiles([]);
  }

  const def = type ? REQUEST_TYPES[type] : null;
  const set = (key: string, value: string) => setValues({ ...values, [key]: value });

  const withdrawFrom =
    type === "savings_withdrawal" ? pickers.savingsAccounts.find((a) => String(a.id) === values.account_id) : undefined;
  const product =
    type === "savings_opening" ? pickers.savingsProducts.find((p) => String(p.id) === values.product_id) : undefined;

  /** Checks after the required fields are filled: amounts and files. */
  const problem = (type: PortalRequestType): string | null => {
    for (const f of REQUEST_TYPES[type].fields) {
      if (f.kind !== "amount" || !fieldVisible(f, values)) continue;
      const amount = parseAmount(values[f.key] ?? "");
      const p = withdrawFrom
        ? withdrawalProblem(amount, withdrawFrom)
        : amountProblem(amount, product ? toAmount(product.minimum_deposit) : 0);
      if (p) return p;
    }
    return attachmentProblem(files);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!type) return;
    const missing = missingRequestFields(type, values);
    if (missing.length) return notifyValidation(missing);
    const p = problem(type);
    if (p) return notifyWarning(p);
    setBusy(true);
    portalService
      .submitRequest({
        type,
        details: requestDetails(type, values),
        remarks: remarks.trim() || undefined,
        attachments: files,
      })
      .then((req) => {
        notifySuccess("Request sent", `Reference ${req.reference}. We will let you know once it is reviewed.`);
        onOpenChange(false);
        onSubmitted?.();
      })
      .catch((err) => notifyError(err, "Your request could not be sent."))
      .finally(() => setBusy(false));
  };

  const noteFor = (key: string) => {
    if (key === "amount" && withdrawFrom) {
      return (
        <p className="text-xs text-muted-foreground">
          Available {formatCurrency(withdrawFrom.available_balance)}
          {withdrawFrom.maintaining_balance != null &&
            ` · maintaining balance ${formatCurrency(withdrawFrom.maintaining_balance)}`}
          {" · "}you can withdraw up to{" "}
          <span className="font-medium text-foreground">{formatCurrency(maxWithdrawable(withdrawFrom))}</span>
        </p>
      );
    }
    if (key === "product_id" && product) {
      return (
        <p className="text-xs text-muted-foreground">
          {product.description ? `${product.description} · ` : ""}
          Minimum deposit {formatCurrency(product.minimum_deposit)}
          {product.terms_url && (
            <>
              {" · "}
              <a href={product.terms_url} target="_blank" rel="noreferrer" className="underline">
                Terms
              </a>
            </>
          )}
        </p>
      );
    }
    return undefined;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{def?.label ?? "New request"}</DialogTitle>
          <DialogDescription>
            {def?.description ?? "Your cooperative reviews every request and replies here."}
          </DialogDescription>
        </DialogHeader>
        <form id="new-request" className="space-y-4" onSubmit={submit}>
          {!initialType && (
            <div className="space-y-1.5">
              <Label htmlFor="request-type">Request</Label>
              <NativeSelect
                id="request-type"
                className="w-full"
                value={type ?? ""}
                onChange={(e) => {
                  setType((e.target.value || null) as PortalRequestType | null);
                  setValues({});
                  setFiles([]);
                }}
              >
                <NativeSelectOption value="">Choose…</NativeSelectOption>
                {types.map((t) => (
                  <NativeSelectOption key={t} value={t}>
                    {REQUEST_TYPES[t].label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          )}
          {def?.fields
            .filter((f) => fieldVisible(f, values))
            .map((f) => (
              <RequestFieldInput
                key={f.key}
                field={f}
                value={values[f.key] ?? ""}
                onChange={(v) => set(f.key, v)}
                options={pickers.options[f.kind]}
                loading={pickers.loading[f.kind]}
                note={noteFor(f.key)}
              />
            ))}
          {def && (
            <div className="space-y-1.5">
              <Label htmlFor="request-remarks">Note to the cooperative (optional)</Label>
              <Textarea id="request-remarks" rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            </div>
          )}
          {def?.attachments && <AttachmentsInput files={files} onChange={setFiles} />}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="new-request" disabled={busy || !def}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
