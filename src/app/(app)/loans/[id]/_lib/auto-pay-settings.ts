import type { AutoPaySettings } from "@/types/auto-pay";
import type { Loan } from "@/types/loan";

/**
 * The loan after PATCH /loans/{id}/auto-pay: the toggle's answer under the field
 * names GET /loans/{id} uses, so the card reads the same now and after a reload.
 */
export function applyAutoPaySettings<T extends Partial<Loan>>(
  loan: T,
  settings: AutoPaySettings,
): T {
  return {
    ...loan,
    auto_pay_enabled: settings.auto_pay_enabled,
    auto_pay_cbs_reference: settings.cbs_reference,
    auto_pay_enabled_at: settings.enabled_at,
    auto_pay_enabled_by: settings.enabled_by_user_id,
  };
}
