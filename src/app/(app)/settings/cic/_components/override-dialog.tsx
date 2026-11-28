"use client";

import { useState } from "react";
import { LoanSearchPicker } from "@/components/common/loan-search-picker";
import { ReasonDialog } from "@/components/common/reason-dialog";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useDialogOpening, usePermission } from "@/hooks";
import type { LoanOption } from "@/hooks/use-loan-search";
import { notifySuccess } from "@/lib/notify";
import { cicService } from "@/services";
import type { CicContractRecordType, CicLoanOverride, CicLoanOverrideCodes, CicProductMappingCodeLists } from "@/types/cic";
import { recordTypeLabel } from "@/app/(app)/cic/_lib/labels";
import { CodeSelect } from "./code-select";

const RECORD_TYPES: CicContractRecordType[] = ["CI", "CN"];
const BLANK: CicLoanOverrideCodes = { record_type: null, contract_type: null, transaction_type: null };

/**
 * Adds or changes one loan's own CIC codes, each with a reason. A blank code
 * keeps the product mapping's; the server checks each code against the record
 * type the loan reports as. `editing` null with `open` adds one.
 */
export function OverrideDialog({
  open,
  editing,
  codeLists,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  editing: CicLoanOverride | null;
  codeLists: CicProductMappingCodeLists;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const { can } = usePermission();
  const [loan, setLoan] = useState<LoanOption | null>(null);
  const [codes, setCodes] = useState<CicLoanOverrideCodes>(BLANK);
  if (useDialogOpening(open, editing)) {
    setLoan(null);
    setCodes(
      editing
        ? { record_type: editing.record_type, contract_type: editing.contract_type, transaction_type: editing.transaction_type }
        : BLANK,
    );
  }
  // Contract types depend on the record type: the override's own, else the product's.
  const recordType = codes.record_type ?? editing?.product_mapping?.record_type ?? null;

  return (
    <ReasonDialog
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? `Change the CIC Codes of ${editing.loan.display_number}` : "Override a Loan's CIC Codes"}
      description="This loan is reported with these codes instead of its product's mapping. Leave a code blank to keep the product's."
      confirmLabel={editing ? "Save Override" : "Add Override"}
      missingFields={!editing && !loan ? ["Loan"] : []}
      onConfirm={async (reason) => {
        if (editing) await cicService.updateLoanOverride(editing.id, { ...codes, reason });
        else if (loan) await cicService.createLoanOverride({ loan_id: loan.id, ...codes, reason });
        notifySuccess("Loan override saved.");
        onSaved();
      }}
    >
      <div className="space-y-4">
        {!editing && (
          <div className="space-y-1.5">
            <Label>Loan</Label>
            <LoanSearchPicker
              value={loan}
              onChange={setLoan}
              canSearch={can("loans:view")}
              placeholder={can("loans:view") ? "Choose a released loan" : "You can't list loans"}
              aria-label="Loan"
            />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="cic-override-record">CIC record</Label>
          <NativeSelect
            id="cic-override-record"
            className="w-full"
            value={codes.record_type ?? ""}
            onChange={(e) =>
              setCodes({ ...codes, record_type: RECORD_TYPES.find((t) => t === e.target.value) ?? null, contract_type: null })
            }
          >
            <NativeSelectOption value="">The product&apos;s</NativeSelectOption>
            {RECORD_TYPES.map((t) => (
              <NativeSelectOption key={t} value={t}>
                {recordTypeLabel(t)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cic-override-contract">Contract type</Label>
          <CodeSelect
            id="cic-override-contract"
            aria-label="Contract type"
            codes={recordType ? codeLists[`${recordType}:ContractTypeDomain`] : []}
            disabled={!recordType}
            value={codes.contract_type}
            empty={recordType ? "The product's" : "Choose the CIC record first"}
            onChange={(contract_type) => setCodes({ ...codes, contract_type })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cic-override-transaction">Transaction type</Label>
          <CodeSelect
            id="cic-override-transaction"
            aria-label="Transaction type"
            codes={codeLists.TransactionTypeDomain}
            value={codes.transaction_type}
            empty="The product's"
            onChange={(transaction_type) => setCodes({ ...codes, transaction_type })}
          />
        </div>
      </div>
    </ReasonDialog>
  );
}
