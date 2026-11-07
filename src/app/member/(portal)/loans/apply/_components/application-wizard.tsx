"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { notifyError, notifySuccess, notifyWarning } from "@/lib/notify";
import { cn } from "@/lib/utils";
import {
  EMPTY_DRAFT,
  STEP_LABELS,
  applicationSteps,
  parseAmount,
  stepProblem,
  type ApplicationDraft,
} from "@/lib/portal/requests";
import { portalService } from "@/services/portal.service";
import type { PortalLoanEligibility, PortalLoanProduct } from "@/types/portal";
import { CollateralStep, DocumentsStep, IncomeStep, LoanStep } from "./detail-steps";
import { ProductStep } from "./product-step";
import { ReviewStep } from "./review-step";

const optional = (text: string) => (text.trim() ? parseAmount(text) : undefined);

/** Product → eligibility → details → documents → review. Steps a product does not need are skipped. */
export function ApplicationWizard({ products }: { products: PortalLoanProduct[] }) {
  const router = useRouter();
  const [productId, setProductId] = useState<number | null>(products.length === 1 ? products[0].id : null);
  const [eligibility, setEligibility] = useState<PortalLoanEligibility | null>(null);
  const [draft, setDraft] = useState<ApplicationDraft>(EMPTY_DRAFT);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);

  const product = products.find((p) => p.id === productId) ?? null;
  const steps = applicationSteps(product);
  const step = steps[index];
  const last = index === steps.length - 1;
  const set = (patch: Partial<ApplicationDraft>) => setDraft({ ...draft, ...patch });
  const reportEligibility = useCallback((r: PortalLoanEligibility | null) => setEligibility(r), []);

  const choose = (id: number) => {
    if (id === productId) return;
    setProductId(id);
    setEligibility(null);
    setDraft(EMPTY_DRAFT);
  };

  const next = () => {
    const problem =
      step === "product" && eligibility && !eligibility.eligible
        ? "You cannot apply for this loan yet."
        : stepProblem(step, draft, product);
    if (problem) return notifyWarning(problem);
    if (!last) return setIndex(index + 1);
    submit();
  };

  const submit = () => {
    if (!product) return;
    setBusy(true);
    portalService
      .submitLoanApplication({
        product_id: product.id,
        amount: parseAmount(draft.amount),
        term: Number(draft.term),
        purpose: draft.purpose.trim(),
        ...(product.requires_income_info && {
          monthly_income: parseAmount(draft.monthly_income),
          other_income: optional(draft.other_income),
          monthly_expenses: optional(draft.monthly_expenses),
          income_source: draft.income_source.trim() || undefined,
        }),
        ...(product.requires_collateral && {
          collateral_description: draft.collateral_description.trim(),
          collateral_value: optional(draft.collateral_value),
        }),
        documents: product.required_documents.flatMap((name) => {
          const file = draft.documents[name];
          return file ? [{ name, file }] : [];
        }),
        declaration_accepted: true,
      })
      .then((app) => {
        notifySuccess("Application sent", `Reference ${app.reference}. You can follow it on My loans.`);
        router.push("/member/loans");
      })
      .catch((err) => notifyError(err, "Your application could not be sent."))
      .finally(() => setBusy(false));
  };

  const props = product && { draft, set, product };

  return (
    <Card>
      <CardHeader className="space-y-3">
        <ol className="flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label="Steps">
          {steps.map((s, i) => (
            <li
              key={s}
              aria-current={i === index ? "step" : undefined}
              className={cn(i === index ? "font-semibold text-foreground" : "text-muted-foreground")}
            >
              {i + 1}. {STEP_LABELS[s]}
            </li>
          ))}
        </ol>
        <CardTitle className="text-base">{STEP_LABELS[step]}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {step === "product" && (
          <ProductStep products={products} selectedId={productId} onSelect={choose} onEligibility={reportEligibility} />
        )}
        {props && step === "loan" && <LoanStep {...props} />}
        {props && step === "income" && <IncomeStep {...props} />}
        {props && step === "collateral" && <CollateralStep {...props} />}
        {props && step === "documents" && <DocumentsStep {...props} />}
        {props && step === "review" && <ReviewStep {...props} />}
        <div className="flex justify-between gap-2">
          <Button variant="outline" disabled={index === 0 || busy} onClick={() => setIndex(index - 1)}>
            Back
          </Button>
          <Button disabled={busy || !product} onClick={next}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {last ? "Submit application" : "Next"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
