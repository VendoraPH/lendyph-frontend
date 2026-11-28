"use client";

import { useState } from "react";
import { ConfirmDeleteDialog } from "@/components/common/confirm-delete-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cicService } from "@/services";
import { notifyError, notifyInfo, notifySuccess, notifyValidation } from "@/lib/notify";
import type { CicContractRecordType, CicProductMappings, SaveCicProductMapping } from "@/types/cic";
import {
  draftsOf,
  mergeClearedRow,
  sameDraft as same,
  type ProductMappingDraft as Draft,
} from "../_lib/product-mapping-drafts";
import { recordTypeLabel } from "@/app/(app)/cic/_lib/labels";
import { CodeSelect } from "./code-select";

const RECORD_TYPES: CicContractRecordType[] = ["CI", "CN"];

/**
 * How each loan product is reported: CI or CN, its contract and transaction
 * types and, for CI, the purpose of credit, from the server's code lists.
 * A loan can be given its own codes below (Loan Overrides).
 */
export function ProductMappingCard({ initial }: { initial: CicProductMappings }) {
  const [mappings, setMappings] = useState(initial);
  const [rows, setRows] = useState(() => draftsOf(initial));
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState<Draft | null>(null);
  const [clearBusy, setClearBusy] = useState(false);
  const saved = draftsOf(mappings);
  const savedOf = (id: number) => saved.find((s) => s.loan_product_id === id);
  const lists = mappings.code_lists;
  const patch = (id: number, change: Partial<Draft>) =>
    setRows((prev) => prev.map((r) => (r.loan_product_id === id ? { ...r, ...change } : r)));

  const save = async () => {
    const changed = rows.filter((r) => r.record_type && !same(r, saved.find((s) => s.loan_product_id === r.loan_product_id)));
    const incomplete = changed.filter((r) => !r.contract_type || !r.transaction_type);
    if (incomplete.length > 0) {
      notifyValidation(incomplete.map((r) => `Contract and transaction type for ${r.name}`));
      return;
    }
    if (changed.length === 0) {
      notifyInfo("Nothing changed.");
      return;
    }
    const body: SaveCicProductMapping[] = [];
    for (const r of changed) {
      if (!r.record_type || !r.contract_type || !r.transaction_type) continue;
      body.push({
        loan_product_id: r.loan_product_id,
        record_type: r.record_type,
        contract_type: r.contract_type,
        transaction_type: r.transaction_type,
        purpose_code: r.record_type === "CI" ? r.purpose_code : null,
      });
    }
    setSaving(true);
    try {
      const next = await cicService.saveProductMappings(body);
      setSaving(false);
      setMappings(next);
      setRows(draftsOf(next));
      notifySuccess("Product mapping saved.");
    } catch (err) {
      setSaving(false);
      notifyError(err, "The product mapping could not be saved.");
    }
  };

  /** The server clears it and answers with the whole listing, which the table shows again. */
  const clear = async () => {
    if (!clearing) return;
    setClearBusy(true);
    try {
      const id = clearing.loan_product_id;
      const next = await cicService.clearProductMapping(id);
      setClearBusy(false);
      setClearing(null);
      setMappings(next);
      // Only the cleared row is replaced; other rows keep their unsaved edits.
      setRows((prev) => mergeClearedRow(prev, next, id));
      notifySuccess("Product mapping cleared.");
    } catch (err) {
      setClearBusy(false);
      notifyError(err, "The product mapping could not be cleared.");
    }
  };

  const unmapped = saved.filter((r) => !r.record_type).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Loan Product Mapping</CardTitle>
        <CardDescription>
          How each loan product is reported to CIC.{" "}
          {unmapped > 0
            ? `${unmapped} ${unmapped === 1 ? "product has" : "products have"} no mapping: their loans read as errors until mapped.`
            : "Every product is mapped."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No loan product yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Loan product</TableHead>
                  <TableHead>CIC record</TableHead>
                  <TableHead>Contract type</TableHead>
                  <TableHead>Transaction type</TableHead>
                  <TableHead>Purpose of credit</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.loan_product_id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell>
                      <NativeSelect
                        aria-label={`CIC record for ${r.name}`}
                        className="w-56"
                        value={r.record_type ?? ""}
                        onChange={(e) => {
                          const next = RECORD_TYPES.find((t) => t === e.target.value) ?? null;
                          patch(r.loan_product_id, { record_type: next, contract_type: null, purpose_code: null });
                        }}
                      >
                        {/* A saved mapping is cleared with Clear, so "Not mapped" is offered only before one exists. */}
                        {!savedOf(r.loan_product_id)?.record_type && (
                          <NativeSelectOption value="">Not mapped</NativeSelectOption>
                        )}
                        {RECORD_TYPES.map((t) => (
                          <NativeSelectOption key={t} value={t}>
                            {recordTypeLabel(t)}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    </TableCell>
                    <TableCell>
                      <CodeSelect
                        aria-label={`Contract type for ${r.name}`}
                        codes={r.record_type ? lists[`${r.record_type}:ContractTypeDomain`] : []}
                        disabled={!r.record_type}
                        value={r.contract_type}
                        empty="Choose"
                        onChange={(contract_type) => patch(r.loan_product_id, { contract_type })}
                      />
                    </TableCell>
                    <TableCell>
                      <CodeSelect
                        aria-label={`Transaction type for ${r.name}`}
                        codes={lists.TransactionTypeDomain}
                        disabled={!r.record_type}
                        value={r.transaction_type}
                        empty="Choose"
                        onChange={(transaction_type) => patch(r.loan_product_id, { transaction_type })}
                      />
                    </TableCell>
                    <TableCell>
                      {r.record_type === "CN" ? (
                        <span className="text-sm text-muted-foreground">Not reported for CN</span>
                      ) : (
                        <CodeSelect
                          aria-label={`Purpose of credit for ${r.name}`}
                          codes={lists.CreditPurposeDomain}
                          disabled={!r.record_type}
                          value={r.purpose_code}
                          empty="None"
                          onChange={(purpose_code) => patch(r.loan_product_id, { purpose_code })}
                        />
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {savedOf(r.loan_product_id)?.record_type && (
                        <Button variant="outline" onClick={() => setClearing(r)}>
                          Clear
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <Button disabled={saving || rows.length === 0} onClick={save}>
          {saving ? "Saving…" : "Save Mapping"}
        </Button>
      </CardContent>
      <ConfirmDeleteDialog
        open={clearing !== null}
        title="Clear the CIC Mapping?"
        confirmLabel="Clear mapping"
        description={
          clearing
            ? `${clearing.name} loses its CIC mapping, so its loans will show as unmapped until it is mapped again or a loan has its own override.`
            : null
        }
        busy={clearBusy}
        onCancel={() => setClearing(null)}
        onConfirm={clear}
      />
    </Card>
  );
}
