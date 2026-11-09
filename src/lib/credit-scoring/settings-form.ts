import type {
  CreditScoringPolicyFigures,
  CreditScoringSettings,
  UpdateCreditScoringSettingsData,
} from "@/types/credit-scoring";

export type PolicyFigureKey = keyof CreditScoringPolicyFigures;

export interface PolicyFigure {
  key: PolicyFigureKey;
  label: string;
  unit: string;
  hint: string;
}

/** The six policy figures, in the server's order, with what each one does. */
export const POLICY_FIGURES: readonly PolicyFigure[] = [
  {
    key: "dsr_manageable_max",
    label: "Manageable debt service ratio, up to",
    unit: "%",
    hint: "Above 0 and up to 100, at most four decimals. Can't be above the caution level.",
  },
  {
    key: "dsr_caution_max",
    label: "Caution debt service ratio, up to",
    unit: "%",
    hint: "Above this the application reads above capacity.",
  },
  {
    key: "capacity_share",
    label: "Share of income for loan payments",
    unit: "%",
    hint: "Sets the suggested maximum payment.",
  },
  { key: "max_active_loans", label: "Active loans allowed", unit: "loans", hint: "1 to 100. More raises a soft flag." },
  {
    key: "hard_past_due_days",
    label: "Hard flag after",
    unit: "days past due",
    hint: "1 to 365.",
  },
  {
    key: "decline_alert_points",
    label: "Alert on a score drop of",
    unit: "points",
    hint: "1 to 100.",
  },
];

export type SettingsForm = Record<PolicyFigureKey | "privacy_notice", string>;

export function settingsFormFrom(settings: CreditScoringSettings): SettingsForm {
  const form = { privacy_notice: settings.privacy_notice } as SettingsForm;
  for (const f of POLICY_FIGURES) form[f.key] = String(settings[f.key]);
  return form;
}

/**
 * The PUT body: the notice and the six figures as typed. The model version,
 * the notice version and the definition lists are the server's, so they never
 * go on the wire.
 */
export function settingsBody(form: SettingsForm): UpdateCreditScoringSettingsData {
  const body: UpdateCreditScoringSettingsData = { privacy_notice: form.privacy_notice };
  for (const f of POLICY_FIGURES) body[f.key] = form[f.key].trim();
  return body;
}
