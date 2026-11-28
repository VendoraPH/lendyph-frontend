"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cicService } from "@/services";
import { notifyError, notifyInfo, notifySuccess } from "@/lib/notify";
import type { CicCode, CicCodeMappingDomain, CicCodeMappingRow, CicCodeMappings, SaveCicCodeMapping } from "@/types/cic";

/** The CIC code lists each Lendy value can map to, in words. */
const LIST_LABELS: Record<string, string> = {
  GuaranteesDomain: "Guarantee codes",
  IDTypeDomain: "ID types (ID records' ID fields)",
  IdentificationTypeDomain: "Identification types",
};

const DOMAIN_LISTS: Record<CicCodeMappingDomain, readonly (keyof CicCodeMappings["code_lists"])[]> = {
  collateral_type: ["GuaranteesDomain"],
  id_kind: ["IDTypeDomain", "IdentificationTypeDomain"],
};

/** A choice is its list and code together: the two ID lists share codes ("10" means two things). */
const choiceOf = (list: string | null, code: string | null) => (list && code ? `${list}|${code}` : "");
const parseChoice = (v: string): { cic_domain: string | null; cic_code: string | null } => {
  const [list, code] = v.split("|");
  return list && code ? { cic_domain: list, cic_code: code } : { cic_domain: null, cic_code: null };
};

type Drafts = Record<string, string>;
const keyOf = (domain: CicCodeMappingDomain, value: string) => `${domain}\u0000${value}`;

function draftsOf(m: CicCodeMappings): Drafts {
  const out: Drafts = {};
  for (const r of m.collateral_type) out[keyOf("collateral_type", r.lendy_value)] = choiceOf(r.cic_domain ?? "GuaranteesDomain", r.cic_code);
  for (const r of m.id_kind) out[keyOf("id_kind", r.lendy_value)] = choiceOf(r.cic_domain, r.cic_code);
  return out;
}

function MappingTable({
  domain,
  rows,
  lists,
  drafts,
  onChange,
}: {
  domain: CicCodeMappingDomain;
  rows: CicCodeMappingRow[];
  lists: CicCodeMappings["code_lists"];
  drafts: Drafts;
  onChange: (key: string, choice: string) => void;
}) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Nothing to map yet.</p>;
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{domain === "collateral_type" ? "Collateral type" : "ID kind"}</TableHead>
            <TableHead>CIC code</TableHead>
            <TableHead>Suggested</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const key = keyOf(domain, r.lendy_value);
            const suggestion = choiceOf(r.suggested_domain ?? (domain === "collateral_type" ? "GuaranteesDomain" : null), r.suggested_code);
            return (
              <TableRow key={key}>
                <TableCell className="font-medium whitespace-normal">{r.name}</TableCell>
                <TableCell>
                  <NativeSelect
                    aria-label={`CIC code for ${r.name}`}
                    className="w-80"
                    value={drafts[key] ?? ""}
                    onChange={(e) => onChange(key, e.target.value)}
                  >
                    <NativeSelectOption value="">Not mapped</NativeSelectOption>
                    {DOMAIN_LISTS[domain].map((list) => (
                      <NativeSelectOptGroup key={list} label={LIST_LABELS[list]}>
                        {lists[list].map((c: CicCode) => (
                          <NativeSelectOption key={c.code} value={choiceOf(list, c.code)}>
                            {c.code} · {c.label}
                          </NativeSelectOption>
                        ))}
                      </NativeSelectOptGroup>
                    ))}
                  </NativeSelect>
                </TableCell>
                <TableCell className="whitespace-normal">
                  {r.suggested_code ? (
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span>
                        {r.suggested_code} · {r.suggested_label}
                      </span>
                      {drafts[key] !== suggestion && suggestion && (
                        <Button variant="outline" onClick={() => onChange(key, suggestion)}>
                          Use
                        </Button>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * Lendy's collateral types and ID kinds against CIC's code lists. Lendy
 * suggests a code for many; a suggestion is saved only when it is picked and
 * saved here.
 */
export function CodeMappingCard({ initial }: { initial: CicCodeMappings }) {
  const [mappings, setMappings] = useState(initial);
  const [drafts, setDrafts] = useState(() => draftsOf(initial));
  const [saving, setSaving] = useState(false);
  const saved = draftsOf(mappings);

  const save = async () => {
    const body: SaveCicCodeMapping[] = [];
    for (const domain of ["collateral_type", "id_kind"] as const) {
      for (const r of mappings[domain]) {
        const key = keyOf(domain, r.lendy_value);
        if ((drafts[key] ?? "") === (saved[key] ?? "")) continue;
        body.push({ domain, lendy_value: r.lendy_value, ...parseChoice(drafts[key] ?? "") });
      }
    }
    if (body.length === 0) {
      notifyInfo("Nothing changed.");
      return;
    }
    setSaving(true);
    try {
      const next = await cicService.saveCodeMappings(body);
      setSaving(false);
      setMappings(next);
      setDrafts(draftsOf(next));
      notifySuccess("Code mappings saved.");
    } catch (err) {
      setSaving(false);
      notifyError(err, "The code mappings could not be saved.");
    }
  };

  const change = (key: string, choice: string) => setDrafts((d) => ({ ...d, [key]: choice }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Code Mapping</CardTitle>
        <CardDescription>
          The CIC code each collateral type and ID kind is reported as. Suggestions are saved only when you pick
          them and save.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <section className="space-y-2">
          <h3 className="text-sm font-medium">Collateral Types</h3>
          <MappingTable
            domain="collateral_type"
            rows={mappings.collateral_type}
            lists={mappings.code_lists}
            drafts={drafts}
            onChange={change}
          />
        </section>
        <section className="space-y-2">
          <h3 className="text-sm font-medium">ID Kinds</h3>
          <MappingTable domain="id_kind" rows={mappings.id_kind} lists={mappings.code_lists} drafts={drafts} onChange={change} />
        </section>
        <Button disabled={saving} onClick={save}>
          {saving ? "Saving…" : "Save Code Mapping"}
        </Button>
      </CardContent>
    </Card>
  );
}
