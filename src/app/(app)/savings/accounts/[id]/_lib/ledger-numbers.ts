/**
 * A savings account's ledger line, on the account page (finish run round 8):
 * the ledger's own number (SVT-) under "Number", and the reference typed for
 * the money (a bank, GCash or Maya reference, `external_reference`) under
 * "Reference", a dash when there's none, as the Savings Transactions list
 * reads since round 6. Pure, so it runs under `tsx --test`.
 */

import type { SavingsTransaction } from "@/types";
import { typedReference } from "../../../_lib/payout-reference";

export function ledgerNumbers(
  line: Pick<SavingsTransaction, "reference"> & { external_reference?: string | null },
): { number: string; reference: string } {
  return { number: line.reference, reference: typedReference(line.external_reference) };
}
