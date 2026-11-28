"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cicService } from "@/services";
import { CIC_DOMAINS } from "@/lib/cic/domains.generated";
import { notifyError, notifySuccess, notifyValidation } from "@/lib/notify";
import type { CicContractRecordType, CicProductMapping } from "@/types/cic";

const RECORD_TYPES: { code: CicContractRecordType; label: string }[] = [
  { code: "CI", label: "CI · Installment" },
  { code: "CN", label: "CN · Non-installment" },
];

const contractTypes = (type: CicContractRecordType) => CIC_DOMAINS[`${type}:ContractTypeDomain`];

/** Each loan product's CIC record and contract type. An unmapped product's loans are left out of the file. */
export function ProductMappingCard({ mappings }: { mappings: CicProductMapping[] }) {
  const [rows, setRows] = useState(mappings);
  const [saving, setSaving] = useState(false);
  const patch = (id: number, change: Partial<CicProductMapping>) =>
    setRows((prev) => prev.map((r) => (r.loan_product_id === id ? { ...r, ...change } : r)));

  const save = async () => {
    const incomplete = rows.filter((r) => r.record_type && !r.contract_type).map((r) => r.loan_product_name);
    if (incomplete.length > 0) {
      notifyValidation(incomplete.map((name) => `Contract type for ${name}`));
      return;
    }
    setSaving(true);
    try {
      const saved = await cicService.saveProductMappings(
        rows.map(({ loan_product_id, record_type, contract_type, purpose }) => ({
          loan_product_id,
          record_type,
          contract_type: record_type ? contract_type : null,
          purpose: record_type ? purpose : null,
        })),
      );
      setSaving(false);
      setRows(saved);
      notifySuccess("Product mapping saved.");
    } catch (err) {
      setSaving(false);
      notifyError(err, "The product mapping could not be saved.");
    }
  };

  const unmapped = rows.filter((r) => !r.record_type).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Loan Product Mapping</CardTitle>
        <CardDescription>
          How each loan product is reported to CIC.{" "}
          {unmapped > 0
            ? `${unmapped} ${unmapped === 1 ? "product is" : "products are"} not reported until mapped.`
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
                  <TableHead>Purpose</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.loan_product_id}>
                    <TableCell className="font-medium">{r.loan_product_name}</TableCell>
                    <TableCell>
                      <NativeSelect
                        aria-label={`CIC record for ${r.loan_product_name}`}
                        value={r.record_type ?? ""}
                        onChange={(e) =>
                          patch(r.loan_product_id, {
                            record_type: (e.target.value || null) as CicContractRecordType | null,
                            contract_type: null,
                          })
                        }
                      >
                        <NativeSelectOption value="">Not reported</NativeSelectOption>
                        {RECORD_TYPES.map((t) => (
                          <NativeSelectOption key={t.code} value={t.code}>
                            {t.label}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    </TableCell>
                    <TableCell>
                      <NativeSelect
                        aria-label={`Contract type for ${r.loan_product_name}`}
                        disabled={!r.record_type}
                        value={r.contract_type ?? ""}
                        onChange={(e) => patch(r.loan_product_id, { contract_type: e.target.value || null })}
                      >
                        <NativeSelectOption value="">Choose</NativeSelectOption>
                        {r.record_type &&
                          contractTypes(r.record_type).map((d) => (
                            <NativeSelectOption key={d.code} value={d.code}>
                              {d.code} · {d.label}
                            </NativeSelectOption>
                          ))}
                      </NativeSelect>
                    </TableCell>
                    <TableCell>
                      <NativeSelect
                        aria-label={`Purpose for ${r.loan_product_name}`}
                        disabled={!r.record_type}
                        value={r.purpose ?? ""}
                        onChange={(e) => patch(r.loan_product_id, { purpose: e.target.value || null })}
                      >
                        <NativeSelectOption value="">From each loan</NativeSelectOption>
                        {CIC_DOMAINS.CreditPurposeDomain.map((d) => (
                          <NativeSelectOption key={d.code} value={d.code}>
                            {d.code} · {d.label}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
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
    </Card>
  );
}
