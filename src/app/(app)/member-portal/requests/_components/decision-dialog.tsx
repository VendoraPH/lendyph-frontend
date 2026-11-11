"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useDialogOpening } from "@/hooks";
import { useSubmitGuard } from "@/hooks/use-submit-guard";
import { formatCurrency, todayISO } from "@/lib/format";
import { notifySuccess } from "@/lib/notify";
import { portalAdminService } from "@/services/portal-admin.service";
import type { PortalRequestDecision, PortalRequestDetail, PortalWithdrawalMethod } from "@/types/portal-admin";
import type { SavingsMethod } from "@/types";
import { FormField } from "../../../savings/_components/field";
import { OptionSelect } from "../../../savings/_components/option-select";
import { PAYMENT_METHOD_OPTIONS } from "../../../savings/_lib/savings-rules";
import { REQUEST_TYPE_LABELS, labelOf } from "../../_lib/labels";
import { notifyPortalError } from "../../_lib/notify-portal-error";
import {
  DECISION_LABELS,
  decisionBody,
  decisionOutcome,
  decisionProblems,
  moneyDetailsFor,
  needsMessage,
  type DecisionForm,
} from "../../_lib/request-rules";

/** The teller method that matches how the member asked to be paid. */
const METHOD_FOR: Record<PortalWithdrawalMethod, SavingsMethod> = {
  cash_pickup: "cash",
  bank_transfer: "bank_transfer",
  gcash: "gcash",
};

function initialForm(request: PortalRequestDetail, decision: PortalRequestDecision): DecisionForm {
  const asked = request.details.method;
  return {
    decision,
    message: "",
    money: {
      date: todayISO(),
      method: asked && Object.hasOwn(METHOD_FOR, asked) ? METHOD_FOR[asked] : "",
      reference: "",
    },
  };
}

interface DecisionDialogProps {
  request: PortalRequestDetail;
  /** The decision being made, or null while closed. */
  decision: PortalRequestDecision | null;
  onOpenChange: (open: boolean) => void;
  onDecided: () => void;
}

/**
 * Decide a member's request. Approving sends the form's Idempotency-Key, so a
 * retry after a lost answer gets the first answer instead of a second payout.
 * Success shows only after the server answers: 201 posted or opened, 202
 * waiting for a second approval. A 409 (a stale status, access ended, the
 * hold lapsed) shows the server's words. The amount is never sent: the server
 * pays the request's own. Adapted from #513 by Augustin.
 */
export function DecisionDialog({ request, decision, onOpenChange, onDecided }: DecisionDialogProps) {
  const open = decision !== null;
  const [form, setForm] = useState<DecisionForm>(() => initialForm(request, decision ?? "under_review"));
  const [submitted, setSubmitted] = useState(false);
  const { submitting, run } = useSubmitGuard();
  if (useDialogOpening(open, decision)) {
    setForm(initialForm(request, decision ?? "under_review"));
    setSubmitted(false);
  }

  const money = form.decision === "approve" ? moneyDetailsFor(request.type) : null;
  const problems = decisionProblems(request.type, form);
  const setMoney = (patch: Partial<DecisionForm["money"]>) => setForm((f) => ({ ...f, money: { ...f.money, ...patch } }));

  function submit() {
    setSubmitted(true);
    if (problems.length > 0) return;
    run((key) => portalAdminService.decide(request.id, decisionBody(request.type, form), key))
      ?.then((result) => {
        notifySuccess(decisionOutcome(request.type, form.decision, result.status), request.reference);
        onOpenChange(false);
        onDecided();
      })
      .catch((err: unknown) => notifyPortalError(err, "The decision couldn't be saved. Please try again."));
  }

  const title = decision ? DECISION_LABELS[decision] : "Decide";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {title}: {request.reference}
          </DialogTitle>
          <DialogDescription>
            {labelOf(REQUEST_TYPE_LABELS, request.type)} from {request.member?.name ?? "the member"}.{" "}
            {request.amount !== null && `Amount ${formatCurrency(request.amount)}. `}
            {decision === "approve" && request.type === "savings_withdrawal"
              ? "The held money is paid out through the savings teller. Above the first approval amount it waits for a second approval in Savings Approvals."
              : decision === "approve" && request.type === "savings_opening"
                ? "The account is opened with the opening deposit received at the counter."
                : decision === "approve"
                  ? "The changes are saved to the member's record."
                  : decision === "reject" && request.type === "savings_withdrawal"
                    ? "The held money is released."
                    : "The member sees your message on their request."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {money && (
            <>
              <FormField id="pd-date" label={money === "payout" ? "Payout date" : "Deposit received on"} hint="Today or yesterday.">
                <Input
                  id="pd-date"
                  type="date"
                  max={todayISO()}
                  value={form.money.date}
                  onChange={(e) => setMoney({ date: e.target.value })}
                />
              </FormField>
              <FormField id="pd-method" label={money === "payout" ? "Paid out by" : "Deposit paid by"}>
                <OptionSelect
                  id="pd-method"
                  value={form.money.method}
                  onChange={(v) => setMoney({ method: v as SavingsMethod })}
                  options={PAYMENT_METHOD_OPTIONS}
                  placeholder="Choose the method"
                />
              </FormField>
              <FormField id="pd-ref" label="Reference (optional)" hint="A transfer or receipt number.">
                <Input
                  id="pd-ref"
                  maxLength={64}
                  value={form.money.reference}
                  onChange={(e) => setMoney({ reference: e.target.value })}
                />
              </FormField>
            </>
          )}
          <FormField
            id="pd-message"
            label={needsMessage(form.decision) ? "Message to the member" : "Message to the member (optional)"}
            hint="The member sees it on their request."
          >
            <Textarea
              id="pd-message"
              rows={3}
              maxLength={1000}
              value={form.message}
              onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
            />
          </FormField>
          {submitted && problems.length > 0 && (
            <ul className="space-y-1 text-xs text-destructive" role="alert">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant={decision === "reject" ? "destructive" : "default"}
            onClick={submit}
            disabled={submitting || decision === null}
          >
            {submitting ? "Waiting for the server…" : title}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
